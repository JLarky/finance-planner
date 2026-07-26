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
