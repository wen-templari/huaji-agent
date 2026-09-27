# Cloudflare provisioning for the HuaJiBot bridge

Repository configuration and Cloudflare account provisioning are intentionally separate.
`wrangler.jsonc` declares only the Worker producer binding. HTTP pull consumer settings
are account-level state and must be applied with Wrangler or the Cloudflare dashboard.

## Queue names

| Environment | Worker                    | Primary queue                        | Dead-letter queue                        |
| ----------- | ------------------------- | ------------------------------------ | ---------------------------------------- |
| Development | `huaji-agent-development` | `huajibot-outbound-main-development` | `huajibot-outbound-main-development-dlq` |
| Production  | `huaji-agent`             | `huajibot-outbound-main`             | `huajibot-outbound-main-dlq`             |

One primary queue is required per HuaJiBot deployment. Replace `main` consistently if a
second deployment is introduced; deployments must not share a pull-consumer queue.

## Create the development queues

```bash
npx wrangler queues create huajibot-outbound-main-development
npx wrangler queues create huajibot-outbound-main-development-dlq
npx wrangler queues consumer http add huajibot-outbound-main-development \
  --batch-size 5 \
  --visibility-timeout-secs 120 \
  --message-retries 5 \
  --retry-delay-secs 10 \
  --dead-letter-queue huajibot-outbound-main-development-dlq
```

## Create the production queues

```bash
npx wrangler queues create huajibot-outbound-main
npx wrangler queues create huajibot-outbound-main-dlq
npx wrangler queues consumer http add huajibot-outbound-main \
  --batch-size 5 \
  --visibility-timeout-secs 120 \
  --message-retries 5 \
  --retry-delay-secs 10 \
  --dead-letter-queue huajibot-outbound-main-dlq
```

Use `npx wrangler whoami` to record the account ID and `npx wrangler queues list` to record
the primary queue ID required by the HuaJiBot.NET pull client. Do not add an HTTP pull
consumer to `wrangler.jsonc`; current Cloudflare Queues versions no longer support
managing it there.

## Queue API token

Create a custom Cloudflare API token in the dashboard for the account that owns the
primary queue:

1. Grant **Account / Queues / Edit**, which provides the read and write permissions
   required to pull and acknowledge messages.
2. Scope it to the single Cloudflare account used by this deployment.
3. Store it only in the HuaJiBot.NET deployment secret store as
   `HUAJIBOT_QUEUE_API_TOKEN`.

The Worker does not need and must not receive this token. Its
`HUAJIBOT_OUTBOUND` binding authorizes Queue production without an API token.

## HMAC secret and destination allowlist

Generate an independent high-entropy HMAC secret for each environment. Install the same
value in the Worker and the matching HuaJiBot.NET deployment. Enter the value
interactively so it is not recorded in shell history:

```bash
npx wrangler secret put HUAJIBOT_SIGNING_SECRET --env development
npx wrangler secret put HUAJIBOT_SIGNING_SECRET
```

Store the matching value only in the HuaJiBot.NET deployment secret store as
`HUAJIBOT_SIGNING_SECRET`.

The Worker allowlist is a JSON array of complete destination tuples. Keep tuples intact;
separate lists of bridges, robots, and groups could accidentally authorize unintended
combinations.

```json
[
  { "bridgeInstance": "main", "robotId": "123", "groupId": "456" },
  { "bridgeInstance": "main", "robotId": null, "groupId": "-100123:42" }
]
```

Install the minified JSON as `HUAJIBOT_ALLOWED_DESTINATIONS`:

```bash
npx wrangler secret put HUAJIBOT_ALLOWED_DESTINATIONS --env development
npx wrangler secret put HUAJIBOT_ALLOWED_DESTINATIONS
```

For local development, put both values in an uncommitted `.dev.vars` file. Never put the
Queue API token in the Worker `.dev.vars` file.

## Deploy and verify

```bash
npm run check
npm run deploy:development
npm run deploy
```

The Cloudflare Vite plugin selects and flattens an environment at build time. Always use
`npm run deploy:development` for development; adding `--env development` only to the
post-build Wrangler command is too late and can deploy the production Queue binding.

After deployment, send one signed synthetic event and confirm that the primary queue
contains one `text` message matching `contracts/v1/reply-job.schema.json`. Do not enable a
real group until the HuaJiBot.NET pull client can validate, deliver, ledger, and
acknowledge that job.
