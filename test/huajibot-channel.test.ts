import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type AgentDispatchRequest,
  createChannelRouter,
  type DispatchReceipt,
} from '@flue/runtime';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
  createHuajiBotChannel,
  type HuajiBotBindings,
  type SafeChannelError,
} from '../src/integrations/huajibot/channel.ts';
import type { IngressEventV1 } from '../src/contracts/v1.ts';

const signingSecret = 'test-only-signing-secret';
const nowMilliseconds = Date.parse('2026-09-27T12:00:30Z');
const timestamp = String(Math.floor(nowMilliseconds / 1000));
const examplePath = path.resolve(import.meta.dirname, '../contracts/v1/examples/ingress.json');

async function exampleEvent(): Promise<IngressEventV1> {
  return JSON.parse(await readFile(examplePath, 'utf8')) as IngressEventV1;
}

function sign(body: string, requestTimestamp = timestamp): string {
  return `v1=${createHmac('sha256', signingSecret).update(`${requestTimestamp}.${body}`).digest('hex')}`;
}

function bindingsFor(event: IngressEventV1): HuajiBotBindings {
  return {
    HUAJIBOT_ALLOWED_DESTINATIONS: JSON.stringify([event.destination]),
    HUAJIBOT_OUTBOUND: { send: vi.fn() } as unknown as Queue<string>,
    HUAJIBOT_REPLY_CAPTURES: {} as HuajiBotBindings['HUAJIBOT_REPLY_CAPTURES'],
    HUAJIBOT_REPLY_TRANSPORT: 'queue',
    HUAJIBOT_SIGNING_SECRET: signingSecret,
  };
}

function receipt(deduplicated = false): DispatchReceipt {
  return {
    submissionId: 'sub_test',
    acceptedAt: '2026-09-27T12:00:30.000Z',
    uid: 'instance_test',
    ...(deduplicated ? { deduplicated: true as const } : {}),
  };
}

function post(
  channel: ReturnType<typeof createHuajiBotChannel>,
  body: string,
  env: HuajiBotBindings,
  overrides: { signature?: string; timestamp?: string } = {},
) {
  const app = createChannelRouter(channel.routes);
  const requestTimestamp = overrides.timestamp ?? timestamp;
  return app.request(
    '/events',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-huajibot-signature': overrides.signature ?? sign(body, requestTimestamp),
        'x-huajibot-timestamp': requestTimestamp,
      },
      body,
    },
    env,
  );
}

describe('HuaJiBot channel', () => {
  it('verifies and dispatches a valid exact-body request', async () => {
    const event = await exampleEvent();
    const requests: AgentDispatchRequest[] = [];
    const app = createHuajiBotChannel({
      now: () => nowMilliseconds,
      async dispatchEvent(request) {
        requests.push(request);
        return receipt();
      },
    });

    const response = await post(app, JSON.stringify(event), bindingsFor(event));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: true,
      deduplicated: false,
      submissionId: 'sub_test',
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      id: event.conversationId,
      idempotencyKey: event.eventId,
      initialData: {
        conversationId: event.conversationId,
        destination: event.destination,
      },
      message: {
        kind: 'signal',
        type: 'huajibot.message',
        attributes: {
          eventId: event.eventId,
          messageId: event.message.messageId,
          senderId: event.message.senderId,
        },
      },
    });
  });

  it.each([
    ['modified body', 'modified'],
    ['invalid signature', 'signature'],
    ['malformed timestamp', 'timestamp'],
    ['stale timestamp', 'stale'],
  ])('rejects %s before dispatch', async (_name, scenario) => {
    const event = await exampleEvent();
    const originalBody = JSON.stringify(event);
    const dispatchEvent = vi.fn(async () => receipt());
    const app = createHuajiBotChannel({ dispatchEvent, now: () => nowMilliseconds });
    let body = originalBody;
    let requestTimestamp = timestamp;
    let signature = sign(originalBody);

    if (scenario === 'modified') body = originalBody.replace('Question', 'Changed question');
    if (scenario === 'signature') signature = `v1=${'0'.repeat(64)}`;
    if (scenario === 'timestamp') requestTimestamp = 'not-a-timestamp';
    if (scenario === 'stale') {
      requestTimestamp = String(Number(timestamp) - 301);
      signature = sign(body, requestTimestamp);
    }

    const response = await post(app, body, bindingsFor(event), {
      signature,
      timestamp: requestTimestamp,
    });

    expect(response.status).toBe(401);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported version', (event: Record<string, unknown>) => ({ ...event, version: 2 })],
    ['unknown field', (event: Record<string, unknown>) => ({ ...event, unexpected: true })],
  ])('rejects an event with an %s', async (_name, mutate) => {
    const event = await exampleEvent();
    const body = JSON.stringify(mutate(event as unknown as Record<string, unknown>));
    const dispatchEvent = vi.fn(async () => receipt());
    const app = createHuajiBotChannel({ dispatchEvent, now: () => nowMilliseconds });

    const response = await post(app, body, bindingsFor(event));

    expect(response.status).toBe(400);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('rejects a destination outside the tuple allowlist', async () => {
    const event = await exampleEvent();
    const env = bindingsFor(event);
    env.HUAJIBOT_ALLOWED_DESTINATIONS = JSON.stringify([
      { ...event.destination, groupId: 'another-group' },
    ]);
    const dispatchEvent = vi.fn(async () => receipt());
    const app = createHuajiBotChannel({ dispatchEvent, now: () => nowMilliseconds });

    const response = await post(app, JSON.stringify(event), env);

    expect(response.status).toBe(403);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('uses a stable idempotency key so a duplicate event admits one turn', async () => {
    const event = await exampleEvent();
    const admitted = new Set<string>();
    let turns = 0;
    const app = createHuajiBotChannel({
      now: () => nowMilliseconds,
      async dispatchEvent(request) {
        const key = `${request.id}:${request.idempotencyKey}`;
        const duplicate = admitted.has(key);
        if (!duplicate) {
          admitted.add(key);
          turns += 1;
        }
        return receipt(duplicate);
      },
    });
    const body = JSON.stringify(event);
    const env = bindingsFor(event);

    const first = await post(app, body, env);
    const second = await post(app, body, env);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(await second.json()).toMatchObject({ deduplicated: true });
    expect(turns).toBe(1);
  });

  it('emits only bounded metadata when dispatch fails', async () => {
    const event = await exampleEvent();
    const logs: SafeChannelError[] = [];
    const app = createHuajiBotChannel({
      now: () => nowMilliseconds,
      logError: (entry) => logs.push(entry),
      async dispatchEvent() {
        throw new Error('upstream failure');
      },
    });
    const body = JSON.stringify(event);
    const requestSignature = sign(body);

    const response = await post(app, body, bindingsFor(event), { signature: requestSignature });
    const serializedLogs = JSON.stringify(logs);

    expect(response.status).toBe(503);
    expect(logs).toEqual([{ event: 'huajibot.dispatch_failed', eventId: event.eventId }]);
    expect(serializedLogs).not.toContain(signingSecret);
    expect(serializedLogs).not.toContain(requestSignature);
    expect(serializedLogs).not.toContain(event.message.text);
  });

  it('uses Flue channel routing semantics for unsupported methods', async () => {
    const event = await exampleEvent();
    const channel = createHuajiBotChannel({ dispatchEvent: async () => receipt() });
    const app = createChannelRouter(channel.routes);

    const response = await app.request('/events', { method: 'GET' }, bindingsFor(event));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await response.json()).toMatchObject({ error: { type: 'method_not_allowed' } });
  });
});
