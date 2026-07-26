import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultPortfolio,
  portfolioTotal,
  portfolioTsv,
  recommendContribution,
  recommendRebalance,
  summarizePortfolio,
  targetTotal,
} from "../app/data/portfolio.ts";

function portfolio() {
  const value = createDefaultPortfolio();
  value.accounts.push({
    id: "account",
    name: "Example account",
    type: "taxable",
    cash: 100,
    allowTaxableSales: false,
    allowPurchases: true,
    allowSales: true,
    expectContributions: true,
  });
  value.holdings.push({
    id: "holding",
    accountId: "account",
    name: "Investment A",
    value: 0,
    exposureId: "broad-us",
    canBuy: true,
    canSell: true,
  });
  return value;
}

void test("default target exposures total 100 percent", () => {
  assert.equal(targetTotal(createDefaultPortfolio()), 100);
});

void test("summaries include cash in the portfolio denominator", () => {
  const value = portfolio();
  assert.equal(portfolioTotal(value), 100);
  assert.equal(summarizePortfolio(value).find((item) => item.id === "broad-us")?.currentPercent, 0);
});

void test("portfolio exports as tab-separated sections", () => {
  const value = portfolio();
  const exported = portfolioTsv(value);
  assert.match(exported, /Finance Planner export\nGenerated\t/);
  assert.match(exported, /Portfolio summary\nMetric\tValue/);
  assert.match(exported, /Accounts\nAccount\tType\tCash/);
  assert.match(exported, /Holdings\nFund\tAccount\tExposure/);
  assert.match(exported, /Portfolio comparison\nExposure\tCurrent percentage/);
  assert.ok(exported.split("\n").some((line) => line.includes("\t")));
  assert.equal(exported.includes(","), false);
});

void test("portfolio export keeps dollar drift parseable in spreadsheets", () => {
  const value = createDefaultPortfolio();
  value.exposures = [{ id: "broad-us", name: "Broad US market", targetPercent: 100 }];
  value.accounts.push({
    id: "account",
    name: "Example account",
    type: "taxable",
    cash: 0,
    allowTaxableSales: false,
    allowPurchases: true,
    allowSales: true,
    expectContributions: true,
  });
  value.holdings.push({
    id: "holding",
    accountId: "account",
    name: "Investment A",
    value: 100,
    exposureId: "broad-us",
    canBuy: true,
    canSell: true,
  });
  const exported = portfolioTsv(value);
  assert.equal(exported.includes("+$0"), false);
  assert.match(exported, /\t\$0\tOn Target/);
});

void test("zero-value portfolios do not mark every exposure underweight", () => {
  const value = createDefaultPortfolio();
  assert.ok(summarizePortfolio(value).every((item) => item.status === "on-target"));
});

void test("rebalance uses eligible account cash first", () => {
  const value = portfolio();
  const plan = recommendRebalance(value);
  assert.deepEqual(plan.trades[0], {
    accountId: "account",
    action: "buy",
    holdingId: "holding",
    holdingName: "Investment A",
    amount: 50,
    exposureId: "broad-us",
    funding: "cash",
  });
  assert.equal(plan.remainingCash, 50);
});

void test("rebalance generates account-local exchanges after using cash", () => {
  const value = createDefaultPortfolio();
  value.exposures = [
    { id: "broad-us", name: "Broad US market", targetPercent: 50 },
    { id: "us-small-value", name: "US small-cap value", targetPercent: 50 },
  ];
  value.accounts.push({
    id: "ira",
    name: "IRA",
    type: "traditional-ira",
    cash: 0,
    allowPurchases: true,
    allowSales: true,
    allowTaxableSales: false,
    expectContributions: true,
  });
  value.holdings.push(
    {
      id: "broad",
      accountId: "ira",
      name: "VTI",
      value: 100,
      exposureId: "broad-us",
      canBuy: true,
      canSell: true,
    },
    {
      id: "small",
      accountId: "ira",
      name: "AVUV",
      value: 0,
      exposureId: "us-small-value",
      canBuy: true,
      canSell: true,
    },
  );
  const plan = recommendRebalance(value);
  assert.deepEqual(
    plan.trades.map((trade) => [trade.action, trade.holdingName, trade.amount]),
    [
      ["sell", "VTI", 50],
      ["buy", "AVUV", 50],
    ],
  );
  assert.equal(plan.withinTolerance, true);
});

void test("contribution planning does not sell and allocates eligible money", () => {
  const value = portfolio();
  value.accounts[0]!.cash = 0;
  value.exposures = [{ id: "broad-us", name: "Broad US market", targetPercent: 100 }];
  const plan = recommendContribution(value, 100, "account");
  assert.equal(plan.trades[0]?.action, "buy");
  assert.equal(plan.trades[0]?.amount, 100);
  assert.equal(plan.remainingCash, 0);
});
