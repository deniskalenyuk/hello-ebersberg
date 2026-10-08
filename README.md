# hello-ebersberg

A minimal [Hono](https://hono.dev) app running on Cloudflare Workers. The page
can take a photo with the device camera and upload it; photos are stored in
Workers KV and can be deleted again from the page.

```
npm install
npm run cf-typegen
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
