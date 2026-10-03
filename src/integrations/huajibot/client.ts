import type { DestinationV1, ReplyJobV1 } from '../../contracts/v1.ts';
import { replyJobV1Schema } from '../../contracts/v1.ts';

export interface HuajiBotReplyReference {
  conversationId: string;
  destination: DestinationV1;
  replyToMessageId: string;
}

interface ReplyDependencies {
  now?: () => Date;
  randomUUID?: () => `${string}-${string}-${string}-${string}-${string}`;
}

export interface HuajiBotClient {
  reply(context: HuajiBotReplyReference, text: string): Promise<ReplyJobV1>;
}

export interface ReplyPublisher {
  publish(job: ReplyJobV1): Promise<void>;
}

export function createReplyJob(
  context: HuajiBotReplyReference,
  text: string,
  dependencies: ReplyDependencies = {},
): ReplyJobV1 {
  return replyJobV1Schema.parse({
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
}

export async function publishReplyToHuajiBot(
  context: HuajiBotReplyReference,
  text: string,
  publisher: ReplyPublisher,
  dependencies: ReplyDependencies = {},
): Promise<ReplyJobV1> {
  const job = createReplyJob(context, text, dependencies);
  await publisher.publish(job);
  return job;
}

export function createHuajiBotClient(
  publisher: ReplyPublisher,
  dependencies: ReplyDependencies = {},
): HuajiBotClient {
  return {
    reply: (context, text) => publishReplyToHuajiBot(context, text, publisher, dependencies),
  };
}
