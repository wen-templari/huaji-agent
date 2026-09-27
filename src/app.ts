import { dispatch } from '@flue/runtime';
import { Hono } from 'hono';
import { Huaji } from './agents/huaji.ts';
import { createHuajiBotChannel, type HuajiBotBindings } from './channels/huajibot.ts';

const app = new Hono<{ Bindings: HuajiBotBindings }>();

app.get('/health', (context) => context.json({ service: 'huaji-agent', status: 'ok' }));
app.route(
  '/channels/huajibot',
  createHuajiBotChannel({
    dispatchEvent: (request) => dispatch(Huaji, request),
  }),
);

export default app;
