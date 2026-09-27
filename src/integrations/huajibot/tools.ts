import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import type { HuajiBotClient, HuajiBotReplyReference } from './client.ts';

export function createReplyToHuajiBotTool(context: HuajiBotReplyReference, client: HuajiBotClient) {
  return defineTool({
    name: 'reply_to_huajibot',
    description: 'Send the final answer to the HuaJiBot conversation bound to this agent.',
    input: v.strictObject({
      text: v.pipe(v.string(), v.nonEmpty(), v.maxLength(65_536)),
    }),
    async run({ data }) {
      const job = await client.reply(context, data.text);
      return { output: { jobId: job.jobId }, terminate: true };
    },
  });
}
