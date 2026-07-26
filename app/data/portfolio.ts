export type AccountType =
  | "401k"
  | "traditional-ira"
  | "roth-ira"
  | "taxable"
  | "other-tax-advantaged"
  | "other-taxable";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  cash: number;
  allowPurchases: boolean;
  allowSales: boolean;
  allowTaxableSales: boolean;
  expectContributions: boolean;
  allowTrades?: boolean;
};

export type Holding = {
  id: string;
  accountId: string;
  name: string;
  value: number;
  exposureId: string;
  canBuy: boolean;
  canSell: boolean;
};

export type Exposure = { id: string; name: string; targetPercent: number };

export type Portfolio = {
  accounts: Account[];
  holdings: Holding[];
  exposures: Exposure[];
  targetName: string;
  relativeThreshold: number;
  minimumTrade: number;
};

export type ExposureSummary = Exposure & {
  currentValue: number;
  currentPercent: number;
  targetValue: number;
  dollarDrift: number;
  percentagePointDrift: number;
  status: "on-target" | "within-tolerance" | "underweight" | "overweight";
};

export type Trade = {
  accountId: string;
  action: "buy" | "sell";
  holdingId: string;
  holdingName: string;
  amount: number;
  exposureId: string;
  funding: "cash" | "sale" | "contribution";
};

export type Projection = {
  exposureId: string;
  name: string;
  beforePercent: number;
  projectedPercent: number;
  targetPercent: number;
  remainingDollarDrift: number;
  status: ExposureSummary["status"];
};

export type RebalancePlan = {
  kind: "rebalance" | "contribution";
  trades: Trade[];
  remainingCash: number;
  message: string;
  projections: Projection[];
  restrictions: string[];
  correctiveActions: string[];
  withinTolerance: boolean;
  contributionFrequency?: "one-time" | "recurring";
};

const DEFAULT_EXPOSURES = [
  ["broad-us", "Broad US market", 50],
  ["us-small-value", "US small-cap value", 10],
  ["developed-international", "Developed international broad", 24],
  ["developed-international-small-value", "Developed international small-cap value", 6],
  ["emerging-markets", "Emerging markets", 10],
] as const;

const LEGACY_EXPOSURE_IDS = ["us-market", "international-market", "small-value", "bonds"];

export function createDefaultPortfolio(): Portfolio {
  return {
    accounts: [],
    holdings: [],
    exposures: DEFAULT_EXPOSURES.map(([id, name, targetPercent]) => ({ id, name, targetPercent })),
    targetName: "Global Factor Mix",
    relativeThreshold: 0.2,
    minimumTrade: 50,
  };
}

export function normalizePortfolio(portfolio?: Portfolio): Portfolio {
  if (!portfolio) return createDefaultPortfolio();
  const hasUnusedLegacyTemplate =
    portfolio.holdings.length === 0 &&
    portfolio.exposures.length === LEGACY_EXPOSURE_IDS.length &&
    LEGACY_EXPOSURE_IDS.every((id) => portfolio.exposures.some((exposure) => exposure.id === id));
  return {
    ...portfolio,
    accounts: portfolio.accounts.map((account) => ({
      ...account,
      allowPurchases: account.allowPurchases ?? account.allowTrades ?? true,
      allowSales: account.allowSales ?? account.allowTrades ?? true,
      allowTaxableSales: isTaxableAccount(account) ? (account.allowTaxableSales ?? false) : false,
    })),
    exposures: hasUnusedLegacyTemplate
      ? createDefaultPortfolio().exposures
      : portfolio.exposures.length
        ? portfolio.exposures
        : createDefaultPortfolio().exposures,
    targetName: portfolio.targetName?.trim() || "Global Factor Mix",
    relativeThreshold: portfolio.relativeThreshold ?? 0.2,
    minimumTrade: portfolio.minimumTrade ?? 50,
  };
}

