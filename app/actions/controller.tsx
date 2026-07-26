import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { devAuthEnabled, userId, redirectToLogin } from "../middleware/auth-session.ts";
import { routes } from "../routes.ts";
import { ensureDevUser, getUser, saveUser } from "../data/users.ts";
import {
  isTaxableAccount,
  recommendContribution,
  recommendRebalance,
  type AccountType,
} from "../data/portfolio.ts";
import { HomePage } from "../ui/home-page.tsx";
import { LoginPage } from "../ui/login-page.tsx";
import { DashboardPage } from "../ui/dashboard-page.tsx";
export default createController(routes, {
  actions: {
    async home(c) {
      return c.render(<HomePage signedIn={userId(c.session) != null} />);
    },
    async login(c) {
      const id = userId(c.session);
      const url = new URL(c.request.url);
      const returnTo = url.searchParams.get("returnTo") || "/app";
      if (id) return redirect(returnTo);
      return c.render(
        <LoginPage
          returnTo={returnTo}
          error={url.searchParams.get("error")}
          devAuthEnabled={devAuthEnabled()}
        />,
      );
    },
    async devLogin(c) {
      if (!devAuthEnabled()) return new Response("Not Found", { status: 404 });
      const user = await ensureDevUser();
      c.session.regenerateId();
      c.session.set("userId", user.id);
      return redirect(routes.app.href());
    },
    async app(c) {
      const id = userId(c.session);
      if (!id) return redirectToLogin(routes.app.href());
      const user = await getUser(id);
      if (!user) return redirectToLogin(routes.app.href());
      if (c.request.method === "POST") {
        const form = await c.request.formData();
        const intent = text(form, "intent");
        const portfolio = user.portfolio;
        if (intent === "add-account") {
          const name = text(form, "name").trim();
          const cash = number(form, "cash");
          const type = accountType(text(form, "type"));
          if (name && cash >= 0) {
            portfolio.accounts.push({
              id: crypto.randomUUID(),
              name,
              type,
              cash,
              allowPurchases: form.get("allowPurchases") === "on",
              allowSales: form.get("allowSales") === "on",
              allowTaxableSales:
                isTaxableAccount({ type }) && form.get("allowTaxableSales") === "on",
              expectContributions: form.get("expectContributions") === "on",
            });
          }
        } else if (intent === "update-account") {
          const account = portfolio.accounts.find((item) => item.id === text(form, "accountId"));
          const name = text(form, "name").trim();
          if (account && name) {
            account.name = name;
            account.type = accountType(text(form, "type"));
            account.cash = number(form, "cash");
            account.allowPurchases = form.get("allowPurchases") === "on";
            account.allowSales = form.get("allowSales") === "on";
            account.allowTaxableSales =
              isTaxableAccount(account) && form.get("allowTaxableSales") === "on";
            account.expectContributions = form.get("expectContributions") === "on";
          }
        } else if (intent === "remove-account") {
          const accountId = text(form, "accountId");
          if (!portfolio.holdings.some((holding) => holding.accountId === accountId)) {
            portfolio.accounts = portfolio.accounts.filter((account) => account.id !== accountId);
          }
        } else if (intent === "add-holding") {
          const name = text(form, "name").trim();
          const value = number(form, "value");
          const accountId = text(form, "accountId");
          const exposureId = text(form, "exposureId");
          if (
            name &&
            value >= 0 &&
            portfolio.accounts.some((account) => account.id === accountId) &&
            portfolio.exposures.some((exposure) => exposure.id === exposureId)
          ) {
            portfolio.holdings.push({
              id: crypto.randomUUID(),
              accountId,
              name,
              value,
              exposureId,
              canBuy: form.get("canBuy") === "on",
              canSell: form.get("canSell") === "on",
            });
          }
        } else if (intent === "update-holding") {
          const holding = portfolio.holdings.find((item) => item.id === text(form, "holdingId"));
          const accountId = text(form, "accountId");
          const exposureId = text(form, "exposureId");
          const name = text(form, "name").trim();
          if (
            holding &&
            name &&
            portfolio.accounts.some((account) => account.id === accountId) &&
            portfolio.exposures.some((exposure) => exposure.id === exposureId)
          ) {
            holding.name = name;
            holding.accountId = accountId;
            holding.value = number(form, "value");
            holding.exposureId = exposureId;
            holding.canBuy = form.get("canBuy") === "on";
            holding.canSell = form.get("canSell") === "on";
          }
        } else if (intent === "remove-holding") {
          const holdingId = text(form, "holdingId");
          portfolio.holdings = portfolio.holdings.filter((holding) => holding.id !== holdingId);
        } else if (intent === "save-targets") {
          saveTargetFields(portfolio, form);
        } else if (intent === "add-exposure") {
          const name = text(form, "name").trim();
          if (name) portfolio.exposures.push({ id: crypto.randomUUID(), name, targetPercent: 0 });
        } else if (intent.startsWith("move-exposure-up:")) {
          saveTargetFields(portfolio, form);
          moveExposure(portfolio.exposures, intent.slice("move-exposure-up:".length), -1);
        } else if (intent.startsWith("move-exposure-down:")) {
          saveTargetFields(portfolio, form);
          moveExposure(portfolio.exposures, intent.slice("move-exposure-down:".length), 1);
        } else if (intent.startsWith("remove-exposure:")) {
          saveTargetFields(portfolio, form);
          const exposureId = intent.slice("remove-exposure:".length);
          if (
            portfolio.exposures.length > 1 &&
            !portfolio.holdings.some((holding) => holding.exposureId === exposureId)
          ) {
            portfolio.exposures = portfolio.exposures.filter(
              (exposure) => exposure.id !== exposureId,
            );
          }
        } else if (intent === "rebalance") {
          return c.render(<DashboardPage user={user} plan={recommendRebalance(portfolio)} />);
        } else if (intent === "contribution") {
          const frequency = text(form, "frequency") === "recurring" ? "recurring" : "one-time";
          return c.render(
            <DashboardPage
              user={user}
              plan={recommendContribution(
                portfolio,
                number(form, "amount"),
                text(form, "accountId"),
                frequency,
              )}
            />,
          );
        }
        await saveUser(user);
      }
      return c.render(<DashboardPage user={user} />);
    },
    async logout(c) {
      c.session.unset("userId");
      c.session.regenerateId();
      return redirect(routes.home.href());
    },
  },
});

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function saveTargetFields(
  portfolio: {
    targetName: string;
    exposures: { id: string; name: string; targetPercent: number }[];
  },
  form: FormData,
) {
  const targetName = text(form, "targetName").trim();
  if (targetName) portfolio.targetName = targetName;
  for (const exposure of portfolio.exposures) {
    const name = text(form, `name-${exposure.id}`).trim();
    if (name) exposure.name = name;
    exposure.targetPercent = number(form, `target-${exposure.id}`);
  }
}

function moveExposure(exposures: { id: string }[], exposureId: string, direction: -1 | 1) {
  const index = exposures.findIndex((exposure) => exposure.id === exposureId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= exposures.length) return;
  const [exposure] = exposures.splice(index, 1);
  if (exposure) exposures.splice(nextIndex, 0, exposure);
}

function number(form: FormData, key: string): number {
  const value = Number(text(form, key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function accountType(value: string): AccountType {
  const values: AccountType[] = [
    "401k",
    "traditional-ira",
    "roth-ira",
    "taxable",
    "other-tax-advantaged",
    "other-taxable",
  ];
  return values.includes(value as AccountType) ? (value as AccountType) : "taxable";
}
