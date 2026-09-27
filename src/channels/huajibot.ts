import {
  type AgentDispatchRequest,
  type DispatchReceipt,
  SubmissionConflictError,
} from '@flue/runtime';
import { Hono } from 'hono';
import { z } from 'zod';
import { destinationV1Schema, ingressEventV1Schema } from '../contracts/v1.ts';

const SIGNATURE_PATTERN = /^v1=([0-9a-f]{64})$/;
const TIMESTAMP_PATTERN = /^(0|[1-9][0-9]{0,15})$/;
const DEFAULT_FRESHNESS_SECONDS = 5 * 60;
const MAX_INGRESS_BYTES = 128 * 1024;
const allowedDestinationsSchema = z.array(destinationV1Schema).min(1);

export interface HuajiBotBindings {
  HUAJIBOT_ALLOWED_DESTINATIONS: string;
  HUAJIBOT_OUTBOUND: Queue<string>;
  HUAJIBOT_SIGNING_SECRET: string;
}

export interface SafeChannelError {
  event: 'huajibot.dispatch_failed';
  eventId: string;
}

interface ChannelOptions {
  dispatchEvent(request: AgentDispatchRequest): Promise<DispatchReceipt>;
  freshnessSeconds?: number;
  logError?: (entry: SafeChannelError) => void;
  now?: () => number;
}

function errorResponse(code: string, status: 400 | 401 | 403 | 409 | 413 | 415 | 500 | 503) {
  return Response.json({ error: { code } }, { status });
}

function decodeHex(value: string): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer;
}

async function verifySignature(input: {
  body: Uint8Array;
  secret: string;
  signature: string;
  timestamp: string;
}): Promise<boolean> {
  const match = SIGNATURE_PATTERN.exec(input.signature);
  if (!match?.[1] || input.secret.length === 0) return false;

  const encoder = new TextEncoder();
  const prefix = encoder.encode(`${input.timestamp}.`);
  const signedBytes = new Uint8Array(new ArrayBuffer(prefix.length + input.body.length));
  signedBytes.set(prefix);
  signedBytes.set(input.body, prefix.length);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify('HMAC', key, decodeHex(match[1]), signedBytes.buffer);
}

function destinationKey(destination: z.infer<typeof destinationV1Schema>): string {
  return JSON.stringify([destination.bridgeInstance, destination.robotId, destination.groupId]);
}

function isAllowedDestination(
  serializedAllowlist: string,
  destination: z.infer<typeof destinationV1Schema>,
) {
  const allowlist = allowedDestinationsSchema.safeParse(JSON.parse(serializedAllowlist));
  if (!allowlist.success) throw new Error('Invalid HUAJIBOT_ALLOWED_DESTINATIONS configuration');

  const requested = destinationKey(destination);
  return allowlist.data.some((allowed) => destinationKey(allowed) === requested);
}

export function createHuajiBotChannel(options: ChannelOptions) {
  const channel = new Hono<{ Bindings: HuajiBotBindings }>();
  const freshnessSeconds = options.freshnessSeconds ?? DEFAULT_FRESHNESS_SECONDS;
  const now = options.now ?? Date.now;
  const logError = options.logError ?? ((entry) => console.error(entry));

  channel.post('/events', async (context) => {
    const mediaType = context.req.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (mediaType !== 'application/json') return errorResponse('unsupported_media_type', 415);

    const contentLength = Number(context.req.header('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_INGRESS_BYTES) {
      return errorResponse('payload_too_large', 413);
    }

    const timestamp = context.req.header('x-huajibot-timestamp') ?? '';
    const signature = context.req.header('x-huajibot-signature') ?? '';
    if (!TIMESTAMP_PATTERN.test(timestamp)) return errorResponse('invalid_authentication', 401);

    const timestampSeconds = Number(timestamp);
    const currentSeconds = Math.floor(now() / 1000);
    if (
      !Number.isSafeInteger(timestampSeconds) ||
      Math.abs(currentSeconds - timestampSeconds) > freshnessSeconds
    ) {
      return errorResponse('invalid_authentication', 401);
    }

    const body = new Uint8Array(await context.req.arrayBuffer());
    if (body.byteLength > MAX_INGRESS_BYTES) return errorResponse('payload_too_large', 413);

    const secret = context.env.HUAJIBOT_SIGNING_SECRET;
    if (typeof secret !== 'string' || secret.length === 0) {
      return errorResponse('service_not_configured', 500);
    }

    if (!(await verifySignature({ body, secret, signature, timestamp }))) {
      return errorResponse('invalid_authentication', 401);
    }

    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    } catch {
      return errorResponse('invalid_json', 400);
    }

    const parsed = ingressEventV1Schema.safeParse(json);
    if (!parsed.success) return errorResponse('invalid_event', 400);
    const event = parsed.data;

    try {
      if (!isAllowedDestination(context.env.HUAJIBOT_ALLOWED_DESTINATIONS, event.destination)) {
        return errorResponse('destination_not_allowed', 403);
      }
    } catch {
      return errorResponse('service_not_configured', 500);
    }

    try {
      const receipt = await options.dispatchEvent({
        id: event.conversationId,
        idempotencyKey: event.eventId,
        initialData: {
          conversationId: event.conversationId,
          destination: event.destination,
        },
        message: {
          kind: 'signal',
          type: 'huajibot.message',
          body: JSON.stringify({ message: event.message, replyTo: event.replyTo ?? null }),
          attributes: {
            eventId: event.eventId,
            messageId: event.message.messageId,
            senderId: event.message.senderId,
          },
        },
      });

      return context.json(
        {
          accepted: true,
          deduplicated: receipt.deduplicated === true,
          submissionId: receipt.submissionId,
        },
        202,
      );
    } catch (error) {
      if (error instanceof SubmissionConflictError) {
        return errorResponse('submission_conflict', 409);
      }
      logError({ event: 'huajibot.dispatch_failed', eventId: event.eventId });
      return errorResponse('dispatch_unavailable', 503);
    }
  });

  return channel;
}