export function portfolioTotal(portfolio: Portfolio): number {
  return (
    portfolio.accounts.reduce((total, account) => total + account.cash, 0) +
    portfolio.holdings.reduce((total, holding) => total + holding.value, 0)
  );
}

export function targetTotal(portfolio: Portfolio): number {
  return portfolio.exposures.reduce((total, exposure) => total + exposure.targetPercent, 0);
}

export function summarizePortfolio(portfolio: Portfolio): ExposureSummary[] {
  const total = portfolioTotal(portfolio);
  return portfolio.exposures.map((exposure) => {
    const currentValue = portfolio.holdings
      .filter((holding) => holding.exposureId === exposure.id)
      .reduce((sum, holding) => sum + holding.value, 0);
    const currentPercent = total > 0 ? (currentValue / total) * 100 : 0;
    const targetValue = total * (exposure.targetPercent / 100);
    const percentagePointDrift = currentPercent - exposure.targetPercent;
    const relativeDrift =
      total === 0
        ? 0
        : exposure.targetPercent > 0
          ? Math.abs(percentagePointDrift) / exposure.targetPercent
          : currentValue > 0
            ? 1
            : 0;
    let status: ExposureSummary["status"] = "on-target";
    if (relativeDrift > portfolio.relativeThreshold) {
      status = percentagePointDrift > 0 ? "overweight" : "underweight";
    } else if (relativeDrift > 0.02) {
      status = "within-tolerance";
    }
    return {
      ...exposure,
      currentValue,
      currentPercent,
      targetValue,
      dollarDrift: currentValue - targetValue,
      percentagePointDrift,
      status,
    };
  });
}

export function recommendRebalance(portfolio: Portfolio): RebalancePlan {
  const working = clonePortfolio(portfolio);
  const trades: Trade[] = [];

  for (const account of orderedAccounts(working)) {
    if (!account.allowPurchases || account.cash < working.minimumTrade) continue;
    allocateCash(working, account, trades);
  }

  for (const account of orderedAccounts(working)) {
    if (!account.allowPurchases || !account.allowSales) continue;
    if (isTaxableAccount(account) && !account.allowTaxableSales) continue;
    allocateExchanges(working, account, trades);
  }

  const consolidated = consolidateTrades(trades);
  const projected = summarizePortfolio(working);
  const unresolved = projected.filter(isOutsideTolerance);
  const { restrictions, correctiveActions } = explainRestrictions(working, unresolved);
  const remainingCash = working.accounts.reduce((sum, account) => sum + account.cash, 0);
  return {
    kind: "rebalance",
    trades: consolidated,
    remainingCash,
    message:
      consolidated.length === 0
        ? unresolved.length
          ? "No permitted account-local transactions can improve the portfolio."
          : "No transactions are needed. The portfolio is already within tolerance."
        : unresolved.length
          ? "This is the closest feasible allocation under the current restrictions."
          : "The recommended transactions bring every exposure within tolerance.",
    projections: createProjections(portfolio, working),
    restrictions,
    correctiveActions,
    withinTolerance: unresolved.length === 0,
  };
}

