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
- Editable holdings with explicit one-fund-to-one-exposure mappings
- Editable Global Factor Mix target template with 100% validation
- Current and target percentages, values, dollar drift, and tolerance status
- Cash-first, account-local rebalance recommendations with permitted exchanges
- Projected post-transaction allocation and restriction explanations
- Contribution-only planning against future target values without selling
- Generic, user-entered investment names and market values; no brokerage connection or live market data

## Local development

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Open the URL printed by `boo peek finance-planner-dev` (currently [http://localhost:5471](http://localhost:5471)). `/` is public, `/health` checks storage connectivity, `/login` creates or authenticates a passkey, and `/app` is the first authenticated workspace.

See [`local-dev.md`](./local-dev.md) for the isolated `boo` workflow, local auth shortcut, agent-browser testing, and per-server data setup.

During Node development, the local fallback is a JSON file rather than a real database. By default it is `data/app-store.local.json`, relative to the worktree, and is ignored by git. Set `FINANCE_PLANNER_DATA_PATH` to a unique path when running more than one server from the same worktree; each server should use a different file. Deno deployments use the KV database selected by `DENO_KV_URL` instead. Finance Planner stores all managed KV records below the `finance-planner` key namespace so it can share a production database with other applications without colliding with their records.

## Deno Deploy

1. Create or link a Deno Deploy app to this repository.
2. Link a Deno KV database to the app.
3. Set `SESSION_SECRET` in the Deploy environment.
4. Build with `NITRO_PRESET=deno_deploy pnpm build` (Nitro's `deno_deploy` preset).
5. Deploy `.output/server/index.ts` with `deployctl`, or configure the Deno Deploy GitHub integration to run the same build.

On Deno Deploy, the runtime adapter calls `Deno.openKv()` automatically. Set `DENO_KV_URL` only when using a specific remote KV database during development.

Passkeys are bound to the exact hostname, so register and sign in from the same deployed hostname.
Session cookies are host-only and also bind their signed user session to the exact hostname that
created it. This prevents a cookie copied or mis-scoped between preview deployments from being
used against another deployment; open the preview's sign-in page and authenticate there instead.
