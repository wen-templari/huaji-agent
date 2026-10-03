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
   reply publisher
      /         \
development   production adapter
     |          (transport pending)
     v
durable capture
```

The production transport is intentionally isolated behind the reply-publisher boundary.
The existing Cloudflare Queue adapter remains available while acknowledged, persistent
ServerlessMQ delivery is designed.

The development sink is only a vertical-slice aid. It runs behind the same
`reply_to_huajibot({ text })` tool and validates the same reply-job contract, but durably
captures the job for inspection instead of delivering it. It is never selected in
production.

## Implementation steps

- [x] 1. Define versioned ingress and reply-job contracts, examples, limits, identifier rules, and HMAC test vectors.
- [x] 2. Scaffold the TypeScript, Vite, Flue, and Cloudflare Worker project with tests, linting, Wrangler configuration, and the initial Durable Object migration.
- [x] 3a. Configure separate development and production outbound Queue bindings and document provisioning and secret handling.
- [x] 4. Implement the custom HuaJiBot Flue channel with HMAC verification, replay protection, tuple allowlists, and idempotent dispatch.
- [x] 5. Implement the agent and its narrow `reply_to_huajibot({ text })` Queue-producing tool.
- [x] 6. Deliver a runnable development vertical slice: configure the selected OpenAI-compatible endpoint, model metadata, and API-key secret; put production delivery and a development-only durable captured sink behind one reply-publisher interface; and add a smoke path for signed ingress -> durable agent -> model -> real reply tool -> validated captured reply job. No Workers AI binding is required.
- [ ] 7. Add `HuaJiBot.NET.Plugin.FlueBridge` to HuaJiBot.NET with transport boundaries that can be tested without Cloudflare.
- [ ] 8. Add the SQLite message/conversation map and delivery ledger.
- [ ] 9. Route configured mentions and reply threads into versioned ingress events.
- [ ] 10. Add exact-body signing, bounded HTTP retries, and safe structured logging.
- [ ] 11. Provision the outbound Queues, dead-letter queues, HTTP pull consumers, and scoped credentials in the Cloudflare account.
- [ ] 12. Implement Queue pull, validation, delivery, deduplication, acknowledgment, retry, and backoff.
- [ ] 13. Add cross-repository contract tests and failure-path integration tests.
- [ ] 14. Deploy one canary group and validate outage recovery, duplicate handling, and observability.
- [ ] 15. Roll out group by group, then disable the old AIChat plugin for migrated groups.

## Delivery slices

1. Contracts and Worker scaffold.
2. Flue channel and agent reply tool.
3. Runnable agent with a captured development reply sink.
4. HuaJiBot.NET ingress and local storage.
5. Production Queue provisioning and consumption.
6. Recovery tests and canary rollout.

## Version-one boundaries

- Only group mentions and replies within an established bot thread are forwarded.
- The model never selects a bridge, robot, group, adapter, credential, or provider API.
- One durable production reply subscription is used per HuaJiBot deployment.
- Production delivery is at least once; `jobId` is the deduplication key.
- The unavoidable send-success/crash-before-ledger-write window is documented rather than hidden.
- Interactive access to internal HuaJiBot tools and Cloudflare Tunnel is deferred.
