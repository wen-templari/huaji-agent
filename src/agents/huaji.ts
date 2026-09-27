'use agent';

import { env } from 'cloudflare:workers';
import { useDelivery, useInitialData, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import type { HuajiBotBindings } from '../integrations/huajibot/bindings.ts';
import {
  createHuajiBotAgentCapabilities,
  huajiInitialDataSchema,
} from '../integrations/huajibot/capabilities.ts';
import { huajiModelSpecifier } from '../providers/huaji-openai.ts';

export function Huaji() {
  useModel(huajiModelSpecifier);

  const initialData = useInitialData<v.InferOutput<typeof huajiInitialDataSchema>>();
  const delivery = useDelivery();
  const capabilities = createHuajiBotAgentCapabilities(
    initialData,
    delivery,
    env as unknown as HuajiBotBindings,
  );

  for (const tool of capabilities.tools) useTool(tool);
  return capabilities.instructions;
}

Huaji.initialData = huajiInitialDataSchema;
