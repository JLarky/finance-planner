import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import type { User } from "../data/users.ts";
import {
  accountLabel,
  isTaxableAccount,
  money,
  portfolioTsv,
  portfolioTotal,
  summarizePortfolio,
  targetTotal,
  type PortfolioImportChange,
  type PortfolioImportPreview,
  type Account,
  type AvailableInvestment,
  type Exposure,
  type Holding,
  type RebalancePlan,
  type Trade,
} from "../data/portfolio.ts";
import { Document } from "./document.tsx";
import { button, muted, shell } from "./styles.ts";
import { TsvExport } from "./tsv-export.tsx";

type Portfolio = User["portfolio"];
export type ImportResult = {
  error?: string;
  notice?: string;
  source?: string;
  preview?: PortfolioImportPreview;
  changes?: PortfolioImportChange[];
};

export function DashboardPage(
  h: Handle<{ user: User; plan?: RebalancePlan; importResult?: ImportResult }>,
) {
  const portfolio = h.props.user.portfolio;
  const summaries = summarizePortfolio(portfolio);
  const total = portfolioTotal(portfolio);
  const cash = portfolio.accounts.reduce((sum, account) => sum + account.cash, 0);
  const validTargets = Math.abs(targetTotal(portfolio) - 100) < 0.001;
  const hasAccounts = portfolio.accounts.length > 0;
  const hasHoldings = portfolio.holdings.length > 0;
  const canPlan =
    validTargets && hasAccounts && (hasHoldings || portfolio.availableInvestments.length > 0);
  const accountName = new Map(portfolio.accounts.map((account) => [account.id, account.name]));
  return () => (
    <Document title="Your plan · Finance Planner">
      <main mix={shell}>
        <header
          mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}
        >
          <strong>Finance Planner</strong>
          <div mix={css({ display: "flex", gap: "10px", alignItems: "center" })}>
            <a href="/account" mix={button({ secondary: true })}>
              Account
            </a>
            <form method="POST" action="/logout">
              <button mix={button({ secondary: true })}>Sign out</button>
            </form>
          </div>
        </header>

        <section mix={css({ padding: "56px 0" })}>
          <p mix={eyebrow}>Portfolio workspace</p>
          <h1 mix={css({ fontSize: "clamp(38px, 6vw, 60px)", margin: "14px 0" })}>
            Rebalance the whole portfolio.
          </h1>
          <p mix={css({ ...muted, maxWidth: "760px" })}>
            Treat every account as one portfolio while keeping every purchase and sale inside the
            account where the money lives.
          </p>

          <div mix={progressGrid}>
            <ProgressStep number="1" label="Accounts" complete={hasAccounts} />
            <ProgressStep number="2" label="Holdings" complete={hasHoldings} />
            <ProgressStep
              number="3"
              label="Available"
              complete={portfolio.availableInvestments.length > 0}
            />
            <ProgressStep number="4" label="Target" complete={validTargets} />
            <ProgressStep number="5" label="Compare" complete={total > 0 && validTargets} />
            <ProgressStep number="6" label="Plan" complete={Boolean(h.props.plan)} />
          </div>

          <div mix={metricGrid}>
            <Metric label="Total portfolio" value={money(total)} />
            <Metric label="Invested" value={money(total - cash)} />
            <Metric label="Uninvested cash" value={money(cash)} />
            <Metric label="Accounts" value={String(portfolio.accounts.length)} />
            <Metric
              label="Target allocation total"
              value={`${targetTotal(portfolio).toFixed(1)}%`}
              tone={validTargets ? "normal" : "warning"}
            />
          </div>

          <AccountsSection accounts={portfolio.accounts} holdings={portfolio.holdings} />
          <HoldingsSection
            accounts={portfolio.accounts}
            holdings={portfolio.holdings}
            exposures={portfolio.exposures}
          />
          <AvailableInvestmentsSection
            accounts={portfolio.accounts}
            availableInvestments={portfolio.availableInvestments}
            exposures={portfolio.exposures}
          />
          <TargetSection
            exposures={portfolio.exposures}
            holdings={portfolio.holdings}
            availableInvestments={portfolio.availableInvestments}
            total={targetTotal(portfolio)}
            targetName={portfolio.targetName}
          />
          <ComparisonSection
            portfolio={portfolio}
            total={total}
            summaries={summaries}
            validTargets={validTargets}
            canPlan={canPlan}
          />
          <TsvExport
            content={portfolioTsv(portfolio)}
            jsonContent={JSON.stringify(portfolio, null, 2)}
          />
          <ImportSection result={h.props.importResult} />
          {h.props.plan?.kind === "rebalance" ? (
            <PlanResult plan={h.props.plan} accountName={accountName} />
          ) : null}
          <ContributionSection accounts={portfolio.accounts} canPlan={canPlan} total={total} />
          {h.props.plan?.kind === "contribution" ? (
            <PlanResult plan={h.props.plan} accountName={accountName} />
          ) : null}
        </section>
      </main>
    </Document>
  );
}

