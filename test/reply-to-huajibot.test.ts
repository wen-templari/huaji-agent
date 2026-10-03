import { describe, expect, it } from 'vite-plus/test';
import { replyJobV1Schema, type ReplyJobV1 } from '../src/contracts/v1.ts';
import { publishReplyToHuajiBot } from '../src/integrations/huajibot/client.ts';
import {
  createCapturedReplyPublisher,
  createQueueReplyPublisher,
  type TextQueue,
} from '../src/integrations/huajibot/publishers.ts';

describe('reply_to_huajibot publishers', () => {
  it('publishes validated text jobs to the trusted current destination', async () => {
    const messages: Array<{ body: string; options: QueueSendOptions | undefined }> = [];
    const queue: TextQueue = {
      async send(body, options) {
        messages.push({ body, options });
        return {
          metadata: {
            metrics: { backlogBytes: 0, backlogCount: messages.length },
          },
        };
      },
    };
    const context = {
      conversationId: 'huajibot:main:123:456:message-789',
      destination: { bridgeInstance: 'main', robotId: '123', groupId: '456' },
      replyToMessageId: 'current-message-900',
    };

    const publisher = createQueueReplyPublisher(queue);
    const first = await publishReplyToHuajiBot(context, 'First answer', publisher, {
      now: () => new Date('2026-09-27T12:01:00Z'),
      randomUUID: () => '0199a123-4567-789a-8bcd-ef0123456789',
    });
    const second = await publishReplyToHuajiBot(context, 'Second answer', publisher, {
      now: () => new Date('2026-09-27T12:02:00Z'),
      randomUUID: () => '0199a123-4567-789a-8bcd-ef0123456790',
    });

    expect(first.jobId).not.toBe(second.jobId);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.options).toEqual({ contentType: 'text' });
    expect(replyJobV1Schema.parse(JSON.parse(messages[0]?.body ?? ''))).toEqual(first);
    expect(first).toMatchObject({
      conversationId: context.conversationId,
      destination: {
        ...context.destination,
        replyToMessageId: 'current-message-900',
      },
      content: { format: 'markdown', text: 'First answer' },
    });
  });

  it('sends the same validated job through the development capture publisher', async () => {
    const captures: ReplyJobV1[] = [];
    const publisher = createCapturedReplyPublisher({
      getByName(name) {
        expect(name).toBe('development');
        return {
          async capture(job) {
            captures.push(replyJobV1Schema.parse(job));
          },
        };
      },
    });

    const job = await publishReplyToHuajiBot(
      {
        conversationId: 'huajibot:main:123:456:message-789',
        destination: { bridgeInstance: 'main', robotId: '123', groupId: '456' },
        replyToMessageId: 'current-message-900',
      },
      'Captured answer',
      publisher,
      {
        now: () => new Date('2026-09-27T12:03:00Z'),
        randomUUID: () => '0199a123-4567-789a-8bcd-ef0123456791',
      },
    );

    expect(captures).toEqual([job]);
  });
});
