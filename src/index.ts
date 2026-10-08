import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hello from Ebersberg</title>
  </head>
  <body>
    <h1>Hello from Ebersberg</h1>
  </body>
</html>`)
})

export default app
