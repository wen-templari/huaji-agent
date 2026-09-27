import { describe, expect, it } from 'vite-plus/test';
import { replyJobV1Schema } from '../src/contracts/v1.ts';
import { publishReplyToHuajiBot, type TextQueue } from '../src/tools/reply-to-huajibot.ts';

describe('reply_to_huajibot Queue production', () => {
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

    const first = await publishReplyToHuajiBot(context, 'First answer', queue, {
      now: () => new Date('2026-09-27T12:01:00Z'),
      randomUUID: () => '0199a123-4567-789a-8bcd-ef0123456789',
    });
    const second = await publishReplyToHuajiBot(context, 'Second answer', queue, {
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
});
