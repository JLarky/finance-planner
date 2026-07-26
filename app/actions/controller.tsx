import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { userId, redirectToLogin } from "../middleware/auth-session.ts";
import { routes } from "../routes.ts";
import { getUser } from "../data/users.ts";
import { saveUser } from "../data/users.ts";
import { recommendContribution, recommendRebalance, type AccountType } from "../data/portfolio.ts";
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
      return c.render(<LoginPage returnTo={returnTo} error={url.searchParams.get("error")} />);
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
          if (name && cash >= 0) {
            portfolio.accounts.push({
              id: crypto.randomUUID(),
              name,
              type: accountType(text(form, "type")),
              cash,
              allowTaxableSales: form.get("allowTaxableSales") === "on",
              allowTrades: form.get("allowTrades") !== "off",
              expectContributions: form.get("expectContributions") === "on",
            });
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
              canBuy: form.get("canBuy") !== "off",
              canSell: form.get("canSell") !== "off",
            });
          }
        } else if (intent === "save-targets") {
          for (const exposure of portfolio.exposures)
            exposure.targetPercent = number(form, `target-${exposure.id}`);
        } else if (intent === "add-exposure") {
          const name = text(form, "name").trim();
          if (name) portfolio.exposures.push({ id: crypto.randomUUID(), name, targetPercent: 0 });
        } else if (intent === "rebalance") {
          return c.render(<DashboardPage user={user} plan={recommendRebalance(portfolio)} />);
        } else if (intent === "contribution") {
          return c.render(
            <DashboardPage
              user={user}
              plan={recommendContribution(
                portfolio,
                number(form, "amount"),
                text(form, "accountId"),
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
