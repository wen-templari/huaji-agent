import { createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { setProvider } from '@flue/runtime';

const PROVIDER_ID = 'huaji-openai';

function requiredVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name} configuration`);
  return value;
}

function nonNegativeIntegerVariable(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

const baseUrl = requiredVariable('HUAJI_MODEL_BASE_URL').replace(/\/$/, '');
const modelId = requiredVariable('HUAJI_MODEL_ID');
const api = requiredVariable('HUAJI_MODEL_API');

if (api !== 'openai-completions') {
  throw new Error('HUAJI_MODEL_API must be openai-completions');
}

setProvider(
  createProvider({
    id: PROVIDER_ID,
    auth: { apiKey: envApiKeyAuth('HuaJi model API key', ['HUAJI_MODEL_API_KEY']) },
    models: [
      {
        id: modelId,
        name: modelId,
        api: 'openai-completions',
        provider: PROVIDER_ID,
        baseUrl,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: nonNegativeIntegerVariable('HUAJI_MODEL_CONTEXT_WINDOW', 0),
        maxTokens: nonNegativeIntegerVariable('HUAJI_MODEL_MAX_OUTPUT_TOKENS', 4096),
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
          supportsUsageInStreaming: false,
          supportsStrictMode: false,
          maxTokensField: 'max_tokens',
        },
      },
    ],
    api: openAICompletionsApi(),
  }),
);

export const huajiModelSpecifier = `${PROVIDER_ID}/${modelId}`;
