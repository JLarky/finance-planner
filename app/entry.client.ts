import { run } from "remix/ui";

const modules = import.meta.glob<Record<string, Function>>([
  "/app/**/*.{ts,tsx,js,jsx}",
  "!/app/**/*.server.*",
  "!/app/**/*.d.ts",
]);

run({
  async loadModule(moduleUrl, exportName) {
    const load = modules[moduleUrl.replace(/^\/assets/, "")];
    if (!load) throw new Error(`Unknown module: ${moduleUrl}`);
    return (await load())[exportName];
  },
  async resolveFrame(src, signal, target) {
    const headers = new Headers({ accept: "text/html" });
    if (target) headers.set("x-remix-target", target);
    const response = await fetch(src, { credentials: "same-origin", headers, signal });
    return response.body ?? response.text();
  },
});
