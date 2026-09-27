# HuaJi Agent migration plan

This repository implements the cloud-agent half of [HuaJiBot.NET issue #64](https://github.com/nbtca/HuaJiBot.NET/issues/64). HuaJiBot.NET remains the messaging gateway; this project owns the Flue agent, durable conversations, and reply-job production on Cloudflare.

## Architecture

```text
QQ / Telegram / Satori
          |
          v
    HuaJiBot.NET
          |
          | signed HTTPS ingress
          v
 huaji-agent (Flue Worker)
          |
          | versioned reply job
          v
  Cloudflare Queue + DLQ
          ^
          | HTTP pull + ack
          |
    HuaJiBot.NET
```

ServerlessMQ is not part of the durable reply path. It may later provide a best-effort wake-up notification, while Cloudflare Queue remains the source of truth.

## Implementation steps

- [x] 1. Define versioned ingress and reply-job contracts, examples, limits, identifier rules, and HMAC test vectors.
- [x] 2. Scaffold the TypeScript, Vite, Flue, and Cloudflare Worker project with tests, linting, Wrangler configuration, and the initial Durable Object migration.
- [x] 3a. Configure separate development and production outbound Queue bindings and document provisioning and secret handling.
- [ ] 3b. Provision the outbound Queues, dead-letter queues, HTTP pull consumers, and scoped credentials in the Cloudflare account.
- [x] 4. Implement the custom HuaJiBot Flue channel with HMAC verification, replay protection, tuple allowlists, and idempotent dispatch.
- [x] 5. Implement the agent and its narrow `reply_to_huajibot({ text })` Queue-producing tool.
- [ ] 6. Add `HuaJiBot.NET.Plugin.FlueBridge` to HuaJiBot.NET.
- [ ] 7. Add the SQLite message/conversation map and delivery ledger.
- [ ] 8. Route configured mentions and reply threads into versioned ingress events.
- [ ] 9. Add exact-body signing, bounded HTTP retries, and safe structured logging.
- [ ] 10. Implement Queue pull, validation, delivery, deduplication, acknowledgment, retry, and backoff.
- [ ] 11. Add cross-repository contract tests and failure-path integration tests.
- [ ] 12. Deploy one canary group and validate outage recovery, duplicate handling, and observability.
- [ ] 13. Roll out group by group, then disable the old AIChat plugin for migrated groups.

## Delivery slices

1. Contracts and Worker scaffold.
2. Flue channel and agent reply tool.
3. HuaJiBot.NET ingress and local storage.
4. Queue consumption, recovery tests, and canary rollout.

## Version-one boundaries

- Only group mentions and replies within an established bot thread are forwarded.
- The model never selects a bridge, robot, group, adapter, credential, or provider API.
- One outbound Queue is used per HuaJiBot deployment.
- Queue delivery is at least once; `jobId` is the deduplication key.
- The unavoidable send-success/crash-before-ledger-write window is documented rather than hidden.
- Interactive access to internal HuaJiBot tools, Cloudflare Tunnel, and ServerlessMQ wake-ups are deferred.
