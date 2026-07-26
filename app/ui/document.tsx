import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";
import assets from "../entry.client.ts?assets=client";
export function Document(h: Handle<{ children?: RemixNode; title?: string }>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
        <title>{h.props.title ?? "Finance Planner"}</title>
        {assets.css.map((a) => (
          <link key={a.href} rel="stylesheet" href={a.href} />
        ))}
      </head>
      <body mix={css({ margin: 0 })}>
        {h.props.children}
        <script type="module" src={assets.entry} />
      </body>
    </html>
  );
}
