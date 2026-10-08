import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import page from './page.html'

type Bindings = { PHOTOS: KVNamespace }

type PhotoMeta = { contentType: string; size: number; uploadedAt: string }

const PREFIX = 'photo:'
const MAX_BYTES = 5 * 1024 * 1024
const MAX_PHOTOS = 50
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_PATTERN = /^\d{13}-[0-9a-f-]{36}$/

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.html(page))

app.get('/api/photos', async (c) => {
  const list = await c.env.PHOTOS.list<PhotoMeta>({ prefix: PREFIX })
  const photos = list.keys
    .map((key) => {
      const id = key.name.slice(PREFIX.length)
      return { id, url: `/photos/${id}`, ...key.metadata }
    })
    .reverse()
  return c.json({ photos })
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

    const existing = await c.env.PHOTOS.list({ prefix: PREFIX, limit: MAX_PHOTOS })
    if (existing.keys.length >= MAX_PHOTOS) {
      return c.json({ error: `Photo limit reached (${MAX_PHOTOS}). Delete one first.` }, 409)
    }

    const id = `${Date.now()}-${crypto.randomUUID()}`
    const metadata: PhotoMeta = {
      contentType,
      size: body.byteLength,
      uploadedAt: new Date().toISOString(),
    }
    await c.env.PHOTOS.put(PREFIX + id, body, { metadata })

    return c.json({ id, url: `/photos/${id}`, ...metadata }, 201)
  }
)

app.get('/photos/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_PATTERN.test(id)) return c.notFound()

  const { value, metadata } = await c.env.PHOTOS.getWithMetadata<PhotoMeta>(PREFIX + id, 'arrayBuffer')
  if (!value || !metadata) return c.notFound()

  return c.body(value, 200, {
    'Content-Type': metadata.contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
})

app.delete('/api/photos/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_PATTERN.test(id)) return c.notFound()

  await c.env.PHOTOS.delete(PREFIX + id)
  return c.body(null, 204)
})

export default app
