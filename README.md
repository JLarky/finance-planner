# Finance Planner

Private investment planning app, built from the same small Remix/Vite foundation as `../llm-usage`.

## Stack

- Remix 3 with Vite and Nitro SSR
- Passkey authentication via SimpleWebAuthn
- Deno KV in Deno Deploy
- Local JSON fallback during Node development

## V1 planner features

The authenticated workspace currently supports:

- Multiple accounts with account-level cash and trading restrictions
- Holdings mapped to generic portfolio exposures
- Target allocation percentages with 100% validation
- Current allocation, target value, dollar drift, and tolerance status
- Cash-first rebalance recommendations that respect account boundaries
- Contribution-only planning without selling existing holdings
- Generic, user-entered investment names and market values; no brokerage connection or live market data

## Local development

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Open the URL printed by `boo peek finance-planner-dev` (currently [http://localhost:5471](http://localhost:5471)). `/` is public, `/login` creates or authenticates a passkey, and `/app` is the first authenticated workspace.

The local fallback is written to `data/app-store.local.json` and is ignored by git once created.

## Deno Deploy

1. Create or link a Deno Deploy app to this repository.
2. Link a Deno KV database to the app.
3. Set `SESSION_SECRET` in the Deploy environment.
4. Build with `NITRO_PRESET=deno_deploy pnpm build` (Nitro's `deno_deploy` preset).
5. Deploy `.output/server/index.ts` with `deployctl`, or configure the Deno Deploy GitHub integration to run the same build.

On Deno Deploy, the runtime adapter calls `Deno.openKv()` automatically. Set `DENO_KV_URL` only when using a specific remote KV database during development.

Passkeys are bound to the exact hostname, so register and sign in from the same deployed hostname.
