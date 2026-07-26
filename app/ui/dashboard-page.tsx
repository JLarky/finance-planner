import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { User } from "../data/users.ts";
import {
  accountLabel,
  money,
  portfolioTotal,
  summarizePortfolio,
  targetTotal,
  type RebalancePlan,
} from "../data/portfolio.ts";
import { Document } from "./document.tsx";
import { button, muted, shell } from "./styles.ts";

export function DashboardPage(h: Handle<{ user: User; plan?: RebalancePlan }>) {
  const portfolio = h.props.user.portfolio;
  const summaries = summarizePortfolio(portfolio);
  const total = portfolioTotal(portfolio);
  const cash = portfolio.accounts.reduce((sum, account) => sum + account.cash, 0);
  const validTargets = Math.abs(targetTotal(portfolio) - 100) < 0.001;
  const hasAccounts = portfolio.accounts.length > 0;
  const hasHoldings = portfolio.holdings.length > 0;
  const canRebalance = validTargets && hasAccounts && hasHoldings;
  const accountName = new Map(portfolio.accounts.map((account) => [account.id, account.name]));
  return () => (
    <Document title="Your plan · Finance Planner">
      <main mix={shell}>
        <header
          mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}
        >
          <strong>Finance Planner</strong>
          <form method="POST" action="/logout">
            <button mix={button({ secondary: true })}>Sign out</button>
          </form>
        </header>
        <section mix={css({ padding: "56px 0" })}>
          <p mix={eyebrow}>Portfolio workspace</p>
          <h1 mix={css({ fontSize: "clamp(38px, 6vw, 60px)", margin: "14px 0" })}>
            See the whole plan.
          </h1>
          <p mix={css({ ...muted, maxWidth: "680px" })}>
            Enter your accounts and holdings, choose target exposures, then compare the current
            portfolio with a practical next step.
          </p>
          <div mix={progressGrid}>
            <ProgressStep number="1" label="Accounts" complete={hasAccounts} />
            <ProgressStep number="2" label="Holdings" complete={hasHoldings} />
            <ProgressStep number="3" label="Targets" complete={validTargets} />
            <ProgressStep number="4" label="Plan" complete={canRebalance} />
          </div>
          <div mix={metricGrid}>
            <Metric label="Portfolio value" value={money(total)} />
            <Metric label="Uninvested cash" value={money(cash)} />
            <Metric label="Accounts" value={String(portfolio.accounts.length)} />
            <Metric
              label="Target total"
              value={`${targetTotal(portfolio).toFixed(1)}%`}
              tone={validTargets ? "normal" : "warning"}
            />
          </div>
          {h.props.plan ? <PlanResult plan={h.props.plan} accountName={accountName} /> : null}
          <section mix={panel}>
            <div mix={sectionHeader}>
              <div>
                <p mix={eyebrow}>Allocation</p>
                <h2 mix={heading}>Current versus target</h2>
              </div>
              <form method="POST" action="/app">
                <input type="hidden" name="intent" value="rebalance" />
                <button mix={button({})} disabled={!canRebalance}>
                  {canRebalance ? "Rebalance with cash" : "Finish setup to rebalance"}
                </button>
              </form>
            </div>
            {!validTargets ? (
              <p mix={warning}>Targets must total 100% before a plan can be considered complete.</p>
            ) : null}
            {!hasHoldings ? (
              <EmptyState
                title="Your allocation will appear here"
                detail="Add an account and at least one holding below to see current versus target."
              />
            ) : (
              <div mix={tableScroll}>
                <table mix={table}>
                  <thead>
                    <tr>
                      <th>Exposure</th>
                      <th>Current</th>
                      <th>Target</th>
                      <th>Value</th>
                      <th>Drift</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((summary) => (
                      <tr key={summary.id}>
                        <td>{summary.name}</td>
                        <td>{summary.currentPercent.toFixed(1)}%</td>
                        <td>{summary.targetPercent.toFixed(1)}%</td>
                        <td>{money(summary.currentValue)}</td>
                        <td>
                          {summary.dollarDrift >= 0 ? "+" : "−"}
                          {money(Math.abs(summary.dollarDrift))}
                        </td>
                        <td>
                          <span mix={statusStyle(summary.status)}>
                            {summary.status.replace("-", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <AccountSummary accounts={portfolio.accounts} holdings={portfolio.holdings} />
          <div mix={twoColumns}>
            <AccountForm />
            <HoldingForm accounts={portfolio.accounts} exposures={portfolio.exposures} />
          </div>
          <div mix={twoColumns}>
            <TargetForm exposures={portfolio.exposures} total={targetTotal(portfolio)} />
            <ContributionForm accounts={portfolio.accounts} />
          </div>
        </section>
      </main>
    </Document>
  );
}

function Metric(h: Handle<{ label: string; value: string; tone?: "normal" | "warning" }>) {
  return () => (
    <article mix={metric}>
      <p mix={css(muted)}>{h.props.label}</p>
      <strong
        mix={css({ fontSize: "25px", color: h.props.tone === "warning" ? "#ffcf79" : "#f1f6ed" })}
      >
        {h.props.value}
      </strong>
    </article>
  );
}

function ProgressStep(h: Handle<{ number: string; label: string; complete: boolean }>) {
  return () => (
    <div mix={[progressStep, css({ opacity: h.props.complete ? 1 : 0.65 })]}>
      <span mix={progressNumber}>{h.props.complete ? "✓" : h.props.number}</span>
      <span>{h.props.label}</span>
    </div>
  );
}

function EmptyState(h: Handle<{ title: string; detail: string }>) {
  return () => (
    <div mix={emptyState}>
      <strong>{h.props.title}</strong>
      <p mix={css(muted)}>{h.props.detail}</p>
    </div>
  );
}

function AccountSummary(
  h: Handle<{ accounts: User["portfolio"]["accounts"]; holdings: User["portfolio"]["holdings"] }>,
) {
  return () => (
    <section mix={panel}>
      <div mix={sectionHeader}>
        <div>
          <p mix={eyebrow}>Your accounts</p>
          <h2 mix={heading}>Where your plan lives</h2>
        </div>
        <span mix={css(muted)}>
          {h.props.accounts.length} account{h.props.accounts.length === 1 ? "" : "s"}
        </span>
      </div>
      {h.props.accounts.length === 0 ? (
        <EmptyState
          title="Start with an account"
          detail="Use the form below to add a container for cash and holdings."
        />
      ) : (
        <div mix={accountList}>
          {h.props.accounts.map((account) => (
            <article key={account.id} mix={accountCard}>
              <div>
                <strong>{account.name}</strong>
                <p mix={css(muted)}>
                  {accountLabel(account.type)} ·{" "}
                  {h.props.holdings.filter((holding) => holding.accountId === account.id).length}{" "}
                  holding
                  {h.props.holdings.filter((holding) => holding.accountId === account.id).length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
              <strong>
                {money(account.cash)}{" "}
                <span mix={css({ color: "#a5b9ad", fontSize: "12px", fontWeight: 400 })}>cash</span>
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AccountForm() {
  return () => (
    <section mix={panel}>
      <p mix={eyebrow}>Step 1</p>
      <h2 mix={heading}>Add an account</h2>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="intent" value="add-account" />
        <label>
          Name
          <input name="name" required placeholder="Long-term account" />
        </label>
        <label>
          Type
          <select name="type" defaultValue="taxable">
            <option value="401k">401(k)</option>
            <option value="traditional-ira">Traditional IRA</option>
            <option value="roth-ira">Roth IRA</option>
            <option value="taxable">Taxable brokerage</option>
            <option value="other-tax-advantaged">Other tax-advantaged</option>
            <option value="other-taxable">Other taxable</option>
          </select>
        </label>
        <label>
          Cash
          <input name="cash" type="number" min="0" step="0.01" defaultValue="0" />
        </label>
        <label mix={check}>
          <input name="allowTrades" type="checkbox" defaultChecked /> Trading is allowed
        </label>
        <label mix={check}>
          <input name="expectContributions" type="checkbox" /> Contributions expected
        </label>
        <label mix={check}>
          <input name="allowTaxableSales" type="checkbox" /> Taxable sales allowed
        </label>
        <button mix={button({})}>Add account</button>
      </form>
    </section>
  );
}

function HoldingForm(
  h: Handle<{ accounts: User["portfolio"]["accounts"]; exposures: User["portfolio"]["exposures"] }>,
) {
  return () => (
    <section mix={panel}>
      <p mix={eyebrow}>Step 2</p>
      <h2 mix={heading}>Add a holding</h2>
      {h.props.accounts.length === 0 ? (
        <p mix={css(muted)}>Add an account first.</p>
      ) : (
        <form method="POST" action="/app" mix={form}>
          <input type="hidden" name="intent" value="add-holding" />
          <label>
            Investment name
            <input name="name" required placeholder="Investment A" />
          </label>
          <label>
            Account
            <select name="accountId">
              {h.props.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exposure
            <select name="exposureId">
              {h.props.exposures.map((exposure) => (
                <option key={exposure.id} value={exposure.id}>
                  {exposure.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Current value
            <input name="value" type="number" min="0" step="0.01" defaultValue="0" />
          </label>
          <label mix={check}>
            <input name="canBuy" type="checkbox" defaultChecked /> Available for purchases
          </label>
          <label mix={check}>
            <input name="canSell" type="checkbox" defaultChecked /> Available for sales
          </label>
          <button mix={button({})}>Add holding</button>
        </form>
      )}
    </section>
  );
}

function TargetForm(h: Handle<{ exposures: User["portfolio"]["exposures"]; total: number }>) {
  return () => (
    <section mix={panel}>
      <p mix={eyebrow}>Step 3</p>
      <h2 mix={heading}>Set target exposures</h2>
      <p mix={css(muted)}>
        The total must equal 100%. Current total: <strong>{h.props.total.toFixed(1)}%</strong>
      </p>
      <form method="POST" action="/app" mix={form}>
        {h.props.exposures.map((exposure) => (
          <label key={exposure.id}>
            {exposure.name}
            <input
              name={`target-${exposure.id}`}
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={exposure.targetPercent}
            />
          </label>
        ))}
        <button mix={button({})}>Save targets</button>
      </form>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="intent" value="add-exposure" />
        <label>
          New exposure
          <input name="name" placeholder="Another exposure" />
        </label>
        <button mix={button({ secondary: true })}>Add exposure</button>
      </form>
    </section>
  );
}

function ContributionForm(h: Handle<{ accounts: User["portfolio"]["accounts"] }>) {
  return () => (
    <section mix={panel}>
      <p mix={eyebrow}>Step 4</p>
      <h2 mix={heading}>Plan a contribution</h2>
      <p mix={css(muted)}>Allocate new money without selling existing holdings.</p>
      {h.props.accounts.length === 0 ? (
        <p mix={css(muted)}>Add an account first.</p>
      ) : (
        <form method="POST" action="/app" mix={form}>
          <input type="hidden" name="intent" value="contribution" />
          <label>
            Contribution amount
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Destination account
            <select name="accountId">
              {h.props.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <button mix={button({})}>Plan contribution</button>
        </form>
      )}
    </section>
  );
}

function PlanResult(h: Handle<{ plan: RebalancePlan; accountName: Map<string, string> }>) {
  return () => (
    <section mix={panel}>
      <p mix={eyebrow}>Recommendation</p>
      <h2 mix={heading}>Practical next steps</h2>
      <p mix={css(muted)}>{h.props.plan.message}</p>
      {h.props.plan.trades.length ? (
        <ul mix={tradeList}>
          {h.props.plan.trades.map((trade, index) => (
            <li key={`${trade.accountId}-${trade.exposureId}-${index}`}>
              <strong>
                {trade.action === "buy" ? "Buy" : "Sell"} {trade.holdingName}
              </strong>
              <span>
                {money(trade.amount)} · {h.props.accountName.get(trade.accountId) ?? "Account"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p mix={css(muted)}>Remaining available cash: {money(h.props.plan.remainingCash)}</p>
    </section>
  );
}

const eyebrow = css({
  color: "#8bbd67",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontSize: "12px",
  margin: 0,
});
const heading = css({ margin: "8px 0 18px", fontSize: "24px" });
const panel = css({
  border: "1px solid #315244",
  borderRadius: "18px",
  padding: "24px",
  background: "#183127",
  marginTop: "20px",
});
const sectionHeader = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
});
const metricGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "12px",
  marginTop: "32px",
});
const progressGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
  marginTop: "28px",
  maxWidth: "700px",
  "@media (max-width: 620px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
});
const progressStep = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 12px",
  border: "1px solid #315244",
  borderRadius: "12px",
  background: "#183127",
  color: "#d4e1d8",
  fontSize: "13px",
  fontWeight: 650,
});
const progressNumber = css({
  display: "grid",
  placeItems: "center",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  background: "#b8e986",
  color: "#10251d",
  fontSize: "12px",
  fontWeight: 800,
});
const metric = css({
  border: "1px solid #315244",
  borderRadius: "14px",
  padding: "18px",
  background: "#183127",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});
const twoColumns = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "0 20px",
  alignItems: "start",
});
const emptyState = css({
  display: "grid",
  justifyItems: "start",
  gap: "4px",
  padding: "28px 18px",
  border: "1px dashed #527061",
  borderRadius: "12px",
  background: "#10251d",
  "& p": { margin: 0 },
});
const accountList = css({ display: "grid", gap: "10px" });
const accountCard = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px",
  border: "1px solid #315244",
  borderRadius: "12px",
  background: "#10251d",
  "& p": { margin: "4px 0 0" },
});
const form = css({ display: "flex", flexDirection: "column", gap: "12px" });
const check = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
});
const tableScroll = css({ overflowX: "auto" });
const table = css({
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "640px",
  "& th, & td": { textAlign: "left", padding: "13px 10px", borderBottom: "1px solid #315244" },
  "& th": {
    color: "#a5b9ad",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: ".06em",
  },
});
const tradeList = css({
  listStyle: "none",
  margin: "18px 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  "& li": {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px",
    borderRadius: "10px",
    background: "#10251d",
  },
  "& span": { color: "#a5b9ad" },
});
const warning = css({
  color: "#ffcf79",
  background: "#3b301c",
  borderRadius: "10px",
  padding: "10px 12px",
});
function statusStyle(status: string) {
  return css({
    color: status === "overweight" ? "#ffb4a8" : status === "underweight" ? "#ffcf79" : "#b8e986",
    textTransform: "capitalize",
  });
}
