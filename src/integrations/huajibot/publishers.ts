import type { ReplyJobV1 } from '../../contracts/v1.ts';
import type { HuajiBotBindings } from './bindings.ts';
import type { ReplyPublisher } from './client.ts';

export type TextQueue = Pick<Queue<string>, 'send'>;

export function createQueueReplyPublisher(queue: TextQueue): ReplyPublisher {
  return {
    async publish(job) {
      await queue.send(JSON.stringify(job), { contentType: 'text' });
    },
  };
}

interface ReplyCaptureStub {
  capture(job: ReplyJobV1): Promise<void>;
}

interface ReplyCaptureNamespace {
  getByName(name: string): ReplyCaptureStub;
}

export function createCapturedReplyPublisher(captures: ReplyCaptureNamespace): ReplyPublisher {
  const sink = captures.getByName('development');
  return {
    publish: (job) => sink.capture(job),
  };
}

export function createReplyPublisher(bindings: HuajiBotBindings): ReplyPublisher {
  switch (bindings.HUAJIBOT_REPLY_TRANSPORT) {
    case 'capture':
      return createCapturedReplyPublisher(bindings.HUAJIBOT_REPLY_CAPTURES);
    case 'queue':
      return createQueueReplyPublisher(bindings.HUAJIBOT_OUTBOUND);
    default:
      throw new Error('HUAJIBOT_REPLY_TRANSPORT must be capture or queue');
  }
}
