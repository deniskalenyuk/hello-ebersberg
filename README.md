# hello-ebersberg

A minimal [Hono](https://hono.dev) app running on Cloudflare Workers. The page
can take a photo with the device camera and upload it; the image bytes are stored in
Workers KV, the photo index in D1, and photos can be deleted again from the page.

```
npm install
npm run cf-typegen
npx wrangler d1 migrations apply hello-ebersberg --local
npm run dev
```

```
npm run deploy
```

## API

| Method | Path              | Description                              |
| ------ | ----------------- | ---------------------------------------- |
| GET    | `/api/photos`     | List uploaded photos (newest first)      |
| POST   | `/api/photos`     | Upload a JPEG/PNG/WebP body (max 5 MB)   |
| GET    | `/photos/:id`     | Fetch one photo                          |
| DELETE | `/api/photos/:id` | Delete one photo                         |