function ImportSection(h: Handle<{ result?: ImportResult }>) {
  const result = h.props.result;
  return () => (
    <section mix={panel} data-import-section>
      <SectionHeading
        step="Bring it back"
        title="Import portfolio data"
        detail="Paste a tab-separated export from this app or a JSON portfolio backup. Nothing changes until you confirm the preview."
      />
      {result?.error ? (
        <p mix={warning} role="alert">
          {result.error}
        </p>
      ) : null}
      {result?.notice ? (
        <p mix={success} role="status">
          {result.notice}
        </p>
      ) : null}
      {result?.preview ? (
        <div mix={innerCard} data-import-preview>
          <strong>Ready to replace your current portfolio</strong>
          <p mix={css(muted)}>
            {result.preview.format.toUpperCase()} import: {result.preview.accounts} accounts,{" "}
            {result.preview.holdings} holdings, {result.preview.availableInvestments} available
            investments, and {result.preview.exposures} exposures.
          </p>
          {result.preview.warnings.length ? (
            <ul>
              {result.preview.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p mix={css(muted)}>No validation warnings.</p>
          )}
          <strong>Changes to saved portfolio</strong>
          {result.changes?.length ? (
            <ul data-import-changes>
              {result.changes.map((change) => (
                <li key={`${change.kind}-${change.area}-${change.label}`}>
                  <strong>
                    {change.kind.toUpperCase()} {change.area}: {change.label}
                  </strong>{" "}
                  — {change.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p mix={css(muted)}>No changes detected.</p>
          )}
          <form method="POST" action="/app">
            <input type="hidden" name="intent" value="confirm-import" />
            <textarea name="importData" hidden defaultValue={result.source} />
            <button type="submit" mix={button({})}>
              Replace current portfolio
            </button>
          </form>
        </div>
      ) : null}
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="intent" value="preview-import" />
        <label>
          JSON or tab-separated data
          <textarea
            name="importData"
            required
            rows={12}
            defaultValue={result?.source}
            placeholder="Paste the contents of a Finance Planner .tsv or JSON backup"
            mix={css({
              width: "100%",
              boxSizing: "border-box",
              minHeight: "220px",
              border: "1px solid #527061",
              borderRadius: "10px",
              padding: "12px",
              background: "#10251d",
              color: "#f1f6ed",
              font: "13px ui-monospace, SFMono-Regular, Menlo, monospace",
            })}
          />
        </label>
        <button mix={button({ secondary: true })}>Preview import</button>
      </form>
    </section>
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

function AccountsSection(h: Handle<{ accounts: Account[]; holdings: Holding[] }>) {
  return () => (
    <section mix={panel}>
      <SectionHeading
        step="Step 1"
        title="Accounts and cash"
        detail="Cash and trades stay inside each account. Individual accounts do not need to match the combined target."
      />
      <div mix={sectionColumns}>
        <div>
          {h.props.accounts.length === 0 ? (
            <EmptyState
              title="Start with an account"
              detail="Add account-level cash even when the account has no holdings yet."
            />
          ) : (
            <div mix={cardList}>
              {h.props.accounts.map((account) => (
                <AccountEditor
                  key={account.id}
                  account={account}
                  holdingCount={
                    h.props.holdings.filter((holding) => holding.accountId === account.id).length
                  }
                  invested={h.props.holdings
                    .filter((holding) => holding.accountId === account.id)
                    .reduce((sum, holding) => sum + holding.value, 0)}
                />
              ))}
            </div>
          )}
        </div>
        <AddAccountForm />
      </div>
    </section>
  );
}

function AccountEditor(h: Handle<{ account: Account; holdingCount: number; invested: number }>) {
  const account = h.props.account;
  return () => (
    <details mix={editorCard}>
      <summary mix={summaryRow}>
        <span>
          <strong>{account.name}</strong>
          <small>
            {accountLabel(account.type)} · {h.props.holdingCount} holding
            {h.props.holdingCount === 1 ? "" : "s"}
          </small>
        </span>
        <span mix={summaryValue}>{money(h.props.invested + account.cash)}</span>
      </summary>
      <form method="POST" action="/app" mix={form} data-account-form>
        <input type="hidden" name="accountId" value={account.id} />
        <div mix={formGrid}>
          <label>
            Account name
            <input name="name" required defaultValue={account.name} />
          </label>
          <label>
            Account type
            <AccountTypeSelect value={account.type} />
          </label>
          <label>
            Uninvested cash
            <input name="cash" type="number" min="0" step="0.01" defaultValue={account.cash} />
          </label>
        </div>
        <div mix={checkGrid}>
          <Check name="allowPurchases" label="Allow purchases" checked={account.allowPurchases} />
          <Check name="allowSales" label="Allow sales" checked={account.allowSales} />
          <Check
            name="expectContributions"
            label="Contributions expected"
            checked={account.expectContributions}
          />
          <label mix={check} data-taxable-sales hidden={!isTaxableAccount(account)}>
            <input
              name="allowTaxableSales"
              type="checkbox"
              defaultChecked={account.allowTaxableSales}
            />{" "}
            Taxable sales allowed
          </label>
        </div>
        <div mix={buttonRow}>
          <button type="submit" name="intent" value="update-account" mix={button({})}>
            Save account
          </button>
          <button
            type="submit"
            name="intent"
            value="remove-account"
            mix={dangerButton}
            disabled={h.props.holdingCount > 0}
            title={h.props.holdingCount > 0 ? "Remove holdings first" : "Remove account"}
          >
            Remove
          </button>
        </div>
      </form>
    </details>
  );
}

function AddAccountForm() {
  return () => (
    <div mix={innerCard}>
      <h3 mix={subheading}>Add account</h3>
      <form method="POST" action="/app" mix={form} data-account-form>
        <input type="hidden" name="intent" value="add-account" />
        <label>
          Account name
          <input name="name" required placeholder="Fidelity 401(k)" />
        </label>
        <label>
          Account type
          <AccountTypeSelect value="401k" />
        </label>
        <label>
          Uninvested cash
          <input name="cash" type="number" min="0" step="0.01" defaultValue="0" />
        </label>
        <div mix={checkGrid}>
          <Check name="allowPurchases" label="Allow purchases" checked />
          <Check name="allowSales" label="Allow sales" checked />
          <Check name="expectContributions" label="Contributions expected" />
          <label mix={check} data-taxable-sales hidden>
            <input name="allowTaxableSales" type="checkbox" /> Taxable sales allowed
          </label>
        </div>
        <button mix={button({})}>Add account</button>
      </form>
    </div>
  );
}

function AccountTypeSelect(h: Handle<{ value: Account["type"] }>) {
  return () => (
    <select name="type" data-account-type>
      <option value="401k" selected={h.props.value === "401k"}>
        401(k)
      </option>
      <option value="traditional-ira" selected={h.props.value === "traditional-ira"}>
        Traditional IRA
      </option>
      <option value="roth-ira" selected={h.props.value === "roth-ira"}>
        Roth IRA
      </option>
      <option value="taxable" selected={h.props.value === "taxable"}>
        Taxable brokerage
      </option>
      <option value="other-tax-advantaged" selected={h.props.value === "other-tax-advantaged"}>
        Other tax-advantaged
      </option>
      <option value="other-taxable" selected={h.props.value === "other-taxable"}>
        Other taxable
      </option>
    </select>
  );
}

function HoldingsSection(
  h: Handle<{ accounts: Account[]; holdings: Holding[]; exposures: Exposure[] }>,
) {
  return () => (
    <section mix={panel}>
      <SectionHeading
        step="Step 2"
        title="Holdings and exposure mapping"
        detail="Each fund maps to one primary exposure. Multiple funds may map to the same exposure."
      />
      {h.props.accounts.length === 0 ? (
        <EmptyState title="Add an account first" detail="A holding must belong to an account." />
      ) : (
        <div mix={sectionColumns}>
          <div>
            {h.props.holdings.length === 0 ? (
              <EmptyState
                title="No holdings yet"
                detail="Add current market values and make each fund-to-exposure mapping explicit."
              />
            ) : (
              <div mix={cardList}>
                {h.props.holdings.map((holding) => (
                  <HoldingEditor
                    key={holding.id}
                    holding={holding}
                    accounts={h.props.accounts}
                    exposures={h.props.exposures}
                  />
                ))}
              </div>
            )}
          </div>
          <AddHoldingForm accounts={h.props.accounts} exposures={h.props.exposures} />
        </div>
      )}
    </section>
  );
}

function HoldingEditor(
  h: Handle<{ holding: Holding; accounts: Account[]; exposures: Exposure[] }>,
) {
  const holding = h.props.holding;
  const account = h.props.accounts.find((item) => item.id === holding.accountId);
  const exposure = h.props.exposures.find((item) => item.id === holding.exposureId);
  return () => (
    <details mix={editorCard}>
      <summary mix={summaryRow}>
        <span>
          <strong>{holding.name}</strong>
          <small>
            {account?.name ?? "Unknown account"} · {exposure?.name ?? "Unmapped"}
          </small>
        </span>
        <span mix={summaryValue}>{money(holding.value)}</span>
      </summary>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="holdingId" value={holding.id} />
        <HoldingFields
          holding={holding}
          accounts={h.props.accounts}
          exposures={h.props.exposures}
        />
        <div mix={buttonRow}>
          <button type="submit" name="intent" value="update-holding" mix={button({})}>
            Save holding
          </button>
          <button type="submit" name="intent" value="remove-holding" mix={dangerButton}>
            Remove
          </button>
        </div>
      </form>
    </details>
  );
}

function AddHoldingForm(h: Handle<{ accounts: Account[]; exposures: Exposure[] }>) {
  return () => (
    <div mix={innerCard}>
      <h3 mix={subheading}>Add holding</h3>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="intent" value="add-holding" />
        <HoldingFields accounts={h.props.accounts} exposures={h.props.exposures} />
        <button mix={button({})}>Add holding</button>
      </form>
    </div>
  );
}

function HoldingFields(
  h: Handle<{ holding?: Holding; accounts: Account[]; exposures: Exposure[] }>,
) {
  return () => (
    <>
      <div mix={formGrid}>
        <label>
          Fund ticker or name
          <input name="name" required placeholder="FXAIX" defaultValue={h.props.holding?.name} />
        </label>
        <label>
          Account
          <select name="accountId">
            {h.props.accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
                selected={h.props.holding?.accountId === account.id}
              >
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exposure
          <select name="exposureId">
            {h.props.exposures.map((exposure) => (
              <option
                key={exposure.id}
                value={exposure.id}
                selected={h.props.holding?.exposureId === exposure.id}
              >
                {exposure.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Current market value
          <input
            name="value"
            type="number"
            min="0"
            step="0.01"
            defaultValue={h.props.holding?.value ?? 0}
          />
        </label>
      </div>
      <div mix={checkGrid}>
        <Check name="canBuy" label="Allow purchases" checked={h.props.holding?.canBuy ?? true} />
        <Check name="canSell" label="Allow sales" checked={h.props.holding?.canSell ?? true} />
      </div>
    </>
  );
}

function AvailableInvestmentsSection(
  h: Handle<{
    accounts: Account[];
    availableInvestments: AvailableInvestment[];
    exposures: Exposure[];
  }>,
) {
  return () => (
    <section mix={panel}>
      <SectionHeading
        step="Step 3"
        title="Available investments"
        detail="Tell the planner which funds can implement each exposure in each account. Preferred funds are selected first, including funds you do not currently own."
      />
      {h.props.accounts.length === 0 ? (
        <EmptyState
          title="Add an account first"
          detail="An available investment must belong to an account."
        />
      ) : (
        <div mix={sectionColumns}>
          <div>
            {h.props.availableInvestments.length === 0 ? (
              <EmptyState
                title="No available investments yet"
                detail="Add purchasable funds here when an account can buy a fund that is not currently held."
              />
            ) : (
              <div mix={cardList}>
                {h.props.availableInvestments.map((investment) => (
                  <AvailableInvestmentEditor
                    key={investment.id}
                    investment={investment}
                    accounts={h.props.accounts}
                    exposures={h.props.exposures}
                  />
                ))}
              </div>
            )}
          </div>
          <AddAvailableInvestmentForm accounts={h.props.accounts} exposures={h.props.exposures} />
        </div>
      )}
    </section>
  );
}

function AvailableInvestmentEditor(
  h: Handle<{
    investment: AvailableInvestment;
    accounts: Account[];
    exposures: Exposure[];
  }>,
) {
  const investment = h.props.investment;
  const account = h.props.accounts.find((item) => item.id === investment.accountId);
  const exposure = h.props.exposures.find((item) => item.id === investment.exposureId);
  return () => (
    <details mix={editorCard}>
      <summary mix={summaryRow}>
        <span>
          <strong>{investment.name}</strong>
          <small>
            {account?.name ?? "Unknown account"} · {exposure?.name ?? "Unmapped"}
            {investment.preferred ? " · Preferred" : ""}
          </small>
        </span>
      </summary>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="availableInvestmentId" value={investment.id} />
        <AvailableInvestmentFields
          investment={investment}
          accounts={h.props.accounts}
          exposures={h.props.exposures}
        />
        <div mix={buttonRow}>
          <button type="submit" name="intent" value="update-available-investment" mix={button({})}>
            Save investment
          </button>
          <button
            type="submit"
            name="intent"
            value="remove-available-investment"
            mix={dangerButton}
          >
            Remove
          </button>
        </div>
      </form>
    </details>
  );
}

function AddAvailableInvestmentForm(h: Handle<{ accounts: Account[]; exposures: Exposure[] }>) {
  return () => (
    <div mix={innerCard}>
      <h3 mix={subheading}>Add available investment</h3>
      <form method="POST" action="/app" mix={form}>
        <input type="hidden" name="intent" value="add-available-investment" />
        <AvailableInvestmentFields accounts={h.props.accounts} exposures={h.props.exposures} />
        <button mix={button({})}>Add investment</button>
      </form>
    </div>
  );
}

function AvailableInvestmentFields(
  h: Handle<{
    investment?: AvailableInvestment;
    accounts: Account[];
    exposures: Exposure[];
  }>,
) {
  return () => (
    <>
      <div mix={formGrid}>
        <label>
          Fund ticker or name
          <input
            name="name"
            required
            placeholder="Fund name or ticker"
            defaultValue={h.props.investment?.name}
          />
        </label>
        <label>
          Account
          <select name="accountId">
            {h.props.accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
                selected={h.props.investment?.accountId === account.id}
              >
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exposure
          <select name="exposureId">
            {h.props.exposures.map((exposure) => (
              <option
                key={exposure.id}
                value={exposure.id}
                selected={h.props.investment?.exposureId === exposure.id}
              >
                {exposure.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div mix={checkGrid}>
        <Check
          name="preferred"
          label="Preferred"
          checked={h.props.investment?.preferred ?? false}
        />
        <Check name="canBuy" label="Allow purchases" checked={h.props.investment?.canBuy ?? true} />
        <Check name="canSell" label="Allow sales" checked={h.props.investment?.canSell ?? true} />
      </div>
    </>
  );
}

function TargetSection(
  h: Handle<{
    exposures: Exposure[];
    holdings: Holding[];
    availableInvestments: AvailableInvestment[];
    total: number;
    targetName: string;
  }>,
) {
  const summary = targetMixSummary(h.props.exposures);
  return () => (
    <section mix={panel}>
      <SectionHeading
        step="Step 4"
        title="Define target portfolio"
        detail="Rename, reorder, remove, or add exposures. Target percentages must total 100%."
      />
      <div mix={targetTotalRow}>
        <span>Target allocation total</span>
        <strong mix={css({ color: Math.abs(h.props.total - 100) < 0.001 ? "#b8e986" : "#ffcf79" })}>
          {h.props.total.toFixed(1)}%
        </strong>
      </div>
      <form method="POST" action="/app" mix={form}>
        <label>
          Target name
          <input name="targetName" defaultValue={h.props.targetName} required />
        </label>
        <div mix={targetList}>
          {h.props.exposures.map((exposure, index) => {
            const inUse =
              h.props.holdings.some((holding) => holding.exposureId === exposure.id) ||
              h.props.availableInvestments?.some(
                (investment) => investment.exposureId === exposure.id,
              );
            return (
              <div key={exposure.id} mix={targetRow}>
                <label>
                  Exposure
                  <input name={`name-${exposure.id}`} defaultValue={exposure.name} required />
                </label>
                <label>
                  Target percentage
                  <input
                    name={`target-${exposure.id}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={exposure.targetPercent}
                  />
                </label>
                <div mix={smallButtonRow}>
                  <button
                    type="submit"
                    name="intent"
                    value={`move-exposure-up:${exposure.id}`}
                    mix={iconButton}
                    disabled={index === 0}
                    aria-label={`Move ${exposure.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value={`move-exposure-down:${exposure.id}`}
                    mix={iconButton}
                    disabled={index === h.props.exposures.length - 1}
                    aria-label={`Move ${exposure.name} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="submit"
                    name="intent"
                    value={`remove-exposure:${exposure.id}`}
                    mix={iconButton}
                    disabled={inUse || h.props.exposures.length === 1}
                    title={inUse ? "Reassign holdings before removing this exposure" : "Remove"}
                    aria-label={`Remove ${exposure.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button type="submit" name="intent" value="save-targets" mix={button({})}>
          Save target portfolio
        </button>
      </form>
      {summary ? (
        <div mix={mixSummary}>
          <strong>
            {summary.us.toFixed(0)}/{summary.international.toFixed(0)} {h.props.targetName}
          </strong>
          <span>Total US: {summary.us.toFixed(1)}%</span>
          <span>Total international: {summary.international.toFixed(1)}%</span>
          <span>Explicit small-cap value: {summary.smallValue.toFixed(1)}%</span>
        </div>
      ) : null}
      <form method="POST" action="/app" mix={inlineForm}>
        <input type="hidden" name="intent" value="add-exposure" />
        <label>
          Exposure name
          <input name="name" placeholder="Add custom exposure" required />
        </label>
        <button mix={button({ secondary: true })}>Add exposure</button>
      </form>
    </section>
  );
}

function ComparisonSection(
  h: Handle<{
    portfolio: Portfolio;
    total: number;
    summaries: ReturnType<typeof summarizePortfolio>;
    validTargets: boolean;
    canPlan: boolean;
  }>,
) {
  return () => (
    <section mix={panel}>
      <div mix={sectionHeader}>
        <SectionHeading
          step="Step 5"
          title="Portfolio comparison"
          detail="Combined portfolio is primary. Cash stays in the denominator until invested."
        />
        <form method="POST" action="/app">
          <input type="hidden" name="intent" value="rebalance" />
          <button mix={button({})} disabled={!h.props.canPlan || h.props.total === 0}>
            Rebalance now
          </button>
        </form>
      </div>
      <p mix={priorityNote}>
        Cash first · tax-advantaged trades next · taxable sales avoided by default · trades rounded
        to $10 and omitted below {money(h.props.portfolio.minimumTrade)}
      </p>
      {!h.props.validTargets ? (
        <p mix={warning}>Target allocation total must equal 100% before generating a plan.</p>
      ) : null}
      {h.props.total === 0 ? (
        <>
          <EmptyState
            title="Saved target allocation"
            detail="Add an account and at least one holding or cash balance to calculate your current allocation."
          />
          <TargetPreview exposures={h.props.portfolio.exposures} />
        </>
      ) : (
        <div mix={tableScroll}>
          <table mix={[table, wideTable]}>
            <thead>
              <tr>
                <th>Exposure</th>
                <th>Current percentage</th>
                <th>Target percentage</th>
                <th>Current value</th>
                <th>Target value</th>
                <th>Dollar drift</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {h.props.summaries.map((summary) => (
                <tr key={summary.id}>
                  <td>{summary.name}</td>
                  <td>{summary.currentPercent.toFixed(1)}%</td>
                  <td>{summary.targetPercent.toFixed(1)}%</td>
                  <td>{money(summary.currentValue)}</td>
                  <td>{money(summary.targetValue)}</td>
                  <td>{signedMoney(summary.dollarDrift)}</td>
                  <td>
                    <span mix={statusStyle(summary.status)}>{statusLabel(summary.status)}</span>
                    {Math.abs(summary.percentagePointDrift) >= 0.1 ? (
                      <small mix={statusDetail}>
                        {driftDescription(summary.percentagePointDrift)}
                      </small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TargetPreview(h: Handle<{ exposures: Exposure[] }>) {
  return () => (
    <div mix={targetPreview}>
      {h.props.exposures.map((exposure) => (
        <div key={exposure.id}>
          <span>{exposure.name}</span>
          <strong>{exposure.targetPercent.toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}

function ContributionSection(h: Handle<{ accounts: Account[]; canPlan: boolean; total: number }>) {
  return () => (
    <section mix={panel}>
      <SectionHeading
        step="Step 6"
        title="Plan contributions"
        detail="Allocate new money in one destination account without selling existing holdings."
      />
      {h.props.accounts.length === 0 ? (
        <EmptyState
          title="Add an account first"
          detail="A contribution needs a destination account and purchasable investments."
        />
      ) : (
        <form method="POST" action="/app" mix={form}>
          <input type="hidden" name="intent" value="contribution" />
          <div mix={formGrid}>
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
            <label>
              Contribution timing
              <select name="frequency" value="one-time">
                <option value="one-time">One-time</option>
                <option value="recurring">Recurring</option>
              </select>
            </label>
          </div>
          <p mix={css(muted)}>
            Future targets use current total of {money(h.props.total)} plus this contribution.
            Purchases are limited to funds enabled in the selected account.
          </p>
          <button mix={button({})} disabled={!h.props.canPlan}>
            Plan contributions
          </button>
        </form>
      )}
    </section>
  );
}

function PlanResult(h: Handle<{ plan: RebalancePlan; accountName: Map<string, string> }>) {
  const accountIds = [...new Set(h.props.plan.trades.map((trade) => trade.accountId))];
  return () => (
    <section mix={[panel, recommendationPanel]}>
      <p mix={eyebrow}>Recommendation</p>
      <h2 mix={heading}>
        {h.props.plan.kind === "rebalance"
          ? "Account-aware transaction plan"
          : "Contribution allocation"}
      </h2>
      <p>{h.props.plan.message}</p>
      {h.props.plan.kind === "contribution" ? (
        <p mix={callout}>
          This is the allocation of this contribution, not your target portfolio allocation. It is
          designed to move the combined portfolio closer to target.
        </p>
      ) : null}

      {accountIds.length ? (
        <div mix={accountPlanList}>
          {accountIds.map((accountId) => (
            <div key={accountId} mix={innerCard}>
              <h3 mix={subheading}>{h.props.accountName.get(accountId) ?? "Account"}</h3>
              <div mix={tableScroll}>
                <table mix={table}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Fund</th>
                      <th>Dollar amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.props.plan.trades
                      .filter((trade) => trade.accountId === accountId)
                      .map((trade, index) => (
                        <tr key={`${trade.holdingId}-${trade.action}-${index}`}>
                          <td>{tradeAction(trade)}</td>
                          <td>{trade.holdingName}</td>
                          <td>{money(trade.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No transactions recommended" detail={h.props.plan.message} />
      )}

      <h3 mix={resultHeading}>Projected combined portfolio</h3>
      <div mix={tableScroll}>
        <table mix={[table, wideTable]}>
          <thead>
            <tr>
              <th>Exposure</th>
              <th>Before percentage</th>
              <th>Projected percentage</th>
              <th>Target percentage</th>
              <th>Remaining dollar drift</th>
            </tr>
          </thead>
          <tbody>
            {h.props.plan.projections.map((projection) => (
              <tr key={projection.exposureId}>
                <td>{projection.name}</td>
                <td>{projection.beforePercent.toFixed(1)}%</td>
                <td>{projection.projectedPercent.toFixed(1)}%</td>
                <td>{projection.targetPercent.toFixed(1)}%</td>
                <td>{signedMoney(projection.remainingDollarDrift)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p mix={h.props.plan.withinTolerance ? success : css(muted)}>
        {h.props.plan.withinTolerance
          ? "Remaining differences are within the selected tolerance."
          : "Some allocation drift remains after the closest feasible plan."}
      </p>
      <p mix={css(muted)}>
        {h.props.plan.kind === "rebalance"
          ? `Projected uninvested cash: ${money(h.props.plan.remainingCash)}`
          : `Projected cash in destination account: ${money(h.props.plan.remainingCash)}`}
      </p>

      {h.props.plan.restrictions.length ? (
        <div mix={restrictionGrid}>
          <div mix={restrictionCard}>
            <strong>What prevents a full rebalance</strong>
            <ul>
              {h.props.plan.restrictions.map((restriction) => (
                <li key={restriction}>{restriction}</li>
              ))}
            </ul>
          </div>
          <div mix={actionCard}>
            <strong>Possible corrective actions</strong>
            <ul>
              {h.props.plan.correctiveActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectionHeading(h: Handle<{ step: string; title: string; detail: string }>) {
  return () => (
    <div>
      <p mix={eyebrow}>{h.props.step}</p>
      <h2 mix={heading}>{h.props.title}</h2>
      <p mix={sectionDetail}>{h.props.detail}</p>
    </div>
  );
}

function Check(h: Handle<{ name: string; label: string; checked?: boolean }>) {
  return () => (
    <label mix={check}>
      <input name={h.props.name} type="checkbox" defaultChecked={h.props.checked} /> {h.props.label}
    </label>
  );
}

function tradeAction(trade: Trade): string {
  if (trade.action === "sell") return "Sell";
  if (trade.funding === "cash") return "Use cash to buy";
  if (trade.funding === "contribution") return "Buy with contribution";
  return "Buy";
}

function statusLabel(status: string): string {
  return status.replace("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function targetMixSummary(exposures: Exposure[]) {
  const byId = new Map(exposures.map((exposure) => [exposure.id, exposure.targetPercent]));
  const required = [
    "broad-us",
    "us-small-value",
    "developed-international",
    "developed-international-small-value",
    "emerging-markets",
  ];
  if (!required.every((id) => byId.has(id))) return null;
  const us = (byId.get("broad-us") ?? 0) + (byId.get("us-small-value") ?? 0);
  const international =
    (byId.get("developed-international") ?? 0) +
    (byId.get("developed-international-small-value") ?? 0) +
    (byId.get("emerging-markets") ?? 0);
  return {
    us,
    international,
    smallValue:
      (byId.get("us-small-value") ?? 0) + (byId.get("developed-international-small-value") ?? 0),
  };
}

function driftDescription(value: number): string {
  return `${Math.abs(value).toFixed(1)} percentage points ${value > 0 ? "overweight" : "underweight"}`;
}

function signedMoney(value: number): string {
  if (Math.abs(value) < 0.005) return money(0);
  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

const eyebrow = css({
  color: "#8bbd67",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontSize: "12px",
  margin: 0,
});
const heading = css({ margin: "8px 0 4px", fontSize: "24px" });
const subheading = css({ margin: "0 0 16px", fontSize: "17px" });
const sectionDetail = css({ ...muted, margin: "0 0 20px", maxWidth: "760px" });
const panel = css({
  border: "1px solid #315244",
  borderRadius: "18px",
  padding: "24px",
  background: "#183127",
  marginTop: "20px",
});
const recommendationPanel = css({
  borderColor: "#8bbd67",
  background: "linear-gradient(145deg, #1d3b2e, #183127)",
});
const sectionHeader = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
});
const sectionColumns = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)",
  gap: "18px",
  alignItems: "start",
  "@media (max-width: 820px)": { gridTemplateColumns: "1fr" },
});
const metricGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginTop: "32px",
});
const progressGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "8px",
  marginTop: "28px",
  maxWidth: "820px",
  "@media (max-width: 720px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
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
  flex: "0 0 22px",
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
const innerCard = css({
  padding: "18px",
  border: "1px solid #315244",
  borderRadius: "12px",
  background: "#10251d",
});
const cardList = css({ display: "grid", gap: "10px" });
const editorCard = css({
  border: "1px solid #315244",
  borderRadius: "12px",
  padding: "0 16px",
  background: "#10251d",
  "&[open]": { paddingBottom: "18px" },
  "& summary": { cursor: "pointer" },
});
const summaryRow = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 0",
  "& > span:first-child": { display: "grid", gap: "3px" },
  "& small": { color: "#a5b9ad" },
});
const summaryValue = css({ fontWeight: 700, whiteSpace: "nowrap" });
const form = css({ display: "flex", flexDirection: "column", gap: "14px" });
const formGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  "@media (max-width: 600px)": { gridTemplateColumns: "1fr" },
  "& > label": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#d4e1d8",
    fontSize: "14px",
  },
});
const checkGrid = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 18px",
});
const check = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#d4e1d8",
  "&[hidden]": { display: "none" },
});
const buttonRow = css({ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" });
const dangerButton = css({
  appearance: "none",
  border: "1px solid #80564e",
  borderRadius: "999px",
  padding: "10px 16px",
  marginTop: "8px",
  background: "transparent",
  color: "#ffb4a8",
  font: "inherit",
  cursor: "pointer",
});
const targetTotalRow = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  margin: "16px 0",
  padding: "12px 14px",
  borderRadius: "10px",
  background: "#10251d",
});
const targetList = css({ display: "grid", gap: "10px" });
const targetRow = css({
  display: "grid",
  gridTemplateColumns: "minmax(200px, 1fr) minmax(130px, .35fr) auto",
  gap: "10px",
  alignItems: "end",
  padding: "12px",
  borderRadius: "10px",
  background: "#10251d",
  "& > label": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#d4e1d8",
    fontSize: "13px",
  },
  "@media (max-width: 680px)": { gridTemplateColumns: "1fr" },
});
const smallButtonRow = css({ display: "flex", gap: "6px" });
const iconButton = css({
  width: "38px",
  height: "38px",
  border: "1px solid #527061",
  borderRadius: "9px",
  background: "transparent",
  color: "#f1f6ed",
  cursor: "pointer",
});
const inlineForm = css({
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: "12px",
  alignItems: "end",
  marginTop: "18px",
  "& > label": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#d4e1d8",
    fontSize: "14px",
  },
  "@media (max-width: 580px)": { gridTemplateColumns: "1fr" },
});
const mixSummary = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 18px",
  marginTop: "18px",
  padding: "14px",
  borderRadius: "10px",
  background: "#10251d",
  "& strong": { flexBasis: "100%", color: "#b8e986" },
  "& span": { color: "#d4e1d8", fontSize: "14px" },
});
const tableScroll = css({ overflowX: "auto" });
const table = css({
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "560px",
  "& th, & td": {
    textAlign: "left",
    padding: "13px 10px",
    borderBottom: "1px solid #315244",
    verticalAlign: "top",
  },
  "& th": {
    color: "#a5b9ad",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: ".06em",
  },
});
const wideTable = css({ minWidth: "920px" });
const statusDetail = css({
  display: "block",
  color: "#a5b9ad",
  marginTop: "3px",
  maxWidth: "170px",
});
const priorityNote = css({
  color: "#c9d9ce",
  fontSize: "13px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "#10251d",
});
const targetPreview = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "8px",
  marginTop: "12px",
  "& > div": {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px",
    borderRadius: "10px",
    background: "#10251d",
  },
});
const callout = css({
  padding: "12px 14px",
  borderLeft: "3px solid #b8e986",
  borderRadius: "0 10px 10px 0",
  background: "#10251d",
});
const accountPlanList = css({ display: "grid", gap: "12px", margin: "18px 0" });
const resultHeading = css({ margin: "28px 0 8px", fontSize: "18px" });
const success = css({
  color: "#b8e986",
  background: "#143424",
  borderRadius: "10px",
  padding: "10px 12px",
});
const restrictionGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  marginTop: "18px",
  "@media (max-width: 700px)": { gridTemplateColumns: "1fr" },
  "& ul": { margin: "10px 0 0", paddingLeft: "20px" },
});
const restrictionCard = css({
  padding: "16px",
  borderRadius: "12px",
  background: "#3b301c",
  color: "#ffdfa4",
});
const actionCard = css({
  padding: "16px",
  borderRadius: "12px",
  background: "#143424",
  color: "#d5efc0",
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
