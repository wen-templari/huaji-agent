import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import type { DestinationV1, ReplyJobV1 } from '../contracts/v1.ts';
import { replyJobV1Schema } from '../contracts/v1.ts';

export interface HuajiInitialData {
  conversationId: string;
  destination: DestinationV1;
}

export type TextQueue = Pick<Queue<string>, 'send'>;

interface ReplyContext extends HuajiInitialData {
  replyToMessageId: string;
}

interface ReplyDependencies {
  now?: () => Date;
  randomUUID?: () => `${string}-${string}-${string}-${string}-${string}`;
}

export const huajiInitialDataSchema = v.strictObject({
  conversationId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(1024), v.regex(/^huajibot:/)),
  destination: v.strictObject({
    bridgeInstance: v.pipe(v.string(), v.nonEmpty(), v.maxLength(512)),
    robotId: v.nullable(v.pipe(v.string(), v.nonEmpty(), v.maxLength(512))),
    groupId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(512)),
  }),
});

export async function publishReplyToHuajiBot(
  context: ReplyContext,
  text: string,
  queue: TextQueue,
  dependencies: ReplyDependencies = {},
): Promise<ReplyJobV1> {
  const job = replyJobV1Schema.parse({
    version: 1,
    jobId: (dependencies.randomUUID ?? (() => crypto.randomUUID()))(),
    conversationId: context.conversationId,
    destination: {
      ...context.destination,
      replyToMessageId: context.replyToMessageId,
    },
    content: { format: 'markdown', text },
    createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
  });

  await queue.send(JSON.stringify(job), { contentType: 'text' });
  return job;
}

export function createReplyToHuajiBotTool(context: ReplyContext, queue: TextQueue) {
  return defineTool({
    name: 'reply_to_huajibot',
    description: 'Send the final answer to the HuaJiBot conversation bound to this agent.',
    input: v.strictObject({
      text: v.pipe(v.string(), v.nonEmpty(), v.maxLength(65_536)),
    }),
    async run({ data }) {
      const job = await publishReplyToHuajiBot(context, data.text, queue);
      return { output: { jobId: job.jobId }, terminate: true };
    },
  });
}