export function recommendContribution(
  portfolio: Portfolio,
  amount: number,
  accountId: string,
  frequency: "one-time" | "recurring" = "one-time",
): RebalancePlan {
  const emptyPlan = (message: string): RebalancePlan => ({
    kind: "contribution",
    trades: [],
    remainingCash: Math.max(0, amount),
    message,
    projections: createProjections(portfolio, portfolio),
    restrictions: [],
    correctiveActions: [],
    withinTolerance: false,
    contributionFrequency: frequency,
  });
  if (amount <= 0) return emptyPlan("Enter a contribution greater than zero.");
  const account = portfolio.accounts.find((item) => item.id === accountId);
  if (!account) return emptyPlan("Choose a destination account.");

  const working = clonePortfolio(portfolio);
  const workingAccount = working.accounts.find((item) => item.id === accountId)!;
  workingAccount.cash += amount;
  if (!workingAccount.allowPurchases) {
    const plan = emptyPlan("Purchases are disabled in the selected account.");
    plan.projections = createProjections(portfolio, working);
    plan.restrictions = [`Purchases are disabled in ${workingAccount.name}.`];
    plan.correctiveActions = [`Allow purchases in ${workingAccount.name}.`];
    return plan;
  }

  const trades: Trade[] = [];
  let remaining = roundDown(amount);
  const eligible = working.holdings.filter(
    (holding) => holding.accountId === accountId && holding.canBuy,
  );
  const eligibleByExposure = new Map<string, Holding>();
  for (const holding of eligible)
    if (!eligibleByExposure.has(holding.exposureId))
      eligibleByExposure.set(holding.exposureId, holding);

  while (remaining >= working.minimumTrade) {
    const summaries = summarizePortfolio(working);
    const candidates = summaries
      .filter((summary) => summary.dollarDrift < -0.01 && eligibleByExposure.has(summary.id))
      .sort(
        (a, b) =>
          a.dollarDrift / Math.max(a.targetValue, 1) - b.dollarDrift / Math.max(b.targetValue, 1),
      );
    const candidate = candidates[0];
    if (!candidate) break;
    const holding = eligibleByExposure.get(candidate.id)!;
    const allocation = practicalAmount(
      Math.min(remaining, -candidate.dollarDrift),
      working.minimumTrade,
    );
    if (allocation === 0) break;
    addTrade(trades, {
      accountId,
      action: "buy",
      holdingId: holding.id,
      holdingName: holding.name,
      amount: allocation,
      exposureId: holding.exposureId,
      funding: "contribution",
    });
    holding.value += allocation;
    workingAccount.cash -= allocation;
    remaining -= allocation;
  }

  if (remaining >= working.minimumTrade && eligible.length > 0) {
    const summaries = summarizePortfolio(working);
    const fallback = [...eligible].sort((a, b) => {
      const aTarget = summaries.find((summary) => summary.id === a.exposureId)?.targetValue ?? 0;
      const bTarget = summaries.find((summary) => summary.id === b.exposureId)?.targetValue ?? 0;
      return bTarget - aTarget;
    })[0]!;
    const allocation = roundDown(remaining);
    addTrade(trades, {
      accountId,
      action: "buy",
      holdingId: fallback.id,
      holdingName: fallback.name,
      amount: allocation,
      exposureId: fallback.exposureId,
      funding: "contribution",
    });
    fallback.value += allocation;
    workingAccount.cash -= allocation;
    remaining -= allocation;
  }

  const projected = summarizePortfolio(working);
  const unresolved = projected.filter(isOutsideTolerance);
  const restrictions: string[] = [];
  const correctiveActions: string[] = [];
  for (const summary of unresolved.filter((item) => item.status === "underweight")) {
    if (!eligibleByExposure.has(summary.id)) {
      restrictions.push(
        `${workingAccount.name} has no purchasable investment mapped to ${summary.name}.`,
      );
      correctiveActions.push(
        `Add or enable a ${summary.name} investment in ${workingAccount.name}, or contribute to another account.`,
      );
    }
  }
  if (eligible.length === 0) {
    restrictions.push(`${workingAccount.name} has no investments enabled for purchases.`);
    correctiveActions.push(`Enable purchases for at least one holding in ${workingAccount.name}.`);
  }

  return {
    kind: "contribution",
    trades: consolidateTrades(trades),
    remainingCash: workingAccount.cash,
    message:
      trades.length === 0
        ? "No eligible investment is available for this contribution."
        : unresolved.length
          ? "The contribution is allocated to the best investments available in this account."
          : "The contribution brings every exposure within tolerance.",
    projections: createProjections(portfolio, working),
    restrictions: unique(restrictions),
    correctiveActions: unique(correctiveActions),
    withinTolerance: unresolved.length === 0,
    contributionFrequency: frequency,
  };
}

