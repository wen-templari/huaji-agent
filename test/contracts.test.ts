import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { createConversationId, createEventId } from '../src/contracts/identifiers.ts';
import { createContractJsonSchemas } from '../src/contracts/json-schema.ts';
import { ingressEventV1Schema, replyJobV1Schema } from '../src/contracts/v1.ts';

const contractsRoot = path.resolve(import.meta.dirname, '../contracts/v1');

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(contractsRoot, relativePath), 'utf8'));
}

describe('version-one contracts', () => {
  it.each([
    [ingressEventV1Schema, 'examples/ingress.json'],
    [replyJobV1Schema, 'examples/reply-job.json'],
  ])('validates its example with Zod', async (schema, examplePath) => {
    expect(schema.safeParse(await readJson(examplePath))).toMatchObject({
      success: true,
    });
  });

  it('keeps committed JSON Schemas synchronized with Zod', async () => {
    const generated = createContractJsonSchemas();

    expect(await readJson('ingress.schema.json')).toEqual(generated.ingress);
    expect(await readJson('reply-job.schema.json')).toEqual(generated.replyJob);
  });

  it('reproduces the public HMAC interoperability vector', async () => {
    const vector = (await readJson('test-vectors/hmac-sha256.json')) as {
      secretUtf8: string;
      timestamp: string;
      bodyFile: string;
      expectedSignatureHex: string;
    };
    const bodyPath = path.resolve(contractsRoot, 'test-vectors', vector.bodyFile);
    const body = await readFile(bodyPath);
    const digest = createHmac('sha256', vector.secretUtf8)
      .update(vector.timestamp)
      .update('.')
      .update(body)
      .digest('hex');

    expect(digest).toBe(vector.expectedSignatureHex);
  });

  it('encodes opaque IDs without losing Telegram topic separators', () => {
    const input = {
      bridgeInstance: 'main',
      robotId: null,
      groupId: '-100123:42',
      messageId: 'message/789',
    };

    expect(createEventId(input)).toBe('main:default:-100123%3A42:message%2F789');
    expect(createConversationId({ ...input, rootMessageId: input.messageId })).toBe(
      'huajibot:main:default:-100123%3A42:message%2F789',
    );
  });
});
