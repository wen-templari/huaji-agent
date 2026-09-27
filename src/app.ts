import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (context) => context.json({ service: 'huaji-agent', status: 'ok' }));

export default app;
