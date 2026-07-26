import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";
import { remix } from "vite-plugin-remix3";

export default defineConfig({
  server: { host: "localhost", port: 4576 },
  staged: { "*": "vp check --fix" },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: [nitro(), remix()],
});
