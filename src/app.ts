import { createChannelRouter, dispatch } from '@flue/runtime';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Huaji } from './agents/huaji.ts';
import { replyJobV1Schema } from './contracts/v1.ts';
import { createHuajiBotChannel, type HuajiBotBindings } from './integrations/huajibot/channel.ts';

const app = new Hono<{ Bindings: HuajiBotBindings }>();

app.get('/health', (context) => context.json({ service: 'huaji-agent', status: 'ok' }));
if (import.meta.env.DEV) {
  app.get('/api/debug/huajibot/replies', async (context) => {
    const replies = await context.env.HUAJIBOT_REPLY_CAPTURES.getByName('development').list();
    return context.json({ replies: replies.map((reply) => replyJobV1Schema.parse(reply)) });
  });
  app.delete('/api/debug/huajibot/replies', async (context) => {
    const cleared = await context.env.HUAJIBOT_REPLY_CAPTURES.getByName('development').clear();
    return context.json({ cleared });
  });
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
