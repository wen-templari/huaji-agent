# HuaJiBot bridge contracts

The `v1` directory is the canonical wire contract between HuaJiBot.NET and this Worker. The Worker validates runtime data with the Zod schemas in `src/contracts/v1.ts`; `npm run contracts:generate` produces the committed JSON Schema artifacts consumed by other languages. Tests fail if those artifacts drift from Zod.

## Ingress request

- Method: `POST`
- Media type: `application/json`
- Timestamp header: `X-HuaJiBot-Timestamp`, Unix seconds in base 10
- Signature header: `X-HuaJiBot-Signature`, formatted as `v1=<64 lowercase hex characters>`
- Signed bytes: the UTF-8 bytes of `<timestamp>.<raw request body>`
- Algorithm: HMAC-SHA256
- Default freshness window: five minutes in either direction

The receiver must authenticate the raw body before parsing JSON. It must compare signatures in constant time, validate the schema, allowlist the bridge and destination, and reject a previously accepted `(bridgeInstance, eventId)` within the replay-retention window.

The included test vector uses an intentionally public test secret. It must never be reused outside tests.

## Identifiers

All platform identifiers are opaque strings. Do not parse `groupId`; Telegram may represent a topic as `chatId:topicId`.

HuaJiBot.NET constructs conversation IDs as:

```text
huajibot:<bridgeInstance>:<robotId-or-default>:<groupId>:<rootMessageId>
```

Each component after `huajibot` is UTF-8 percent-encoded with JavaScript `encodeURIComponent` semantics. A missing `robotId` uses the literal `default` before encoding. Consumers treat the resulting conversation ID as opaque and never recover routing fields from it.

Recommended event IDs are similarly stable and deterministic:

```text
<encoded-bridge>:<encoded-robot-or-default>:<encoded-group>:<encoded-message>
```

## Reply jobs

The Worker publishes the serialized reply job as Cloudflare Queue `text` content containing JSON. HuaJiBot.NET validates the job before delivery, deduplicates it by `jobId`, sends it through the selected adapter, records all returned message IDs, and only then acknowledges the Queue lease.

Malformed, unsupported, or unauthorized jobs are poison messages and should be logged without private content and acknowledged. Transient adapter and network failures should be retried.

## Compatibility

Schemas reject unknown properties. Additive or breaking wire changes require a new integer `version` and a new schema directory. Do not silently change a deployed version-one field.

Version-one timestamps use the RFC 3339 form emitted by `DateTimeOffset`/`Date` serializers, including seconds and either `Z` or a colon-delimited numeric offset. Reply `jobId` values are canonical UUIDs produced by `crypto.randomUUID()` or an equivalent implementation.