function allocateCash(portfolio: Portfolio, account: Account, trades: Trade[]) {
  const accountHoldings = portfolio.holdings.filter(
    (holding) => holding.accountId === account.id && holding.canBuy,
  );
  while (account.cash >= portfolio.minimumTrade) {
    const summaries = summarizePortfolio(portfolio);
    const candidate = summaries
      .filter(
        (summary) =>
          summary.dollarDrift < -0.01 &&
          accountHoldings.some((holding) => holding.exposureId === summary.id),
      )
      .sort(
        (a, b) =>
          a.dollarDrift / Math.max(a.targetValue, 1) - b.dollarDrift / Math.max(b.targetValue, 1),
      )[0];
    if (!candidate) break;
    const holding = accountHoldings.find((item) => item.exposureId === candidate.id)!;
    const amount = practicalAmount(
      Math.min(account.cash, -candidate.dollarDrift),
      portfolio.minimumTrade,
    );
    if (amount === 0) break;
    addTrade(trades, {
      accountId: account.id,
      action: "buy",
      holdingId: holding.id,
      holdingName: holding.name,
      amount,
      exposureId: holding.exposureId,
      funding: "cash",
    });
    holding.value += amount;
    account.cash -= amount;
  }
}

function allocateExchanges(portfolio: Portfolio, account: Account, trades: Trade[]) {
  while (true) {
    const summaries = summarizePortfolio(portfolio);
    const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
    const buy = summaries
      .filter(
        (summary) =>
          summary.status === "underweight" &&
          portfolio.holdings.some(
            (holding) =>
              holding.accountId === account.id &&
              holding.exposureId === summary.id &&
              holding.canBuy,
          ),
      )
      .sort(
        (a, b) =>
          a.dollarDrift / Math.max(a.targetValue, 1) - b.dollarDrift / Math.max(b.targetValue, 1),
      )[0];
    const sellHolding = portfolio.holdings
      .filter(
        (holding) =>
          holding.accountId === account.id &&
          holding.canSell &&
          holding.value >= portfolio.minimumTrade &&
          summaryById.get(holding.exposureId)?.status === "overweight",
      )
      .sort((a, b) => {
        const aDrift = summaryById.get(a.exposureId)?.dollarDrift ?? 0;
        const bDrift = summaryById.get(b.exposureId)?.dollarDrift ?? 0;
        return bDrift - aDrift;
      })[0];
    if (!buy || !sellHolding) break;
    const sellSummary = summaryById.get(sellHolding.exposureId)!;
    const amount = practicalAmount(
      Math.min(-buy.dollarDrift, sellSummary.dollarDrift, sellHolding.value),
      portfolio.minimumTrade,
    );
    if (amount === 0) break;
    const buyHolding = portfolio.holdings.find(
      (holding) =>
        holding.accountId === account.id && holding.exposureId === buy.id && holding.canBuy,
    )!;
    addTrade(trades, {
      accountId: account.id,
      action: "sell",
      holdingId: sellHolding.id,
      holdingName: sellHolding.name,
      amount,
      exposureId: sellHolding.exposureId,
      funding: "sale",
    });
    addTrade(trades, {
      accountId: account.id,
      action: "buy",
      holdingId: buyHolding.id,
      holdingName: buyHolding.name,
      amount,
      exposureId: buyHolding.exposureId,
      funding: "sale",
    });
    sellHolding.value -= amount;
    buyHolding.value += amount;
  }
}

