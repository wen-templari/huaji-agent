import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { createConversationId, createEventId } from '../src/contracts/identifiers.ts';
import {
  destinationV1Schema,
  ingressEventV1Schema,
  replyJobV1Schema,
} from '../src/contracts/v1.ts';

const captureResponseSchema = z.strictObject({ replies: z.array(replyJobV1Schema) });

function requiredVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name} configuration`);
  return value;
}

function firstAllowedDestination() {
  const allowlist = z
    .array(destinationV1Schema)
    .min(1)
    .parse(JSON.parse(requiredVariable('HUAJIBOT_ALLOWED_DESTINATIONS')));
  const destination = allowlist[0];
  if (!destination) throw new Error('HUAJIBOT_ALLOWED_DESTINATIONS must not be empty');
  return destination;
}

async function responseJson(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  return body.length > 0 ? JSON.parse(body) : null;
}

const baseUrl = (process.env.HUAJI_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const timeoutMilliseconds = Number(process.env.HUAJI_SMOKE_TIMEOUT_MS ?? 120_000);
if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
  throw new Error('HUAJI_SMOKE_TIMEOUT_MS must be a positive integer');
}

const destination = firstAllowedDestination();
const messageId = `smoke-${randomUUID()}`;
const conversationId = createConversationId({ ...destination, rootMessageId: messageId });
const event = ingressEventV1Schema.parse({
  version: 1,
  eventId: createEventId({ ...destination, messageId }),
  conversationId,
  destination,
  message: {
    messageId,
    senderId: 'development-smoke-test',
    senderName: 'Development smoke test',
    text: 'Reply with a short confirmation that the HuaJi agent smoke test succeeded.',
  },
  replyTo: null,
  occurredAt: new Date().toISOString(),
});

await responseJson(
  await fetch(`${baseUrl}/api/debug/huajibot/replies`, {
    method: 'DELETE',
  }),
);

const body = JSON.stringify(event);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac('sha256', requiredVariable('HUAJIBOT_SIGNING_SECRET'))
  .update(`${timestamp}.${body}`)
  .digest('hex');
const accepted = await responseJson(
  await fetch(`${baseUrl}/channels/huajibot/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-huajibot-signature': `v1=${signature}`,
      'x-huajibot-timestamp': timestamp,
    },
    body,
  }),
);

console.log('Signed ingress accepted:', accepted);

const deadline = Date.now() + timeoutMilliseconds;
while (Date.now() < deadline) {
  const captured = captureResponseSchema.parse(
    await responseJson(await fetch(`${baseUrl}/api/debug/huajibot/replies`)),
  );
  const reply = captured.replies.find((candidate) => candidate.conversationId === conversationId);
  if (reply) {
    console.log('Validated captured reply:', JSON.stringify(reply, null, 2));
    process.exit(0);
  }
  await delay(1_000);
}

throw new Error(`No captured reply arrived within ${timeoutMilliseconds}ms`);
