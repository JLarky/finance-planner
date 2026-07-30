import { run } from "remix/ui";
import { distributionExposures, distributionQuery } from "./data/portfolio.ts";

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

function syncTaxableSales(form: HTMLFormElement) {
  const type = form.querySelector<HTMLSelectElement>("[data-account-type]");
  const taxableSales = form.querySelector<HTMLElement>("[data-taxable-sales]");
  if (!type || !taxableSales) return;
  taxableSales.hidden = type.value !== "taxable" && type.value !== "other-taxable";
  if (taxableSales.hidden) {
    const checkbox = taxableSales.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  }
}

function syncAllAccountForms() {
  for (const form of document.querySelectorAll<HTMLFormElement>("[data-account-form]"))
    syncTaxableSales(form);
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.matches("[data-account-type]")) return;
  const form = target.closest<HTMLFormElement>("[data-account-form]");
  if (form) syncTaxableSales(form);
});
document.addEventListener("DOMContentLoaded", syncAllAccountForms);
document.addEventListener("remix:frame", syncAllAccountForms);
syncAllAccountForms();

function syncDistributionExplorers() {
  for (const explorer of document.querySelectorAll<HTMLElement>("[data-distribution-explorer]")) {
    const input = (name: string) =>
      explorer.querySelector<HTMLInputElement>(`[data-distribution-input="${name}"]`);
    const output = (name: string) =>
      explorer.querySelector<HTMLOutputElement>(`[data-distribution-output="${name}"]`);
    const start = explorer.querySelector<HTMLAnchorElement>("[data-distribution-start]");
    const sync = () => {
      const selection = {
        us: Number(input("us")?.value ?? 60),
        tilt: Number(input("tilt")?.value ?? 50),
        assets: Number(input("assets")?.value ?? 50),
      };
      for (const name of ["us", "tilt", "assets"] as const) {
        const value = selection[name];
        const node = output(name);
        if (node) node.value = `${value}%`;
        if (node) node.textContent = `${value}%`;
      }
      const exposures = distributionExposures(selection);
      for (const exposure of exposures) {
        const row = explorer.querySelector<HTMLElement>(
          `[data-distribution-row="${CSS.escape(exposure.name)}"]`,
        );
        const value = row?.querySelector<HTMLElement>("[data-distribution-value]");
        if (value) value.textContent = `${exposure.targetPercent.toFixed(1)}%`;
      }
      if (start) {
        const destination = `/app?distribution=${encodeURIComponent(distributionQuery(selection))}`;
        start.href =
          explorer.dataset.signedIn === "true"
            ? destination
            : `/login?returnTo=${encodeURIComponent(destination)}`;
      }
    };
    explorer.addEventListener("input", sync);
    sync();
  }
}

document.addEventListener("DOMContentLoaded", syncDistributionExplorers);
syncDistributionExplorers();
