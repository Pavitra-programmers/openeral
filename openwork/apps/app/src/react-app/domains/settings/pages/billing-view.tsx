/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Sparkles,
  Zap,
} from "lucide-react";

// ── IPC bridge ────────────────────────────────────────────────────────────
type ElectronBridge = NonNullable<Window["__OPENWORK_ELECTRON__"]>;

function getBridge(): ElectronBridge | null {
  if (typeof window === "undefined") return null;
  return window.__OPENWORK_ELECTRON__ ?? null;
}

async function invoke<T>(command: string, ...args: unknown[]): Promise<T> {
  const bridge = getBridge();
  if (!bridge?.invokeDesktop) throw new Error("Desktop bridge unavailable.");
  return (await bridge.invokeDesktop(command, ...args)) as T;
}

// ── Types (mirrors GET /api/v1/status response) ───────────────────────────
type SubscriptionInfo = {
  /** active | trialing | past_due | canceled | unpaid */
  status: string;
  /** Free | Paid */
  type: string;
  planName: string;
  planTier: string;
  /** Price in cents, e.g. 2900 = $29 */
  amountCents: number;
  interval: string;
  currency: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

type UsageInvoice = {
  status: string;
  totalMicros: string;
  dueDate: string | null;
  paidAt: string | null;
  stripeInvoiceUrl: string | null;
};

type UsageBill = {
  outstandingMicros: string;
  currentPeriod: {
    start: string;
    end: string;
    usageCostMicros: string;
    callCount: number;
  };
  lastInvoice: UsageInvoice | null;
};

type StringCostStatus = {
  keyMissing?: boolean;
  keyValid?: boolean;
  billingMode?: string;
  creditBalanceMicros?: string;
  /** Fixed monthly platform subscription */
  subscription?: SubscriptionInfo | null;
  /** Variable AI usage bill */
  usageBill?: UsageBill;
  dashboardUrl?: string;
  error?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatMicros(micros: string | number | undefined): string {
  if (micros == null) return "—";
  const dollars = Number(micros) / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(dollars) ? dollars : 0);
}

function formatCents(cents: number | undefined, currency = "usd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function subscriptionStatusMeta(status: string): {
  label: string;
  cls: string;
  dot: string;
} {
  switch (status) {
    case "active":
      return {
        label: "Active",
        cls: "border-green-7/50 bg-green-2/20 text-green-11",
        dot: "bg-green-9",
      };
    case "trialing":
      return {
        label: "Trial",
        cls: "border-blue-7/50 bg-blue-2/20 text-blue-11",
        dot: "bg-blue-9",
      };
    case "past_due":
      return {
        label: "Past due",
        cls: "border-amber-7/50 bg-amber-2/20 text-amber-11",
        dot: "bg-amber-9",
      };
    case "unpaid":
      return {
        label: "Unpaid",
        cls: "border-red-7/50 bg-red-2/20 text-red-11",
        dot: "bg-red-9",
      };
    case "canceled":
      return {
        label: "Canceled",
        cls: "border-gray-7/40 bg-gray-2/20 text-gray-10",
        dot: "bg-gray-7",
      };
    default:
      return {
        label: status,
        cls: "border-dls-border bg-dls-surface text-dls-secondary",
        dot: "bg-gray-7",
      };
  }
}

function invoiceStatusClass(status: string): string {
  switch (status) {
    case "paid":
      return "border-green-7/50 bg-green-2/20 text-green-11";
    case "uncollectible":
    case "overdue":
      return "border-red-7/50 bg-red-2/20 text-red-11";
    case "pending":
    case "sent":
      return "border-amber-7/40 bg-amber-2/20 text-amber-11";
    default:
      return "border-dls-border bg-dls-surface text-dls-secondary";
  }
}

// ── Shared style tokens ────────────────────────────────────────────────────
const cardClass =
  "rounded-[28px] border border-dls-border bg-dls-surface p-5 md:p-6 space-y-4";
const metricCardClass =
  "rounded-xl border border-dls-border bg-dls-surface/80 px-4 py-3";
const pillLinkClass =
  "inline-flex items-center gap-1.5 rounded-full border border-dls-border bg-dls-surface px-3 py-1.5 text-xs font-medium text-dls-text hover:bg-dls-hover transition-colors";
const sectionLabelClass =
  "rounded-full border border-dls-border bg-dls-surface/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dls-secondary";

// ── Component ─────────────────────────────────────────────────────────────
export function BillingView() {
  const [status, setStatus] = useState<StringCostStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await invoke<StringCostStatus>("openeralStringCostStatus");
      setStatus(result ?? null);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to fetch billing status.",
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Key not configured ────────────────────────────────────────────────
  if (!loading && (status?.keyMissing || !status)) {
    return (
      <div className={cardClass}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-dls-border bg-dls-hover">
            <CreditCard size={18} className="text-dls-secondary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-dls-text">
              StringCost Billing
            </h3>
            <p className="mt-1 text-sm text-dls-secondary">
              Add your{" "}
              <strong className="text-dls-text">StringCost API key</strong> in{" "}
              <strong className="text-dls-text">Settings → Sandbox</strong> to
              unlock billing visibility — subscription plan, renewal date, and
              AI usage breakdown. All payments are managed on StringCost.
            </p>
            {fetchError ? (
              <p className="mt-2 text-xs text-amber-11">{fetchError}</p>
            ) : null}
          </div>
        </div>

        <a
          href="https://app.stringcost.com"
          target="_blank"
          rel="noreferrer"
          className={pillLinkClass}
        >
          Sign up / Log in <ArrowUpRight size={12} />
        </a>

        <div className="rounded-xl border border-dls-border bg-dls-surface/60 px-4 py-3 text-[13px] text-dls-secondary">
          <strong className="text-dls-text">How billing works: </strong>
          Two kinds of billing run through StringCost for OpenEral:{" "}
          <span className="text-dls-text">
            ① a flat monthly platform subscription
          </span>{" "}
          (sandboxes, cost monitoring, reports) and{" "}
          <span className="text-dls-text">② variable AI usage charges</span>{" "}
          (per API call metered through the StringCost proxy). Both are visible
          here once your key is configured.
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-3 text-sm text-dls-secondary">
          <Loader2 size={16} className="animate-spin" />
          Loading billing information…
        </div>
      </div>
    );
  }

  // ── Endpoint error ────────────────────────────────────────────────────
  if (status?.error) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dls-text">
            StringCost Billing
          </h3>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-9 hover:bg-dls-hover"
            onClick={() => void refresh()}
            title="Retry"
          >
            <RefreshCcw size={13} />
          </button>
        </div>
        <div className="rounded-xl border border-amber-7/40 bg-amber-2/20 px-3 py-2 text-[13px] text-amber-11">
          {status.error}
        </div>
        <a
          href={status.dashboardUrl ?? "https://app.stringcost.com"}
          target="_blank"
          rel="noreferrer"
          className={pillLinkClass}
        >
          Open StringCost <ArrowUpRight size={12} />
        </a>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────
  const sub = status?.subscription;
  const usage = status?.usageBill;
  const subMeta = sub ? subscriptionStatusMeta(sub.status) : null;
  const isSubProblem = sub?.status === "past_due" || sub?.status === "unpaid";

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-green-7/50 bg-green-2/20">
              <CreditCard size={18} className="text-green-11" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dls-text">
                StringCost Billing
              </h3>
              <p className="text-xs text-dls-secondary">
                Billing mode:{" "}
                <span className="font-medium text-dls-text capitalize">
                  {status?.billingMode ?? "—"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.dashboardUrl ? (
              <a
                href={status.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className={pillLinkClass}
              >
                Open StringCost <ExternalLink size={12} />
              </a>
            ) : null}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-9 hover:bg-dls-hover hover:text-dls-text"
              onClick={() => void refresh()}
              disabled={loading}
              title="Refresh billing status"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <p className="text-[13px] text-dls-secondary">
          All payments are managed on StringCost. OpenWork only shows status —
          use the StringCost dashboard to change plans or pay invoices.
        </p>
      </div>

      {/* ── Section 1: Platform subscription (fixed monthly) ─────────── */}
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <Calendar size={15} className="shrink-0 text-dls-secondary" />
          <h3 className="text-sm font-semibold text-dls-text">
            Platform Subscription
          </h3>
          <span className={`ml-auto ${sectionLabelClass}`}>Fixed monthly</span>
        </div>

        {sub ? (
          <>
            {/* Plan card */}
            <div className="rounded-xl border border-dls-border bg-dls-surface/60 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-dls-text">
                      {sub.planName}
                    </span>
                    <span className="rounded-full border border-dls-border bg-dls-surface/80 px-2 py-0.5 text-[10px] font-medium capitalize text-dls-secondary">
                      {sub.planTier}
                    </span>
                    {subMeta ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${subMeta.cls}`}
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${subMeta.dot}`}
                        />
                        {subMeta.label}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[13px] text-dls-secondary">
                    {formatCents(sub.amountCents, sub.currency)}{" "}
                    <span className="lowercase">/{sub.interval}</span>
                  </div>
                </div>

                {/* Renewal / period */}
                <div className="shrink-0 space-y-0.5 text-right text-[12px] text-dls-secondary">
                  {sub.currentPeriodEnd ? (
                    <>
                      <div className="font-medium text-dls-text">
                        {sub.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                        {formatDate(sub.currentPeriodEnd)}
                      </div>
                      <div>
                        Period: {formatDate(sub.currentPeriodStart)} →{" "}
                        {formatDate(sub.currentPeriodEnd)}
                      </div>
                    </>
                  ) : null}
                  {sub.canceledAt ? (
                    <div className="text-gray-9">
                      Canceled {formatDate(sub.canceledAt)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Past-due warning */}
            {isSubProblem ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-7/40 bg-amber-2/20 px-4 py-3 text-[13px] text-amber-11">
                <span className="shrink-0 font-semibold">
                  ⚠ Subscription payment issue.
                </span>
                <span>
                  Your subscription is {sub.status.replace("_", " ")}. Log in to
                  StringCost to update your payment method.{" "}
                  <a
                    href={status?.dashboardUrl ?? "https://app.stringcost.com"}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open StringCost →
                  </a>
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dls-border/60 bg-dls-surface/40 px-4 py-3 text-[13px] text-dls-secondary">
            No active subscription found for this API key.{" "}
            <a
              href={status?.dashboardUrl ?? "https://app.stringcost.com"}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-dls-text"
            >
              View on StringCost →
            </a>
          </div>
        )}
      </div>

      {/* ── Section 2: AI usage (variable monthly) ────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <Zap size={15} className="shrink-0 text-dls-secondary" />
          <h3 className="text-sm font-semibold text-dls-text">AI Usage</h3>
          <span className={`ml-auto ${sectionLabelClass}`}>Variable</span>
        </div>

        {usage?.currentPeriod ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={metricCardClass}>
              <div className="text-[10px] font-medium uppercase tracking-wider text-dls-secondary">
                This month
              </div>
              <div className="mt-1 text-lg font-semibold text-dls-text">
                {formatMicros(usage.currentPeriod.usageCostMicros)}
              </div>
              <div className="text-[11px] text-dls-secondary">
                {usage.currentPeriod.callCount.toLocaleString()} API calls
              </div>
            </div>

            <div className={metricCardClass}>
              <div className="text-[10px] font-medium uppercase tracking-wider text-dls-secondary">
                Unbilled so far
              </div>
              <div className="mt-1 text-lg font-semibold text-dls-text">
                {formatMicros(usage.outstandingMicros)}
              </div>
              <div className="text-[11px] text-dls-secondary">
                Pending next invoice
              </div>
            </div>

            <div className={metricCardClass}>
              <div className="text-[10px] font-medium uppercase tracking-wider text-dls-secondary">
                Period
              </div>
              <div className="mt-1 text-sm font-medium text-dls-text">
                {formatDate(usage.currentPeriod.start)}
              </div>
              <div className="text-[11px] text-dls-secondary">
                → {formatDate(usage.currentPeriod.end)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-dls-secondary">
            No usage data for this period.
          </p>
        )}

        {/* Last usage invoice */}
        {usage?.lastInvoice ? (
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-dls-secondary">
              Last invoice
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-dls-border bg-dls-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                <span className="font-semibold text-dls-text">
                  {formatMicros(usage.lastInvoice.totalMicros)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${invoiceStatusClass(usage.lastInvoice.status)}`}
                >
                  {usage.lastInvoice.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-dls-secondary">
                {usage.lastInvoice.paidAt ? (
                  <span>Paid {formatDate(usage.lastInvoice.paidAt)}</span>
                ) : usage.lastInvoice.dueDate ? (
                  <span>Due {formatDate(usage.lastInvoice.dueDate)}</span>
                ) : null}
                {usage.lastInvoice.stripeInvoiceUrl ? (
                  <a
                    href={usage.lastInvoice.stripeInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline hover:text-dls-text"
                  >
                    View invoice <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            </div>

            {/* Overdue warning — link to StringCost, no Pay button */}
            {usage.lastInvoice.status === "uncollectible" ||
            usage.lastInvoice.status === "overdue" ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-7/40 bg-red-2/20 px-4 py-3 text-[13px] text-red-11">
                <span className="shrink-0 font-semibold">
                  ⚠ Invoice overdue.
                </span>
                <span>
                  Your account may be restricted. Open StringCost to pay.{" "}
                  <a
                    href={
                      usage.lastInvoice.stripeInvoiceUrl ??
                      status?.dashboardUrl ??
                      "https://app.stringcost.com"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open StringCost →
                  </a>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Explainer footer ────────────────────────────────────────── */}
      <div className="rounded-[28px] border border-dls-border bg-dls-surface/40 px-5 py-4 text-[13px] text-dls-secondary md:px-6">
        <div className="flex items-start gap-3">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-9" />
          <div>
            <span className="font-medium text-dls-text">
              How billing works in OpenEral:{" "}
            </span>
            OpenEral uses StringCost as its billing layer. You pay two kinds of
            charges —{" "}
            <strong className="text-dls-text">
              a flat monthly subscription
            </strong>{" "}
            for platform access (sandboxes, cost monitoring, reports) and{" "}
            <strong className="text-dls-text">variable AI usage charges</strong>{" "}
            based on the Anthropic API tokens your agents consume. Both are
            collected on StringCost and are never processed inside OpenWork.
          </div>
        </div>
      </div>
    </div>
  );
}
