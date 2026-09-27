import type { DestinationV1, ReplyJobV1 } from '../../contracts/v1.ts';
import { replyJobV1Schema } from '../../contracts/v1.ts';

export interface HuajiBotReplyReference {
  conversationId: string;
  destination: DestinationV1;
  replyToMessageId: string;
}

export type TextQueue = Pick<Queue<string>, 'send'>;

interface ReplyDependencies {
  now?: () => Date;
  randomUUID?: () => `${string}-${string}-${string}-${string}-${string}`;
}

export interface HuajiBotClient {
  reply(context: HuajiBotReplyReference, text: string): Promise<ReplyJobV1>;
}

export async function publishReplyToHuajiBot(
  context: HuajiBotReplyReference,
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

export function createHuajiBotClient(
  queue: TextQueue,
  dependencies: ReplyDependencies = {},
): HuajiBotClient {
  return {
    reply: (context, text) => publishReplyToHuajiBot(context, text, queue, dependencies),
  };
}