function explainRestrictions(portfolio: Portfolio, unresolved: ExposureSummary[]) {
  const restrictions: string[] = [];
  const correctiveActions: string[] = [];
  const taxableSalesBlocked = portfolio.accounts.some(
    (account) =>
      isTaxableAccount(account) &&
      account.allowSales &&
      !account.allowTaxableSales &&
      portfolio.holdings.some(
        (holding) =>
          holding.accountId === account.id &&
          holding.canSell &&
          unresolved.some(
            (summary) => summary.id === holding.exposureId && summary.status === "overweight",
          ),
      ),
  );
  if (taxableSalesBlocked) {
    restrictions.push("Taxable sales are disabled.");
    correctiveActions.push(
      "Enable taxable sales after reviewing tax consequences, or use future contributions.",
    );
  }
  for (const summary of unresolved.filter((item) => item.status === "underweight")) {
    const purchasableAccounts = portfolio.accounts.filter(
      (account) =>
        account.allowPurchases &&
        portfolio.holdings.some(
          (holding) =>
            holding.accountId === account.id && holding.exposureId === summary.id && holding.canBuy,
        ),
    );
    if (purchasableAccounts.length === 0) {
      restrictions.push(`No account has a purchasable investment mapped to ${summary.name}.`);
      correctiveActions.push(`Add or enable an investment mapped to ${summary.name}.`);
    } else if (
      purchasableAccounts.every(
        (account) =>
          account.cash < portfolio.minimumTrade &&
          !canFundSaleInAccount(portfolio, account, unresolved),
      )
    ) {
      restrictions.push(
        `${summary.name} cannot be funded inside an eligible account under current sale permissions.`,
      );
      correctiveActions.push(
        `Add cash to an account offering ${summary.name}, or allow an eligible sale in that account.`,
      );
    }
  }
  if (unresolved.length && restrictions.length === 0) {
    restrictions.push(
      "Account boundaries and the minimum trade rule prevent a closer practical allocation.",
    );
    correctiveActions.push(
      "Lower the minimum trade amount, add account cash, or adjust investment permissions.",
    );
  }
  return { restrictions: unique(restrictions), correctiveActions: unique(correctiveActions) };
}

function canFundSaleInAccount(
  portfolio: Portfolio,
  account: Account,
  unresolved: ExposureSummary[],
) {
  if (!account.allowSales || (isTaxableAccount(account) && !account.allowTaxableSales))
    return false;
  return portfolio.holdings.some(
    (holding) =>
      holding.accountId === account.id &&
      holding.canSell &&
      holding.value >= portfolio.minimumTrade &&
      unresolved.some(
        (summary) => summary.id === holding.exposureId && summary.status === "overweight",
      ),
  );
}

function clonePortfolio(portfolio: Portfolio): Portfolio {
  return {
    ...portfolio,
    accounts: portfolio.accounts.map((account) => ({ ...account })),
    holdings: portfolio.holdings.map((holding) => ({ ...holding })),
    exposures: portfolio.exposures.map((exposure) => ({ ...exposure })),
  };
}

function orderedAccounts(portfolio: Portfolio): Account[] {
  return [...portfolio.accounts].sort((a, b) => {
    const aTaxable = isTaxableAccount(a) ? 1 : 0;
    const bTaxable = isTaxableAccount(b) ? 1 : 0;
    return aTaxable - bTaxable;
  });
}

function createProjections(before: Portfolio, after: Portfolio): Projection[] {
  const beforeById = new Map(summarizePortfolio(before).map((summary) => [summary.id, summary]));
  return summarizePortfolio(after).map((summary) => ({
    exposureId: summary.id,
    name: summary.name,
    beforePercent: beforeById.get(summary.id)?.currentPercent ?? 0,
    projectedPercent: summary.currentPercent,
    targetPercent: summary.targetPercent,
    remainingDollarDrift: summary.dollarDrift,
    status: summary.status,
  }));
}

function practicalAmount(value: number, minimumTrade: number): number {
  const rounded = roundDown(value);
  return rounded >= minimumTrade ? rounded : 0;
}

function roundDown(value: number): number {
  return Math.floor(Math.max(0, value) / 10) * 10;
}

function consolidateTrades(trades: Trade[]): Trade[] {
  const consolidated = new Map<string, Trade>();
  for (const trade of trades) {
    const key = [
      trade.accountId,
      trade.action,
      trade.holdingId,
      trade.exposureId,
      trade.funding,
    ].join(":");
    const existing = consolidated.get(key);
    if (existing) existing.amount += trade.amount;
    else consolidated.set(key, { ...trade });
  }
  return [...consolidated.values()].filter((trade) => trade.amount > 0);
}

