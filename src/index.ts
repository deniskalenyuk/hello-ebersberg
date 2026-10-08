import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import page from './page.html'

// Image bytes live in KV; the index lives in D1 because KV listings lag
// behind writes and deletes by up to a minute.
type Bindings = { PHOTOS: KVNamespace; DB: D1Database }

type PhotoRow = { id: string; content_type: string; size: number; uploaded_at: string }

const PREFIX = 'photo:'
const MAX_BYTES = 5 * 1024 * 1024
const MAX_PHOTOS = 50
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_PATTERN = /^\d{13}-[0-9a-f-]{36}$/

const toPhoto = (row: PhotoRow) => ({
  id: row.id,
  url: `/photos/${row.id}`,
  contentType: row.content_type,
  size: row.size,
  uploadedAt: row.uploaded_at,
})

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.html(page))

app.get('/api/photos', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, content_type, size, uploaded_at FROM photos ORDER BY id DESC'
  ).all<PhotoRow>()
  return c.json({ photos: results.map(toPhoto) })
})

app.post(
  '/api/photos',
  bodyLimit({
    maxSize: MAX_BYTES,
    onError: (c) => c.json({ error: 'Photo is too large (max 5 MB).' }, 413),
  }),
  async (c) => {
    const contentType = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_TYPES.includes(contentType)) {
      return c.json({ error: 'Only JPEG, PNG or WebP images are allowed.' }, 415)
    }

    const body = await c.req.arrayBuffer()
    if (body.byteLength === 0) {
      return c.json({ error: 'Empty upload.' }, 400)
    }

    const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM photos').first<number>('n')
    if ((count ?? 0) >= MAX_PHOTOS) {
      return c.json({ error: `Photo limit reached (${MAX_PHOTOS}). Delete one first.` }, 409)
    }

    const row: PhotoRow = {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      content_type: contentType,
      size: body.byteLength,
      uploaded_at: new Date().toISOString(),
    }
    await c.env.PHOTOS.put(PREFIX + row.id, body)
    await c.env.DB.prepare('INSERT INTO photos (id, content_type, size, uploaded_at) VALUES (?, ?, ?, ?)')
      .bind(row.id, row.content_type, row.size, row.uploaded_at)
      .run()

    return c.json(toPhoto(row), 201)
  }
)

app.get('/photos/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_PATTERN.test(id)) return c.notFound()

  const row = await c.env.DB.prepare('SELECT content_type FROM photos WHERE id = ?')
    .bind(id)
    .first<Pick<PhotoRow, 'content_type'>>()
  if (!row) return c.notFound()

  const value = await c.env.PHOTOS.get(PREFIX + id, 'arrayBuffer')
  if (!value) return c.notFound()

  return c.body(value, 200, {
    'Content-Type': row.content_type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
})

app.delete('/api/photos/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_PATTERN.test(id)) return c.notFound()

  await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run()
  await c.env.PHOTOS.delete(PREFIX + id)
  return c.body(null, 204)
})

export default app
