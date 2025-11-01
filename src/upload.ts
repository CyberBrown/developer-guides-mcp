import { processAndUploadGuides } from './guide-processor';
import { Hono } from 'hono';

const app = new Hono();

app.post('/upload', async (c) => {
  const { files } = await c.req.json();
  
  await processAndUploadGuides(files, {
    r2: c.env.GUIDES_BUCKET,
    db: c.env.DB,
    vectorize: c.env.VECTORIZE
  });
  
  return c.json({ success: true });
});

export default app;