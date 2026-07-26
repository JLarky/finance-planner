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
  allowTaxableSales: boolean;
  allowTrades: boolean;
  expectContributions: boolean;
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
  holdingName: string;
  amount: number;
  exposureId: string;
};

export type RebalancePlan = { trades: Trade[]; remainingCash: number; message: string };

const DEFAULT_EXPOSURES = [
  ["us-market", "US market", 50],
  ["international-market", "International market", 25],
  ["small-value", "Small-cap value", 15],
  ["bonds", "Bonds", 10],
] as const;

export function createDefaultPortfolio(): Portfolio {
  return {
    accounts: [],
    holdings: [],
    exposures: DEFAULT_EXPOSURES.map(([id, name, targetPercent]) => ({ id, name, targetPercent })),
    relativeThreshold: 0.2,
    minimumTrade: 50,
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
      exposure.targetPercent > 0
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
  const summaries = summarizePortfolio(portfolio);
  const projected = new Map(summaries.map((summary) => [summary.id, summary.currentValue]));
  const trades: Trade[] = [];
  let remainingCash = portfolio.accounts.reduce((sum, account) => sum + account.cash, 0);
  const accounts = portfolio.accounts.filter((account) => account.allowTrades);
  const underweight = [...summaries]
    .filter((summary) => summary.dollarDrift < 0)
    .sort(
      (a, b) =>
        a.dollarDrift / Math.max(a.targetValue, 1) - b.dollarDrift / Math.max(b.targetValue, 1),
    );

  for (const account of accounts) {
    let cash = account.cash;
    for (const summary of underweight) {
      if (cash < portfolio.minimumTrade) break;
      const holding = portfolio.holdings.find(
        (item) => item.accountId === account.id && item.exposureId === summary.id && item.canBuy,
      );
      if (!holding) continue;
      const shortfall = Math.max(0, summary.targetValue - (projected.get(summary.id) ?? 0));
      const amount = Math.floor(Math.min(cash, shortfall) / 10) * 10;
      if (amount < portfolio.minimumTrade) continue;
      trades.push({
        accountId: account.id,
        action: "buy",
        holdingName: holding.name,
        amount,
        exposureId: summary.id,
      });
      cash -= amount;
      remainingCash -= amount;
      projected.set(summary.id, (projected.get(summary.id) ?? 0) + amount);
    }
  }

  const unresolved = summarizePortfolio({
    ...portfolio,
    holdings: portfolio.holdings.map((holding) => ({
      ...holding,
      value:
        holding.value +
        trades
          .filter(
            (trade) =>
              trade.action === "buy" &&
              trade.exposureId === holding.exposureId &&
              trade.accountId === holding.accountId,
          )
          .reduce((sum, trade) => sum + trade.amount, 0),
    })),
    accounts: portfolio.accounts.map((account) => ({
      ...account,
      cash:
        account.cash -
        trades
          .filter((trade) => trade.action === "buy" && trade.accountId === account.id)
          .reduce((sum, trade) => sum + trade.amount, 0),
    })),
  }).some((summary) => summary.status === "underweight" || summary.status === "overweight");
  return {
    trades,
    remainingCash,
    message:
      trades.length === 0
        ? "No cash-first trades are available under the current restrictions."
        : unresolved
          ? "Cash was invested where eligible, but some drift remains under the current restrictions."
          : "All eligible cash was invested and remaining drift is within tolerance.",
  };
}

export function recommendContribution(
  portfolio: Portfolio,
  amount: number,
  accountId: string,
): RebalancePlan {
  if (amount <= 0)
    return {
      trades: [],
      remainingCash: amount,
      message: "Enter a contribution greater than zero.",
    };
  const account = portfolio.accounts.find((item) => item.id === accountId);
  if (!account)
    return { trades: [], remainingCash: amount, message: "Choose a destination account." };
  const future = {
    ...portfolio,
    accounts: portfolio.accounts.map((item) =>
      item.id === accountId ? { ...item, cash: item.cash + amount } : item,
    ),
  };
  const summaries = summarizePortfolio(future).filter((summary) => summary.dollarDrift < 0);
  const trades: Trade[] = [];
  let remaining = amount;
  for (const summary of summaries.sort((a, b) => a.dollarDrift - b.dollarDrift)) {
    const holding = portfolio.holdings.find(
      (item) => item.accountId === accountId && item.exposureId === summary.id && item.canBuy,
    );
    if (!holding || remaining <= 0) continue;
    const needed = Math.max(0, -summary.dollarDrift);
    const allocation = Math.floor(Math.min(remaining, needed) / 10) * 10;
    if (allocation < portfolio.minimumTrade) continue;
    trades.push({
      accountId,
      action: "buy",
      holdingName: holding.name,
      amount: allocation,
      exposureId: summary.id,
    });
    remaining -= allocation;
  }
  return {
    trades,
    remainingCash: remaining,
    message: trades.length
      ? "Contribution allocated to the largest eligible shortfalls."
      : "No eligible underweight investments were found in that account.",
  };
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
