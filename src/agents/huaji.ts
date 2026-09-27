'use agent';

import { env } from 'cloudflare:workers';
import { useDelivery, useInitialData, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import type { HuajiBotBindings } from '../channels/huajibot.ts';
import { huajiModelSpecifier } from '../providers/huaji-openai.ts';
import { createReplyToHuajiBotTool, huajiInitialDataSchema } from '../tools/reply-to-huajibot.ts';

export function Huaji() {
  useModel(huajiModelSpecifier);

  const initialData = useInitialData<v.InferOutput<typeof huajiInitialDataSchema>>();
  const delivery = useDelivery();
  const replyToMessageId = delivery.kind === 'signal' ? delivery.attributes?.messageId : undefined;

  if (replyToMessageId) {
    const bindings = env as unknown as HuajiBotBindings;
    useTool(
      createReplyToHuajiBotTool(
        {
          ...initialData,
          replyToMessageId,
        },
        bindings.HUAJIBOT_OUTBOUND,
      ),
    );
  }

  return replyToMessageId
    ? [
        'You are the HuaJiBot assistant.',
        'The current delivery is a message from a group conversation.',
        'Answer the message by calling reply_to_huajibot exactly once with concise Markdown.',
        'Never invent or ask for a bridge, robot, group, conversation, credential, or message identifier.',
      ].join(' ')
    : 'You are the HuaJiBot assistant in a local debugging chat. Reply directly with concise Markdown.';
}

Huaji.initialData = huajiInitialDataSchema;
