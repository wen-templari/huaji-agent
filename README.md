# huaji-agent

Flue agent for HuaJiBot.NET, deployed as a Cloudflare Worker. The versioned bridge contract is in [`contracts/`](./contracts/README.md), and the migration plan is in [`PLAN.md`](./PLAN.md).

The agent is currently dispatch-only: the scaffold exposes `/health`, but it intentionally does not expose an unauthenticated agent route. The signed HuaJiBot channel will become the admission boundary in step 4.

## Requirements

- Node.js 22.19 or newer
- A Cloudflare account for deployment

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run types
npm run check
npm run deploy:dry-run
```

Vite+ provides formatting, linting, type-aware checks, tests, and production builds. Wrangler remains the source of Worker binding types through `npm run types`.

Local and deployed secrets belong in `.dev.vars` and Wrangler secrets respectively. Never commit them.