function addTrade(trades: Trade[], trade: Trade) {
  trades.push(trade);
}

function isOutsideTolerance(summary: ExposureSummary): boolean {
  return summary.status === "underweight" || summary.status === "overweight";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function isTaxableAccount(account: Pick<Account, "type">): boolean {
  return account.type === "taxable" || account.type === "other-taxable";
}

export function accountLabel(type: AccountType): string {
  return {
    "401k": "401(k)",
    "traditional-ira": "Traditional IRA",
    "roth-ira": "Roth IRA",
    taxable: "Taxable brokerage",
    "other-tax-advantaged": "Other tax-advantaged",
    "other-taxable": "Other taxable",
  }[type];
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function portfolioTsv(portfolio: Portfolio): string {
  const total = portfolioTotal(portfolio);
  const summaries = summarizePortfolio(portfolio);
  const cash = portfolio.accounts.reduce((sum, account) => sum + account.cash, 0);
  const accountNames = new Map(portfolio.accounts.map((account) => [account.id, account.name]));
  const exposureNames = new Map(
    portfolio.exposures.map((exposure) => [exposure.id, exposure.name]),
  );
  const row = (...values: unknown[]) => values.map(tsvValue).join("\t");
  const lines = [
    row("Finance Planner export"),
    row("Generated", new Date().toISOString()),
    "",
    row("Portfolio summary"),
    row("Metric", "Value"),
    row("Total portfolio", money(total)),
    row("Invested", money(total - cash)),
    row("Uninvested cash", money(cash)),
    row("Accounts", portfolio.accounts.length),
    row("Target portfolio", portfolio.targetName),
    row("Target allocation total", `${targetTotal(portfolio).toFixed(1)}%`),
    "",
    row("Accounts"),
    row("Account", "Type", "Cash", "Allow purchases", "Allow sales", "Contributions expected"),
    ...portfolio.accounts.map((account) =>
      row(
        account.name,
        accountLabel(account.type),
        money(account.cash),
        account.allowPurchases ? "Yes" : "No",
        account.allowSales ? "Yes" : "No",
        account.expectContributions ? "Yes" : "No",
      ),
    ),
    "",
    row("Holdings"),
    row("Fund", "Account", "Exposure", "Current value", "Allow purchases", "Allow sales"),
    ...portfolio.holdings.map((holding) =>
      row(
        holding.name,
        accountNames.get(holding.accountId) ?? "Unknown account",
        exposureNames.get(holding.exposureId) ?? "Unmapped",
        money(holding.value),
        holding.canBuy ? "Yes" : "No",
        holding.canSell ? "Yes" : "No",
      ),
    ),
    "",
    row("Target allocation"),
    row("Exposure", "Target percentage"),
    ...portfolio.exposures.map((exposure) =>
      row(exposure.name, `${exposure.targetPercent.toFixed(1)}%`),
    ),
    "",
    row("Portfolio comparison"),
    row(
      "Exposure",
      "Current percentage",
      "Target percentage",
      "Current value",
      "Target value",
      "Dollar drift",
      "Status",
    ),
    ...summaries.map((summary) =>
      row(
        summary.name,
        `${summary.currentPercent.toFixed(1)}%`,
        `${summary.targetPercent.toFixed(1)}%`,
        money(summary.currentValue),
        money(summary.targetValue),
        signedMoney(summary.dollarDrift),
        statusLabel(summary.status),
      ),
    ),
  ];
  return lines.join("\n");
}

function tsvValue(value: unknown): string {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ");
}

function signedMoney(value: number): string {
  if (value === 0) return money(0);
  return value > 0 ? money(value) : `-${money(Math.abs(value))}`;
}

function statusLabel(status: string): string {
  return status.replace("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
