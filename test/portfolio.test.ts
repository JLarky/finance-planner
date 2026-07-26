import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultPortfolio,
  portfolioTotal,
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
    allowTrades: true,
    expectContributions: true,
  });
  value.holdings.push({
    id: "holding",
    accountId: "account",
    name: "Investment A",
    value: 0,
    exposureId: "us-market",
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
  assert.equal(
    summarizePortfolio(value).find((item) => item.id === "us-market")?.currentPercent,
    0,
  );
});

void test("rebalance uses eligible account cash first", () => {
  const value = portfolio();
  const plan = recommendRebalance(value);
  assert.deepEqual(plan.trades[0], {
    accountId: "account",
    action: "buy",
    holdingName: "Investment A",
    amount: 50,
    exposureId: "us-market",
  });
  assert.equal(plan.remainingCash, 50);
});

void test("contribution planning does not sell and allocates eligible money", () => {
  const value = portfolio();
  value.accounts[0]!.cash = 0;
  value.exposures = [{ id: "us-market", name: "US market", targetPercent: 100 }];
  const plan = recommendContribution(value, 100, "account");
  assert.equal(plan.trades[0]?.action, "buy");
  assert.equal(plan.trades[0]?.amount, 100);
  assert.equal(plan.remainingCash, 0);
});
