import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ShieldCheck } from "lucide-react";
import { AppShell, KpiCard, StatusPill } from "@/components/AppShell";
import { money, INTEREST_RATE } from "@/lib/demo-auth";
import { useAccount } from "@/lib/session";
import { Wizard } from "@/components/Wizard";
import { DEFAULT_PRODUCT_ID, getProduct } from "@/lib/loan-products";
import { getMyOverview, markNotificationsRead, repayLoan } from "@/lib/lending.functions";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRouteFallback } from "@/components/ProtectedRouteFallback";


type DashboardSearch = { apply?: boolean; product?: string };

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard — LendFlow Africa" },
      { name: "description", content: "Track your LendFlow Africa applications, disbursements, mobile money transactions and 2.5% interest repayments." },
      { property: "og:title", content: "My dashboard — LendFlow Africa" },
      { property: "og:description", content: "Applications, disbursements, repayments and notifications in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Keeps the wizard open across refresh and closes cleanly on browser back.
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    apply: search.apply === true || search.apply === "true" || search.apply === "1" ? true : undefined,
    product: typeof search.product === "string" ? search.product : undefined,
  }),
  ssr: false,
  component: ClientDashboard,
});

type Row = Record<string, any>;

function ClientDashboard() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { account, loading, error: sessionError } = useAccount();
  const overview = useServerFn(getMyOverview);
  const repay = useServerFn(repayLoan);
  const readAll = useServerFn(markNotificationsRead);

  const [data, setData] = useState<null | {
    kycStatus: string; applications: Row[]; loans: Row[]; transactions: Row[]; notifications: Row[];
  }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const wizardOpen = search.apply === true;

  const refresh = useCallback(async () => {
    try {
      const d = await overview({});
      setData({
        kycStatus: d.kycStatus ?? "pending",
        applications: d.applications as Row[],
        loans: d.loans as Row[],
        transactions: d.transactions as Row[],
        notifications: d.notifications as Row[],
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your dashboard.");
    }
  }, [overview]);

  // Opening/closing the wizard only ever changes the dashboard's search params —
  // it never navigates away from /dashboard.
  const openWizard = useCallback((productId?: string) => {
    void navigate({ to: "/dashboard", search: { apply: true, product: productId }, resetScroll: false });
  }, [navigate]);

  const closeWizard = useCallback(() => {
    void navigate({ to: "/dashboard", search: {}, replace: true, resetScroll: false });
    void refresh();
    // Return the borrower to the exact section they launched the wizard from.
    requestAnimationFrame(() => {
      document.querySelector('[data-testid="loans-card"]')?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [navigate, refresh]);

  useEffect(() => {
    if (loading) return;
    if (!account) { navigate({ to: "/auth" }); return; }
    if (account.role === "manager") { navigate({ to: "/manager" }); return; }
    void refresh();
  }, [loading, account, navigate, refresh]);

  // Live + periodic refresh so an admin's KYC approval / decision unlocks the
  // dashboard immediately without a manual reload.
  useEffect(() => {
    if (loading || !account || account.role !== "client") return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      channel = supabase
        .channel(`dashboard-${u.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${u.user.id}` }, () => void refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "kyc_documents", filter: `user_id=eq.${u.user.id}` }, () => void refresh())
        .subscribe();
    })();

    const timer = setInterval(() => { void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loading, account, refresh]);


  const fallback = (
    <ProtectedRouteFallback account={account} loading={loading} error={sessionError} expectedRole="client">
      {() => <></>}
    </ProtectedRouteFallback>
  );
  if (loading || sessionError || !account || account.role !== "client") return fallback;
  if (!data && !error) {
    return (
      <div data-testid="dashboard-loading" className="grid min-h-[60vh] place-items-center p-10 text-sm font-semibold text-[color:var(--color-muted)]">
        Loading your dashboard…
      </div>
    );
  }
  if (account?.role === "client" && !data && error) {
    return (
      <AppShell user={account} subtitle="Borrower account">
        <div role="alert" className="card mx-auto max-w-xl p-8 text-center">
          <h1 className="text-2xl font-black">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{error}</p>
          <button type="button" onClick={() => void refresh()} className="btn-primary mt-5 rounded-full px-6 py-3 text-sm font-bold">
            Try again
          </button>
        </div>
      </AppShell>
    );
  }
  if (!data) return fallback;


  const outstanding = data.loans.reduce((s, l) => s + Number(l.outstanding_principal ?? 0), 0);
  const disbursed = data.loans.filter(l => l.disbursed_at).reduce((s, l) => s + Number(l.principal), 0);
  const fees = data.applications.reduce((s, a) => s + Number(a.service_fee ?? 0), 0);
  const unread = data.notifications.filter(n => !n.read_at).length;

  const doRepay = async (loan: Row, amount: number) => {
    setBusy(loan.id); setError("");
    try { await repay({ data: { loanId: loan.id, amount } }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Repayment failed"); }
    finally { setBusy(null); }
  };

  return (
    <AppShell user={account} subtitle="Borrower account">
      <div className="rise">
        <h1 className="text-3xl font-black tracking-tight">Hello, {account.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-[color:var(--color-muted)]">All LendFlow loans carry a flat 2.5% interest — no surprises.</p>

        {data.kycStatus !== "approved" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-5">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <span className="min-w-0 flex-1 text-sm font-semibold text-amber-800">
              Identity verification is {data.kycStatus}. You can't apply for a loan until it is approved.
            </span>
            <Link to="/kyc" className="btn-navy rounded-full px-5 py-2 text-xs font-bold">Verify identity</Link>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Applications" value={String(data.applications.length)} hint="Lifetime" tone="sky" />
          <KpiCard label="Outstanding" value={money(outstanding)} hint="Incl. 2.5% interest" />
          <KpiCard label="Disbursed" value={money(disbursed)} tone="sun" />
          <KpiCard label="Service fees paid" value={money(fees)} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section data-testid="loans-card" className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-6 py-4">
                <h2 className="text-lg font-bold">My loans</h2>
                <button
                  type="button"
                  data-testid="apply-loan"
                  onClick={() => openWizard()}
                  className="btn-primary rounded-full px-4 py-2 text-xs font-bold"
                >
                  Apply for a loan
                </button>
              </div>
              {data.loans.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">
                  No loans yet. Once a manager approves an application it appears here.
                </p>
              ) : (
                <div className="divide-y divide-[color:var(--color-line)]">
                  {data.loans.map(l => {
                    const balance = Number(l.outstanding_principal ?? 0);
                    const instalment = Math.min(balance, Math.round(Number(l.total_repayment || l.principal) / (l.term_months || 1)));
                    return (
                      <div key={l.id} data-testid="loan-row" data-status={l.status} className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black">{money(Number(l.principal))}</span>
                          <span className="text-xs text-[color:var(--color-muted)]">· {l.product_title} · {l.term_months} months</span>
                          <StatusPill status={l.status} />
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                          Total repayable {money(Number(l.total_repayment || l.principal))} · paid{" "}
                          <span data-testid="loan-paid">{money(Number(l.amount_paid ?? 0))}</span> · balance{" "}
                          <span data-testid="loan-balance" className="font-bold text-[color:var(--color-fg)]">{money(balance)}</span>
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                          {l.provider} {l.msisdn} · {l.disbursed_at ? `disbursed ${new Date(l.disbursed_at).toLocaleDateString()}` : "awaiting disbursement"}
                        </div>
                        {l.status === "active" && balance > 0 && (
                          <button
                            data-testid="repay-button"
                            disabled={busy === l.id}
                            onClick={() => doRepay(l, instalment)}
                            className="btn-primary mt-3 rounded-full px-5 py-2 text-xs font-bold disabled:opacity-60"
                          >
                            {busy === l.id ? "Processing…" : `Repay ${money(instalment)} via ${l.provider}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {error && <p className="field-error px-6 pb-4 text-sm text-red-600">{error}</p>}
            </section>

            <section data-testid="applications-card" className="card overflow-hidden">
              <div className="border-b border-[color:var(--color-line)] px-6 py-4"><h2 className="text-lg font-bold">My applications</h2></div>
              {data.applications.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">No applications yet.</p>
              ) : (
                <div className="divide-y divide-[color:var(--color-line)]">
                  {data.applications.map(a => (
                    <div key={a.id} data-testid="application-row" data-status={a.status} className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{money(Number(a.amount))}</span>
                        <span className="text-xs text-[color:var(--color-muted)]">· {a.product_title} · {a.term_months} months</span>
                        <StatusPill status={a.status} />
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                        Service fee {money(Number(a.service_fee ?? 0))} ({a.service_fee_pct}%) via {a.mobile_provider}
                        {a.decision_notes ? ` · ${a.decision_notes}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section data-testid="transactions-card" className="card overflow-hidden">
              <div className="border-b border-[color:var(--color-line)] px-6 py-4">
                <h2 className="text-lg font-bold">Mobile money transactions</h2>
                <p className="text-xs text-[color:var(--color-muted)]">Every service fee, disbursement and repayment, reconciled.</p>
              </div>
              {data.transactions.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-[color:var(--color-muted)]">No transactions yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                    <tr><th className="px-6 py-2">Type</th><th className="py-2">Amount</th><th className="py-2">Status</th><th className="py-2">Reference</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-line)]">
                    {data.transactions.map(t => (
                      <tr key={t.id} data-testid="transaction-row" data-type={t.tx_type}>
                        <td className="px-6 py-3 font-bold capitalize">{t.tx_type === "commitment" ? "service fee" : t.tx_type}</td>
                        <td className="py-3 tabular-nums">{money(Number(t.amount))}</td>
                        <td className="py-3"><StatusPill status={t.status} /></td>
                        <td className="py-3 text-xs text-[color:var(--color-muted)]">{t.provider_ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section data-testid="notifications-card" className="card h-fit overflow-hidden">
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-4">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold"><Bell className="h-4 w-4" /> Notifications</h2>
              {unread > 0 && (
                <button onClick={async () => { await readAll({}); await refresh(); }}
                  className="rounded-full bg-[color:var(--color-sky)] px-3 py-1 text-xs font-bold">{unread} new</button>
              )}
            </div>
            {data.notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[color:var(--color-muted)]">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--color-line)]">
                {data.notifications.map(n => (
                  <li key={n.id} data-testid="notification" data-kind={n.kind} className={`px-5 py-4 ${n.read_at ? "" : "bg-[color:var(--color-mint)]/40"}`}>
                    <div className="text-sm font-bold">{n.title}</div>
                    <div className="mt-1 text-xs text-[color:var(--color-muted)]">{n.body}</div>
                    <div className="mt-1 text-[10px] text-[color:var(--color-muted)]">{new Date(n.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {wizardOpen && (() => {
        const p = getProduct(search.product ?? DEFAULT_PRODUCT_ID);
        const amount = Math.min(Math.max(15000, p.minAmount), p.maxAmount);
        const term = Math.min(Math.max(12, p.minTerm), p.maxTerm);
        const serviceFee = Math.round((amount * p.serviceFeePct) / 100);
        const monthly = (amount + Math.round(amount * INTEREST_RATE)) / term;
        return (
          <Wizard
            loan={{ amount, term, pct: p.serviceFeePct, serviceFee, monthly, productId: p.id }}
            onClose={() => { closeWizard(); }}
          />
        );
      })()}
    </AppShell>
  );
}
