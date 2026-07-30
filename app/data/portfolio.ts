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

export type AvailableInvestment = {
  id: string;
  accountId: string;
  exposureId: string;
  name: string;
  preferred: boolean;
  canBuy: boolean;
  canSell: boolean;
};

export type Exposure = { id: string; name: string; targetPercent: number };

export type Portfolio = {
  accounts: Account[];
  holdings: Holding[];
  availableInvestments: AvailableInvestment[];
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

export type DistributionSelection = {
  us: number;
  tilt: number;
  stocks: number;
  realEstate: number;
};

export const DEFAULT_DISTRIBUTION: DistributionSelection = {
  us: 60,
  tilt: 50,
  stocks: 100,
  realEstate: 0,
};

function boundedPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function distributionQuery(selection: DistributionSelection): string {
  return new URLSearchParams({
    us: String(boundedPercent(selection.us)),
    tilt: String(boundedPercent(selection.tilt)),
    stocks: String(boundedPercent(selection.stocks)),
    realEstate: String(boundedPercent(selection.realEstate)),
  }).toString();
}

export function parseDistributionQuery(value: string | null): DistributionSelection | null {
  if (!value) return null;
  const params = new URLSearchParams(value);
  const values = ["us", "tilt", "stocks", "realEstate"].map((key) => Number(params.get(key)));
  if (values.some((item) => !Number.isFinite(item) || item < 0 || item > 100)) return null;
  return { us: values[0]!, tilt: values[1]!, stocks: values[2]!, realEstate: values[3]! };
}

export function distributionExposures(selection: DistributionSelection): Exposure[] {
  const us = boundedPercent(selection.us);
  const tilt = boundedPercent(selection.tilt) / 100;
  const realEstate = boundedPercent(selection.realEstate);
  const investable = 100 - realEstate;
  const stocks = investable * (boundedPercent(selection.stocks) / 100);
  const bonds = investable - stocks;
  const usShare = 0.2 + (us / 100) * (2 / 3);
  const internationalShare = 1 - usShare;
  const emergingMarkets = stocks * internationalShare * 0.25;
  const developedInternational = stocks * internationalShare - emergingMarkets;
  const usSmallValue = stocks * usShare * tilt * (1 / 3);
  const developedInternationalSmallValue = developedInternational * tilt * 0.4;
  const exposure = (id: string, name: string, targetPercent: number): Exposure => ({
    id,
    name,
    targetPercent: Math.round(targetPercent * 100) / 100,
  });
  const exposures = [
    exposure("broad-us", "Broad US market", stocks * usShare - usSmallValue),
    exposure("us-small-value", "US small-cap value", usSmallValue),
    exposure(
      "developed-international",
      "Developed international broad",
      developedInternational - developedInternationalSmallValue,
    ),
    exposure(
      "developed-international-small-value",
      "Developed international small-cap value",
      developedInternationalSmallValue,
    ),
    exposure("emerging-markets", "Emerging markets", emergingMarkets),
    exposure("bonds", "Bonds", bonds),
    exposure("real-estate", "Real estate", realEstate),
  ];
  const rounded = exposures.map((item) => ({
    ...item,
    targetPercent: Math.round(item.targetPercent * 100) / 100,
  }));
  const total = rounded.slice(0, -1).reduce((sum, item) => sum + item.targetPercent, 0);
  const last = rounded.at(-1);
  if (last) last.targetPercent = Math.round((100 - total) * 100) / 100;
  return rounded;
}

export function createDefaultPortfolio(): Portfolio {
  return {
    accounts: [],
    holdings: [],
    availableInvestments: [],
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
    availableInvestments: portfolio.availableInvestments ?? [],
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
  const eligible = purchaseOptions(working, accountId);
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
  const accountHoldings = purchaseOptions(portfolio, account.id);
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
          purchaseOptions(portfolio, account.id, summary.id).length > 0,
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
    const buyHolding = purchaseOptions(portfolio, account.id, buy.id)[0]!;
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
        account.allowPurchases && purchaseOptions(portfolio, account.id, summary.id).length > 0,
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
  const cloned = {
    ...portfolio,
    accounts: portfolio.accounts.map((account) => ({ ...account })),
    holdings: portfolio.holdings.map((holding) => ({ ...holding })),
    availableInvestments: portfolio.availableInvestments.map((investment) => ({ ...investment })),
    exposures: portfolio.exposures.map((exposure) => ({ ...exposure })),
  };
  for (const investment of cloned.availableInvestments) {
    if (
      !cloned.holdings.some(
        (holding) =>
          holding.accountId === investment.accountId &&
          holding.exposureId === investment.exposureId &&
          holding.name === investment.name,
      )
    ) {
      cloned.holdings.push({
        id: investment.id,
        accountId: investment.accountId,
        name: investment.name,
        value: 0,
        exposureId: investment.exposureId,
        canBuy: investment.canBuy,
        canSell: investment.canSell,
      });
    }
  }
  return cloned;
}

function purchaseOptions(portfolio: Portfolio, accountId: string, exposureId?: string): Holding[] {
  const exposureIds =
    exposureId == null
      ? new Set([
          ...portfolio.holdings
            .filter((holding) => holding.accountId === accountId)
            .map((holding) => holding.exposureId),
          ...portfolio.availableInvestments
            .filter((investment) => investment.accountId === accountId)
            .map((investment) => investment.exposureId),
        ])
      : new Set([exposureId]);
  const candidates = [...exposureIds].flatMap((candidateExposureId) => {
    const available = portfolio.availableInvestments.filter(
      (investment) =>
        investment.accountId === accountId &&
        investment.exposureId === candidateExposureId &&
        investment.canBuy,
    );
    if (available.length) return available;
    return portfolio.holdings
      .filter(
        (holding) =>
          holding.accountId === accountId &&
          holding.exposureId === candidateExposureId &&
          holding.canBuy,
      )
      .map((holding) => ({
        id: holding.id,
        accountId: holding.accountId,
        exposureId: holding.exposureId,
        name: holding.name,
        preferred: false,
        canBuy: holding.canBuy,
        canSell: holding.canSell,
      }));
  });
  return candidates
    .sort((a, b) => Number(b.preferred) - Number(a.preferred))
    .map(
      (investment) =>
        portfolio.holdings.find(
          (holding) =>
            holding.accountId === investment.accountId &&
            holding.exposureId === investment.exposureId &&
            holding.name === investment.name,
        )!,
    )
    .filter((holding): holding is Holding => Boolean(holding));
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
    row(
      "Account",
      "Type",
      "Cash",
      "Allow purchases",
      "Allow sales",
      "Taxable sales allowed",
      "Contributions expected",
    ),
    ...portfolio.accounts.map((account) =>
      row(
        account.name,
        accountLabel(account.type),
        money(account.cash),
        account.allowPurchases ? "Yes" : "No",
        account.allowSales ? "Yes" : "No",
        account.allowTaxableSales ? "Yes" : "No",
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
    row("Available investments"),
    row("Fund", "Account", "Exposure", "Preferred", "Allow purchases", "Allow sales"),
    ...portfolio.availableInvestments.map((investment) =>
      row(
        investment.name,
        accountNames.get(investment.accountId) ?? "Unknown account",
        exposureNames.get(investment.exposureId) ?? "Unmapped",
        investment.preferred ? "Yes" : "No",
        investment.canBuy ? "Yes" : "No",
        investment.canSell ? "Yes" : "No",
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

export type PortfolioImportPreview = {
  portfolio: Portfolio;
  format: "json" | "tsv";
  accounts: number;
  holdings: number;
  availableInvestments: number;
  exposures: number;
  warnings: string[];
};

export type PortfolioImportChange = {
  kind: "added" | "removed" | "changed";
  area: "account" | "holding" | "available-investment" | "exposure" | "portfolio";
  label: string;
  detail: string;
};

export function comparePortfolios(
  current: Portfolio,
  incoming: Portfolio,
): PortfolioImportChange[] {
  const changes: PortfolioImportChange[] = [];
  const currentExposureNames = new Map(
    current.exposures.map((exposure) => [exposure.id, exposure.name]),
  );
  const incomingExposureNames = new Map(
    incoming.exposures.map((exposure) => [exposure.id, exposure.name]),
  );
  const currentAccountNames = new Map(
    current.accounts.map((account) => [account.id, account.name]),
  );
  const incomingAccountNames = new Map(
    incoming.accounts.map((account) => [account.id, account.name]),
  );

  addRecordChanges(
    changes,
    "account",
    current.accounts,
    incoming.accounts,
    (account) => account.name,
    accountDetails,
  );
  const currentAvailableAccountNames = new Map(
    current.accounts.map((account) => [account.id, account.name]),
  );
  const incomingAvailableAccountNames = new Map(
    incoming.accounts.map((account) => [account.id, account.name]),
  );
  const currentAvailableExposureNames = new Map(
    current.exposures.map((exposure) => [exposure.id, exposure.name]),
  );
  const incomingAvailableExposureNames = new Map(
    incoming.exposures.map((exposure) => [exposure.id, exposure.name]),
  );
  addRecordChanges(
    changes,
    "available-investment",
    current.availableInvestments,
    incoming.availableInvestments,
    (investment) =>
      `${currentAvailableAccountNames.get(investment.accountId) ?? "Unknown account"} / ${investment.name}`,
    (investment) =>
      `${currentAvailableExposureNames.get(investment.exposureId) ?? "Unmapped"}, preferred ${yesNo(investment.preferred)}, purchases ${yesNo(investment.canBuy)}, sales ${yesNo(investment.canSell)}`,
    (investment) =>
      `${incomingAvailableAccountNames.get(investment.accountId) ?? "Unknown account"} / ${investment.name}`,
    (investment) =>
      `${incomingAvailableExposureNames.get(investment.exposureId) ?? "Unmapped"}, preferred ${yesNo(investment.preferred)}, purchases ${yesNo(investment.canBuy)}, sales ${yesNo(investment.canSell)}`,
  );
  addRecordChanges(
    changes,
    "exposure",
    current.exposures,
    incoming.exposures,
    (exposure) => exposure.name,
    (exposure) => `${exposure.targetPercent.toFixed(1)}% target`,
  );
  addRecordChanges(
    changes,
    "holding",
    current.holdings,
    incoming.holdings,
    (holding) =>
      `${currentAccountNames.get(holding.accountId) ?? "Unknown account"} / ${holding.name}`,
    (holding) =>
      `${money(holding.value)}, ${currentExposureNames.get(holding.exposureId) ?? "Unmapped"}, purchases ${yesNo(holding.canBuy)}, sales ${yesNo(holding.canSell)}`,
    (holding) =>
      `${incomingAccountNames.get(holding.accountId) ?? "Unknown account"} / ${holding.name}`,
    (holding) =>
      `${money(holding.value)}, ${incomingExposureNames.get(holding.exposureId) ?? "Unmapped"}, purchases ${yesNo(holding.canBuy)}, sales ${yesNo(holding.canSell)}`,
  );

  if (current.targetName !== incoming.targetName)
    changes.push({
      kind: "changed",
      area: "portfolio",
      label: "Target name",
      detail: `${current.targetName} → ${incoming.targetName}`,
    });
  if (current.relativeThreshold !== incoming.relativeThreshold)
    changes.push({
      kind: "changed",
      area: "portfolio",
      label: "Relative tolerance",
      detail: `${current.relativeThreshold} → ${incoming.relativeThreshold}`,
    });
  if (current.minimumTrade !== incoming.minimumTrade)
    changes.push({
      kind: "changed",
      area: "portfolio",
      label: "Minimum trade",
      detail: `${money(current.minimumTrade)} → ${money(incoming.minimumTrade)}`,
    });
  return changes;
}

function addRecordChanges<T>(
  changes: PortfolioImportChange[],
  area: PortfolioImportChange["area"],
  current: T[],
  incoming: T[],
  currentKey: (value: T) => string,
  details: (value: T) => string,
  incomingKey: (value: T) => string = currentKey,
  incomingDetails: (value: T) => string = details,
) {
  const currentByKey = new Map(current.map((value) => [currentKey(value), value]));
  const incomingByKey = new Map(incoming.map((value) => [incomingKey(value), value]));
  for (const [key, value] of incomingByKey) {
    const oldValue = currentByKey.get(key);
    if (!oldValue) {
      changes.push({ kind: "added", area, label: key, detail: incomingDetails(value) });
    } else if (details(oldValue) !== incomingDetails(value)) {
      changes.push({
        kind: "changed",
        area,
        label: key,
        detail: `${details(oldValue)} → ${incomingDetails(value)}`,
      });
    }
  }
  for (const [key, value] of currentByKey) {
    if (!incomingByKey.has(key))
      changes.push({ kind: "removed", area, label: key, detail: details(value) });
  }
}

function accountDetails(account: Account): string {
  return `${accountLabel(account.type)}, cash ${money(account.cash)}, purchases ${yesNo(account.allowPurchases)}, sales ${yesNo(account.allowSales)}, taxable sales ${yesNo(account.allowTaxableSales)}, contributions ${yesNo(account.expectContributions)}`;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function parsePortfolioImport(
  input: string,
): { ok: true; preview: PortfolioImportPreview } | { ok: false; error: string } {
  const source = input.trim();
  if (!source) return { ok: false, error: "Paste a JSON or tab-separated export first." };
  try {
    if (source.startsWith("{")) return parseJsonImport(source);
    return parseTsvImport(source);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read this import.",
    };
  }
}

function parseJsonImport(source: string): { ok: true; preview: PortfolioImportPreview } {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("The JSON is not valid. Check for missing commas or quotes.");
  }
  const portfolio = normalizeImportedPortfolio(value);
  return createImportPreview(portfolio, "json");
}

function parseTsvImport(source: string): { ok: true; preview: PortfolioImportPreview } {
  const rows = source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()));
  let section = "";
  let hasAccountsSection = false;
  let targetName = "Global Factor Mix";
  const accounts: Account[] = [];
  const holdings: Holding[] = [];
  const availableInvestments: AvailableInvestment[] = [];
  const pendingHoldings: Array<{
    name: string;
    accountName: string;
    exposureName: string;
    value: number;
    canBuy: boolean;
    canSell: boolean;
  }> = [];
  const pendingAvailableInvestments: Array<{
    name: string;
    accountName: string;
    exposureName: string;
    preferred: boolean;
    canBuy: boolean;
    canSell: boolean;
  }> = [];
  const exposures: Exposure[] = [];
  const accountByName = new Map<string, Account>();
  const exposureByName = new Map<string, Exposure>();

  for (const row of rows) {
    const first = row[0] ?? "";
    if (!first) continue;
    if (row.length === 1) {
      section = ["Accounts", "Holdings", "Available investments", "Target allocation"].includes(
        first,
      )
        ? first
        : "";
      if (first === "Accounts") hasAccountsSection = true;
      continue;
    }
    if (first === "Target portfolio") {
      targetName = row[1] || targetName;
      continue;
    }
    if (section === "Accounts" && first !== "Account") {
      const hasTaxableSalesColumn = row.length >= 7;
      const account = {
        id: `import-account-${accounts.length + 1}`,
        name: first,
        type: accountTypeFromImport(row[1] ?? ""),
        cash: importNumber(row[2], "account cash"),
        allowPurchases: importBoolean(row[3], "account purchases"),
        allowSales: importBoolean(row[4], "account sales"),
        allowTaxableSales: hasTaxableSalesColumn ? importBoolean(row[5], "taxable sales") : false,
        expectContributions: importBoolean(
          hasTaxableSalesColumn ? row[6] : row[5],
          "contributions expected",
        ),
      } satisfies Account;
      if (accountByName.has(account.name))
        throw new Error(`Account names must be unique: ${account.name}.`);
      accountByName.set(account.name, account);
      accounts.push(account);
    } else if (section === "Holdings" && first !== "Fund") {
      pendingHoldings.push({
        name: first,
        accountName: row[1] ?? "",
        exposureName: row[2] ?? "",
        value: importNumber(row[3], "holding value"),
        canBuy: importBoolean(row[4], "holding purchases"),
        canSell: importBoolean(row[5], "holding sales"),
      });
    } else if (section === "Available investments" && first !== "Fund") {
      pendingAvailableInvestments.push({
        name: first,
        accountName: row[1] ?? "",
        exposureName: row[2] ?? "",
        preferred: importBoolean(row[3], "investment preferred"),
        canBuy: importBoolean(row[4], "investment purchases"),
        canSell: importBoolean(row[5], "investment sales"),
      });
    } else if (section === "Target allocation" && first !== "Exposure") {
      const exposure = {
        id: `import-exposure-${exposures.length + 1}`,
        name: first,
        targetPercent: importNumber(row[1], "target percentage"),
      };
      if (exposureByName.has(exposure.name))
        throw new Error(`Exposure names must be unique: ${exposure.name}.`);
      exposureByName.set(exposure.name, exposure);
      exposures.push(exposure);
    }
  }
  if (!hasAccountsSection) throw new Error("The TSV does not contain an Accounts section.");
  if (!exposures.length)
    throw new Error("The TSV does not contain a Target allocation section with data.");
  for (const pending of pendingHoldings) {
    const account = accountByName.get(pending.accountName);
    const exposure = exposureByName.get(pending.exposureName);
    if (!account) throw new Error(`Holding references an unknown account: ${pending.accountName}.`);
    if (!exposure)
      throw new Error(`Holding references an unknown exposure: ${pending.exposureName}.`);
    holdings.push({
      id: `import-holding-${holdings.length + 1}`,
      accountId: account.id,
      name: pending.name,
      value: pending.value,
      exposureId: exposure.id,
      canBuy: pending.canBuy,
      canSell: pending.canSell,
    });
  }
  for (const pending of pendingAvailableInvestments) {
    const account = accountByName.get(pending.accountName);
    const exposure = exposureByName.get(pending.exposureName);
    if (!account)
      throw new Error(
        `Available investment references an unknown account: ${pending.accountName}.`,
      );
    if (!exposure)
      throw new Error(
        `Available investment references an unknown exposure: ${pending.exposureName}.`,
      );
    availableInvestments.push({
      id: `import-available-investment-${availableInvestments.length + 1}`,
      accountId: account.id,
      name: pending.name,
      exposureId: exposure.id,
      preferred: pending.preferred,
      canBuy: pending.canBuy,
      canSell: pending.canSell,
    });
  }
  return createImportPreview(
    {
      accounts,
      holdings,
      availableInvestments,
      exposures,
      targetName,
      relativeThreshold: 0.2,
      minimumTrade: 50,
    },
    "tsv",
  );
}

function createImportPreview(
  portfolio: Portfolio,
  format: "json" | "tsv",
): { ok: true; preview: PortfolioImportPreview } {
  const warnings: string[] = [];
  const total = targetTotal(portfolio);
  if (Math.abs(total - 100) >= 0.001)
    warnings.push(`Target allocations total ${total.toFixed(1)}%, not 100%.`);
  if (!portfolio.holdings.length)
    warnings.push("No holdings were imported; add holdings before planning a rebalance.");
  return {
    ok: true,
    preview: {
      portfolio,
      format,
      accounts: portfolio.accounts.length,
      holdings: portfolio.holdings.length,
      availableInvestments: portfolio.availableInvestments.length,
      exposures: portfolio.exposures.length,
      warnings,
    },
  };
}

function normalizeImportedPortfolio(value: unknown): Portfolio {
  if (!value || typeof value !== "object") throw new Error("JSON must contain a portfolio object.");
  const raw = value as Partial<Portfolio>;
  if (
    !Array.isArray(raw.accounts) ||
    !Array.isArray(raw.holdings) ||
    !Array.isArray(raw.availableInvestments) ||
    !Array.isArray(raw.exposures)
  ) {
    throw new Error(
      "JSON must include accounts, holdings, availableInvestments, and exposures arrays.",
    );
  }
  if (typeof raw.targetName !== "string") throw new Error("JSON must include a targetName string.");
  const portfolio = normalizePortfolio(raw as Portfolio);
  for (const account of portfolio.accounts) {
    if (!account.id || !account.name) throw new Error("Every account needs an id and name.");
    if (!Number.isFinite(account.cash) || account.cash < 0)
      throw new Error(`Invalid cash for ${account.name}.`);
  }
  for (const exposure of portfolio.exposures) {
    if (
      !exposure.id ||
      !exposure.name ||
      !Number.isFinite(exposure.targetPercent) ||
      exposure.targetPercent < 0
    ) {
      throw new Error("Every exposure needs an id, name, and non-negative target percentage.");
    }
  }
  const accountIds = new Set(portfolio.accounts.map((account) => account.id));
  const exposureIds = new Set(portfolio.exposures.map((exposure) => exposure.id));
  for (const holding of portfolio.holdings) {
    if (
      !holding.id ||
      !holding.name ||
      !accountIds.has(holding.accountId) ||
      !exposureIds.has(holding.exposureId)
    ) {
      throw new Error(
        `Holding ${holding.name || "(unnamed)"} references an unknown account or exposure.`,
      );
    }
    if (!Number.isFinite(holding.value) || holding.value < 0)
      throw new Error(`Invalid value for ${holding.name}.`);
  }
  for (const investment of portfolio.availableInvestments) {
    if (
      !investment.id ||
      !investment.name ||
      !accountIds.has(investment.accountId) ||
      !exposureIds.has(investment.exposureId)
    ) {
      throw new Error(
        `Available investment ${investment.name || "(unnamed)"} references an unknown account or exposure.`,
      );
    }
  }
  return portfolio;
}

function accountTypeFromImport(value: string): AccountType {
  const labels: Record<string, AccountType> = {
    "401(k)": "401k",
    "Traditional IRA": "traditional-ira",
    "Roth IRA": "roth-ira",
    "Taxable brokerage": "taxable",
    "Other tax-advantaged": "other-tax-advantaged",
    "Other taxable": "other-taxable",
  };
  const type = labels[value] ?? value;
  if (
    !(Object.keys(labels).includes(type) || Object.values(labels).includes(type as AccountType))
  ) {
    throw new Error(`Unknown account type: ${value}.`);
  }
  return type as AccountType;
}

function importBoolean(value: string | undefined, label: string): boolean {
  if (value === "Yes") return true;
  if (value === "No") return false;
  throw new Error(`Expected Yes or No for ${label}.`);
}

function importNumber(value: string | undefined, label: string): number {
  const normalized = (value ?? "").replace(/[,$%]/g, "").replace(/^\+/, "").trim();
  const result = Number(normalized);
  if (!Number.isFinite(result) || result < 0) throw new Error(`Invalid ${label}: ${value ?? ""}.`);
  return result;
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
