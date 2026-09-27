import { createChannelRouter, dispatch } from '@flue/runtime';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Huaji } from './agents/huaji.ts';
import { createHuajiBotChannel, type HuajiBotBindings } from './integrations/huajibot/channel.ts';

const app = new Hono<{ Bindings: HuajiBotBindings }>();

app.get('/health', (context) => context.json({ service: 'huaji-agent', status: 'ok' }));
if (import.meta.env.DEV) {
  app.use('/api/debug/huaji/*', async (context, next) => {
    const id = context.req.path.slice('/api/debug/huaji/'.length).split('/')[0];
    if (!id?.startsWith('debug-')) return context.notFound();
    await next();
  });
  app.route('/api/debug/huaji', createAgentRouter(Huaji));
}
app.route(
  '/channels/huajibot',
  createChannelRouter(
    createHuajiBotChannel({
      dispatchEvent: (request) => dispatch(Huaji, request),
    }).routes,
  ),
);

export default app;
