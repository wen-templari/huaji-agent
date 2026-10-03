import type { DeliveredMessage, ToolDefinition } from '@flue/runtime';
import * as v from 'valibot';
import type { HuajiBotBindings } from './bindings.ts';
import { createHuajiBotClient } from './client.ts';
import { createReplyPublisher } from './publishers.ts';
import { createReplyToHuajiBotTool } from './tools.ts';

export const huajiInitialDataSchema = v.strictObject({
  conversationId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(1024), v.regex(/^huajibot:/)),
  destination: v.strictObject({
    bridgeInstance: v.pipe(v.string(), v.nonEmpty(), v.maxLength(512)),
    robotId: v.nullable(v.pipe(v.string(), v.nonEmpty(), v.maxLength(512))),
    groupId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(512)),
  }),
});

interface ChannelAgentCapabilities {
  instructions: string;
  tools: ToolDefinition[];
}

export function createHuajiBotAgentCapabilities(
  initialData: v.InferOutput<typeof huajiInitialDataSchema>,
  delivery: DeliveredMessage,
  bindings: HuajiBotBindings,
): ChannelAgentCapabilities {
  const replyToMessageId = delivery.kind === 'signal' ? delivery.attributes?.messageId : undefined;

  if (!replyToMessageId) {
    return {
      instructions:
        'You are the HuaJiBot assistant in a local debugging chat. Reply directly with concise Markdown.',
      tools: [],
    };
  }

  const client = createHuajiBotClient(createReplyPublisher(bindings));
  return {
    instructions: [
      'You are the HuaJiBot assistant.',
      'The current delivery is a message from a group conversation.',
      'Answer the message by calling reply_to_huajibot exactly once with concise Markdown.',
      'Never invent or ask for a bridge, robot, group, conversation, credential, or message identifier.',
    ].join(' '),
    tools: [
      createReplyToHuajiBotTool(
        {
          ...initialData,
          replyToMessageId,
        },
        client,
      ),
    ],
  };
}
