import type { Handle } from "remix/ui";
import { css } from "remix/ui";
import {
  DEFAULT_DISTRIBUTION,
  distributionExposures,
  distributionQuery,
  type DistributionSelection,
} from "../data/portfolio.ts";
import { Document } from "./document.tsx";
import { shell, button, muted } from "./styles.ts";
export function HomePage(h: Handle<{ signedIn: boolean }>) {
  const selection = DEFAULT_DISTRIBUTION;
  const exposures = distributionExposures(selection);
  const destination = `/app?distribution=${encodeURIComponent(distributionQuery(selection))}`;
  const startHref = h.props.signedIn
    ? destination
    : `/login?returnTo=${encodeURIComponent(destination)}`;
  return () => (
    <Document title="Finance Planner">
      <main mix={shell}>
        <nav mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <strong>Finance Planner</strong>
          <a href={h.props.signedIn ? "/app" : "/login"} mix={button({ secondary: true })}>
            {h.props.signedIn ? "Open planner" : "Sign in"}
          </a>
        </nav>
        <section mix={css({ maxWidth: "720px", padding: "96px 0 120px" })}>
          <p
            mix={css({
              color: "#8bbd67",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontSize: "12px",
            })}
          >
            A calmer view of your money
          </p>
          <h1
            mix={css({
              fontSize: "clamp(42px, 8vw, 78px)",
              lineHeight: 1.02,
              letterSpacing: "-.05em",
              margin: "18px 0",
            })}
          >
            Plan investments with clarity.
          </h1>
          <p mix={css({ ...muted, fontSize: "20px", maxWidth: "570px" })}>
            A private home for understanding what you own, why you own it, and where you want to go
            next.
          </p>
          <a href="/login" mix={button({})}>
            Get started with a passkey →
          </a>
        </section>
        <DistributionExplorer
          signedIn={h.props.signedIn}
          initialSelection={selection}
          initialExposures={exposures}
          initialStartHref={startHref}
        />
        <footer mix={css(muted)}>
          Private by default. Your portfolio data will live in your account. This explorer is
          educational, not personalized financial advice. Finance Planner is independent and is not
          endorsed by or affiliated with Ben Felix, PWL Capital, or Rational Reminder.
        </footer>
      </main>
    </Document>
  );
}

function DistributionExplorer(
  h: Handle<{
    signedIn: boolean;
    initialSelection: DistributionSelection;
    initialExposures: ReturnType<typeof distributionExposures>;
    initialStartHref: string;
  }>,
) {
  return () => (
    <section
      data-distribution-explorer
      data-signed-in={h.props.signedIn ? "true" : "false"}
      mix={css({
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 420px)",
        gap: "28px",
        alignItems: "start",
        maxWidth: "1040px",
        padding: "28px 0 72px",
        "@media (max-width: 760px)": { gridTemplateColumns: "1fr" },
      })}
    >
      <div
        mix={css({
          background: "#183127",
          border: "1px solid #315244",
          borderRadius: "24px",
          padding: "28px",
        })}
      >
        <p mix={eyebrow}>Build a starting point</p>
        <h2 mix={css({ fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.08, margin: "12px 0" })}>
          Choose the shape of your portfolio.
        </h2>
        <p mix={css(muted)}>
          Explore the tradeoffs, then start your private plan with the distribution that feels
          right.
        </p>
        <div mix={css({ display: "grid", gap: "24px", marginTop: "28px" })}>
          <DistributionSlider
            name="us"
            label="US versus global"
            left="More global"
            right="More US"
            value={h.props.initialSelection.us}
          />
          <DistributionSlider
            name="tilt"
            label="Total market versus factor tilt"
            left="Total market"
            right="Factor tilt"
            value={h.props.initialSelection.tilt}
          />
          <p
            mix={css({
              color: "#b8e986",
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontSize: "12px",
              margin: "4px 0 0",
            })}
          >
            Asset mix
          </p>
          <DistributionSlider
            name="stocks"
            label="Stocks versus bonds"
            left="More bonds"
            right="More stocks"
            value={h.props.initialSelection.stocks}
          />
          <DistributionSlider
            name="realEstate"
            label="Real-estate share"
            left="No real estate"
            right="More real estate"
            value={h.props.initialSelection.realEstate}
            max={30}
            suffix="% of portfolio"
          />
        </div>
      </div>
      <div
        mix={css({
          background: "#10251d",
          border: "1px solid #527061",
          borderRadius: "24px",
          padding: "28px",
          position: "sticky",
          top: "20px",
        })}
      >
        <p mix={eyebrow}>Your starting distribution</p>
        <div
          data-distribution-summary
          mix={css({ display: "grid", gap: "10px", margin: "22px 0" })}
        >
          {h.props.initialExposures.map((exposure) => (
            <DistributionRow
              key={exposure.id}
              name={exposure.name}
              value={exposure.targetPercent}
            />
          ))}
        </div>
        <a data-distribution-start href={h.props.initialStartHref} mix={button({})}>
          Start with this distribution →
        </a>
        <p mix={css({ ...muted, fontSize: "13px", marginBottom: 0 })}>
          You can change the targets and add accounts and investments later.
        </p>
      </div>
    </section>
  );
}

function DistributionSlider(
  h: Handle<{
    name: string;
    label: string;
    left: string;
    right: string;
    middle?: string;
    max?: number;
    suffix?: string;
    value: number;
  }>,
) {
  return () => (
    <label mix={css({ display: "grid", gap: "8px", color: "#d4e1d8", fontSize: "14px" })}>
      <span mix={css({ display: "flex", justifyContent: "space-between", gap: "12px" })}>
        <strong>{h.props.label}</strong>
        <output data-distribution-output={h.props.name}>
          {h.props.value}
          {h.props.suffix ? ` ${h.props.suffix}` : "%"}
        </output>
      </span>
      <input
        data-distribution-input={h.props.name}
        type="range"
        min="0"
        max={h.props.max ?? 100}
        step="1"
        value={h.props.value}
        aria-label={h.props.label}
      />
      <span
        mix={css({
          display: "flex",
          justifyContent: "space-between",
          color: "#a5b9ad",
          fontSize: "12px",
        })}
      >
        <span>{h.props.left}</span>
        {h.props.middle ? <span>{h.props.middle}</span> : null}
        <span>{h.props.right}</span>
      </span>
    </label>
  );
}

function DistributionRow(h: Handle<{ name: string; value: number }>) {
  return () => (
    <div
      data-distribution-row={h.props.name}
      mix={css({ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "14px" })}
    >
      <span>{h.props.name}</span>
      <strong data-distribution-value>{h.props.value.toFixed(1)}%</strong>
    </div>
  );
}

const eyebrow = css({
  color: "#b8e986",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontSize: "12px",
  margin: 0,
});
