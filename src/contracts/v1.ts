import { z } from 'zod';

export const CONTRACT_VERSION = 1 as const;

const identifierV1Schema = z.string().min(1).max(512);
const nullableIdentifierV1Schema = identifierV1Schema.nullable();
const conversationIdV1Schema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^huajibot:/);
const dateTimeV1Schema = z.iso.datetime({ offset: true }).max(64);

export const destinationV1Schema = z.strictObject({
  bridgeInstance: identifierV1Schema,
  robotId: nullableIdentifierV1Schema,
  groupId: identifierV1Schema,
});

export const ingressMessageV1Schema = z.strictObject({
  messageId: identifierV1Schema,
  senderId: identifierV1Schema,
  senderName: z.string().max(512),
  text: z.string().min(1).max(16_384),
});

export const replyContextV1Schema = z.strictObject({
  messageId: nullableIdentifierV1Schema,
  senderId: nullableIdentifierV1Schema,
  content: z.string().max(8192).nullable(),
});

export const ingressEventV1Schema = z.strictObject({
  version: z.literal(CONTRACT_VERSION),
  eventId: identifierV1Schema,
  conversationId: conversationIdV1Schema,
  destination: destinationV1Schema,
  message: ingressMessageV1Schema,
  replyTo: replyContextV1Schema.nullable().optional(),
  occurredAt: dateTimeV1Schema,
});

export const replyDestinationV1Schema = destinationV1Schema.extend({
  replyToMessageId: identifierV1Schema,
});

export const replyJobV1Schema = z.strictObject({
  version: z.literal(CONTRACT_VERSION),
  jobId: z.uuid().max(64),
  conversationId: conversationIdV1Schema,
  destination: replyDestinationV1Schema,
  content: z.strictObject({
    format: z.literal('markdown'),
    text: z.string().min(1).max(65_536),
  }),
  createdAt: dateTimeV1Schema,
});

export type DestinationV1 = z.infer<typeof destinationV1Schema>;
export type IngressMessageV1 = z.infer<typeof ingressMessageV1Schema>;
export type ReplyContextV1 = z.infer<typeof replyContextV1Schema>;
export type IngressEventV1 = z.infer<typeof ingressEventV1Schema>;
export type ReplyDestinationV1 = z.infer<typeof replyDestinationV1Schema>;
export type ReplyJobV1 = z.infer<typeof replyJobV1Schema>;
