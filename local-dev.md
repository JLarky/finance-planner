# Local development

This worktree is intended to run beside the existing Finance Planner app on
port 5471. Use a different port for this checkout.

## Start an isolated server

```sh
pnpm install
boo new finance-planner-export --detached -- env DEV_AUTH_BYPASS=1 PORT=5472 pnpm dev --host 127.0.0.1 --port 5472
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

The local JSON store is `data/app-store.local.json`; it is ignored by git.

## Browser testing

Use `agent-browser` against the isolated URL from `boo peek`:

```sh
agent-browser skills get core
agent-browser --session finance-planner-export-5472 open http://127.0.0.1:5472/login
```

Sign in through the development-login link, then verify the dashboard flow.
Keep the `boo` process running while iterating so the same browser session and
local data remain available.
