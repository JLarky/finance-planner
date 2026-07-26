import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Router } from "remix/router";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream } from "remix/ui/server";

export function render() {
  return renderWith(
    ({ request, router }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        const stream = renderToStream(node, {
          frameSrc: request.url,
          signal: request.signal,
          resolveFrame: (src) => resolveFrame(router, request, src),
          async resolveClientEntry(entryId, component) {
            const exportName = entryId.split("#")[1] || component.name;
            if (entryId.startsWith("/app/")) return { href: entryId.split("#")[0]!, exportName };
            if (!entryId.startsWith("file://")) throw new Error(`Unknown client entry ${entryId}`);
            const rel = path.relative(process.cwd(), fileURLToPath(entryId)).replaceAll("\\", "/");
            return { href: `/${rel}`, exportName };
          },
        });
        return createHtmlResponse(stream, init);
      },
  );
}

async function resolveFrame(router: Router, request: Request, src: string) {
  const headers = new Headers({ Accept: "text/html" });
  const cookie = request.headers.get("Cookie");
  if (cookie) headers.set("Cookie", cookie);
  const response = await router.fetch(new Request(new URL(src, request.url), { headers }));
  return response.body ?? response.text();
}
