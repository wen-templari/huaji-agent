# huaji-agent

Flue agent for HuaJiBot.NET, deployed as a Cloudflare Worker. The versioned bridge contract is in [`contracts/`](./contracts/README.md), and the migration plan is in [`PLAN.md`](./PLAN.md).

The agent is dispatch-only: it intentionally exposes no unauthenticated agent route.
HuaJiBot messages enter through the signed `POST /channels/huajibot/events` channel, and
`/health` remains available for service checks.

For local debugging, the development server mounts the agent at `/api/debug/huaji` for
`debug-*` conversations only. This route is excluded from production builds.

## Requirements

- Node.js 22.19 or newer
- A Cloudflare account for deployment

## Development

```bash
npm install
npm run dev
```

In a second terminal, run `npm run dev:ui` and open http://127.0.0.1:5174.
The React UI uses Flue's live conversation hook to show messages, status, tool calls,
and errors. It retains the current debug conversation in browser storage; use
**New conversation** to start fresh. The UI sends ordinary user messages, which
produce direct chat responses without publishing HuaJiBot reply jobs.

Useful checks:

```bash
npm run types
npm run check
npm run deploy:dry-run
```

Vite+ provides formatting, linting, type-aware checks, tests, and production builds. Wrangler remains the source of Worker binding types through `npm run types`.

Local and deployed secrets belong in `.dev.vars` and Wrangler secrets respectively. Never commit them.

Cloudflare Queue names, HTTP pull settings, credentials, and environment-specific setup
are documented in [`docs/cloudflare-provisioning.md`](./docs/cloudflare-provisioning.md).
