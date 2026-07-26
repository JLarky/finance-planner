# Local development

This worktree is intended to run beside the existing Finance Planner app on
port 5471. Use a different port for this checkout.

## Start an isolated server

```sh
pnpm install
boo new finance-planner-export --detached -- env DEV_AUTH_BYPASS=1 FINANCE_PLANNER_DATA_PATH=data/app-store.export.local.json PORT=5472 pnpm dev --host 127.0.0.1 --port 5472
```

`boo` keeps the dev server in the background. Check its output and URL with:

```sh
boo peek finance-planner-export
```

If `PORT=5472` is not honored by the installed Vite runner, use the port
printed by `boo peek` and keep the existing app on 5471 untouched.

## Development authentication

`DEV_AUTH_BYPASS=1` enables the local-only `/dev-login` flow. Open the app,
visit `/login`, and choose **Use local dev account**. This is disabled in
production and on Deno Deploy.

## Data isolation

Node development uses a JSON file as its local database. The app resolves
`FINANCE_PLANNER_DATA_PATH` relative to the worktree, so every server should
set a unique filename. This checkout uses `data/app-store.export.local.json`;
the existing app on port 5471 can keep using the default
`data/app-store.local.json`. They therefore do not share users or portfolio
data. The files are ignored by git.

The isolation is file-based, not provided by the port itself: two servers that
omit `FINANCE_PLANNER_DATA_PATH` from the same worktree would share the
default file. Deno Deploy does not use these files; it uses the Deno KV store
selected by `DENO_KV_URL`.

## Browser testing

Use `agent-browser` against the isolated URL from `boo peek`:

```sh
agent-browser skills get core
agent-browser --session finance-planner-export-5472 open http://127.0.0.1:5472/login
```

Sign in through the development-login link, then verify the dashboard flow.
Keep the `boo` process running while iterating so the same browser session and
local data remain available.
