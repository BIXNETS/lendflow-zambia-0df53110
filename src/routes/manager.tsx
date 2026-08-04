import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ShieldCheck } from "lucide-react";
import { AppShell, KpiCard, StatusPill } from "@/components/AppShell";
import { money } from "@/lib/demo-auth";
import { useAccount } from "@/lib/session";
import { ProtectedRouteFallback } from "@/components/ProtectedRouteFallback";
import {
  getAdminOverview, decideApplication, disburseLoan, adminRecordRepayment, reviewBorrowerKyc,
} from "@/lib/lending.functions";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Manager console — LendFlow Africa" },
      { name: "description", content: "Review LendFlow Africa identity documents and applications, issue loan decisions, disburse mobile money and reconcile repayments." },
      { property: "og:title", content: "Manager console — LendFlow Africa" },
      { property: "og:description", content: "Review, decide, disburse and reconcile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ManagerConsole,
});

type Row = Record<string, any>;

function ManagerConsole() {
  const { account, loading, error: sessionError } = useAccount();
  const overview = useServerFn(getAdminOverview);
  const decide = useServerFn(decideApplication);
  const disburse = useServerFn(disburseLoan);
  const repay = useServerFn(adminRecordRepayment);
  const reviewKyc = useServerFn(reviewBorrowerKyc);

  const [data, setData] = useState<null | {
    applications: Row[]; loans: Row[]; transactions: Row[]; documents: Row[]; profiles: Row[]; notifications: Row[];
  }>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"applications" | "kyc" | "loans" | "ledger">("applications");

  const refresh = useCallback(async () => {
    try {
      const d = await overview({});
      setData(d as any);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the manager console.");
    }
  }, [overview]);

  useEffect(() => {
    if (loading || sessionError || !account || account.role !== "manager") return;
    void refresh();
  }, [loading, sessionError, account, refresh]);

  if (loading || sessionError || !account || account.role !== "manager") {
    return <ProtectedRouteFallback account={account} loading={loading} error={sessionError} expectedRole="manager">{() => <></>}</ProtectedRouteFallback>;
  }
  if (!data && !error) {
    return <div className="grid min-h-[60vh] place-items-center p-10 text-sm font-semibold text-[color:var(--color-muted)]">Loading the manager console…</div>;
  }
  if (account?.role === "manager" && !data && error) {
    return (
      <AppShell user={account} subtitle="Manager · back office">
        <div role="alert" className="card mx-auto max-w-xl p-8 text-center">
          <h1 className="text-2xl font-black">Manager console unavailable</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{error}</p>
          <button type="button" onClick={() => void refresh()} className="btn-primary mt-5 rounded-full px-6 py-3 text-sm font-bold">Try again</button>
        </div>
      </AppShell>
    );
  }
  if (!data) return <ProtectedRouteFallback account={account} loading={false} expectedRole="manager">{() => <></>}</ProtectedRouteFallback>;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError("");
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  };

  const kycOf = (userId: string | null) =>
    (data.profiles.find(p => p.id === userId)?.kyc_status as string) ?? "unknown";

  const pending = data.applications.filter(a => a.status === "under_review").length;
  const book = data.loans.reduce((s, l) => s + Number(l.principal), 0);
  const collected = data.transactions.filter(t => t.tx_type === "repayment" && t.status === "succeeded")
    .reduce((s, t) => s + Number(t.amount), 0);
  const kycUsers = data.profiles
    .map(profile => ({ profile, documents: data.documents.filter(document => document.user_id === profile.id) }))
    .filter(record => record.documents.length > 0);
  const pendingKyc = kycUsers.filter(record => record.profile.kyc_status !== "approved").length;

  const TABS = [
    ["applications", `Applications (${pending})`],
    ["kyc", `Identity (${pendingKyc})`],
    ["loans", `Loans (${data.loans.length})`],
    ["ledger", "Ledger"],
  ] as const;

  return (
    <AppShell user={account} subtitle="Manager · back office">
      <div className="rise">
        <h1 className="text-3xl font-black tracking-tight">Manager console</h1>
        <p className="mt-1 text-[color:var(--color-muted)]">Verify identities, decide applications, disburse and reconcile mobile money.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Awaiting decision" value={String(pending)} tone="sun" />
          <KpiCard label="People to verify" value={String(pendingKyc)} tone="sky" />
          <KpiCard label="Loan book" value={money(book)} />
          <KpiCard label="Repayments collected" value={money(collected)} tone="sky" />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {TABS.map(([id, label]) => (
            <button key={id} data-testid={`tab-${id}`} onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                tab === id ? "btn-navy" : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-navy)] hover:bg-[color:var(--color-sky)]"
              }`}>{label}</button>
          ))}
        </div>

        {error && <p data-testid="manager-error" className="field-error mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

        {tab === "applications" && (
          <div className="mt-4 card overflow-hidden" data-testid="applications-panel">
            {data.applications.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">No applications yet.</p>
            ) : (
              <div className="divide-y divide-[color:var(--color-line)]">
                {data.applications.map(a => {
                  const kyc = kycOf(a.user_id);
                  const eligible = kyc === "approved";
                  const decidable = a.status === "under_review" || a.status === "submitted";
                  return (
                    <div key={a.id} data-testid="admin-application" data-status={a.status} className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{a.first_name} {a.last_name}</span>
                        <StatusPill status={a.status} />
                        <span data-testid="app-kyc" className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          eligible ? "bg-[color:var(--color-mint)] text-[color:var(--color-leaf-dark)]" : "bg-amber-50 text-amber-700"}`}>
                          <ShieldCheck className="h-3 w-3" /> KYC {kyc}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--color-muted)]">
                        {money(Number(a.amount))} over {a.term_months} months · {a.product_title} · service fee {money(Number(a.service_fee ?? 0))} ({a.service_fee_pct}%)
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                        {a.mobile_provider} {a.mobile_number} · {a.email} · {a.phone}
                        {a.decision_notes ? ` · note: ${a.decision_notes}` : ""}
                      </div>

                      {decidable && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            data-testid="decision-notes"
                            value={notes[a.id] ?? ""}
                            onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))}
                            placeholder="Decision note (optional)"
                            className="min-w-[220px] flex-1 rounded-full border border-[color:var(--color-line)] px-4 py-2 text-sm"
                          />
                          <button
                            data-testid="approve-application"
                            disabled={!eligible || busy === a.id}
                            title={eligible ? "" : "Identity verification must be approved first"}
                            onClick={() => run(a.id, () => decide({ data: { applicationId: a.id, decision: "approved", notes: notes[a.id] || undefined } }))}
                            className="btn-primary rounded-full px-4 py-2 text-xs font-bold disabled:opacity-40">
                            Approve
                          </button>
                          <button
                            data-testid="decline-application"
                            disabled={busy === a.id}
                            onClick={() => run(a.id, () => decide({ data: { applicationId: a.id, decision: "declined", notes: notes[a.id] || undefined } }))}
                            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-40">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "kyc" && (
          <div className="mt-4 card overflow-hidden" data-testid="kyc-panel">
            {kycUsers.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">No documents uploaded yet.</p>
            ) : (
              <div className="divide-y divide-[color:var(--color-line)]">
                {kycUsers.map(({ profile, documents }) => {
                  const allApproved = profile.kyc_status === "approved";
                  const isRejected = documents.some(document => document.status === "rejected");
                  const key = `kyc-${profile.id}`;
                  return (
                    <article key={profile.id} data-testid="admin-kyc-user" data-status={profile.kyc_status} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black">{`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Borrower"}</h2>
                            <StatusPill status={profile.kyc_status} />
                          </div>
                          <p className="mt-1 text-xs text-[color:var(--color-muted)]">{profile.phone || "No phone number"} · ID {profile.national_id || "not provided"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!allApproved && (
                            <button data-testid="approve-doc" disabled={busy === key}
                              onClick={() => run(key, () => reviewKyc({ data: { borrowerId: profile.id, status: "approved" } }))}
                              className="btn-primary rounded-full px-4 py-2 text-xs font-bold disabled:opacity-40">
                              {busy === key ? "Validating…" : "Validate KYC"}
                            </button>
                          )}
                          {!isRejected && (
                            <button data-testid="reject-doc" disabled={busy === key}
                              onClick={() => run(key, () => reviewKyc({ data: { borrowerId: profile.id, status: "rejected", notes: "Identity details or documents could not be validated. Please re-upload clear copies." } }))}
                              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-40">Reject KYC</button>
                          )}
                        </div>
                      </div>
                      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div><dt className="font-bold text-[color:var(--color-muted)]">Date of birth</dt><dd className="mt-1">{profile.date_of_birth || "Not provided"}</dd></div>
                        <div><dt className="font-bold text-[color:var(--color-muted)]">Gender</dt><dd className="mt-1 capitalize">{profile.gender || "Not provided"}</dd></div>
                        <div><dt className="font-bold text-[color:var(--color-muted)]">Location</dt><dd className="mt-1">{[profile.city, profile.province].filter(Boolean).join(", ") || "Not provided"}</dd></div>
                        <div><dt className="font-bold text-[color:var(--color-muted)]">Address</dt><dd className="mt-1">{profile.address || "Not provided"}</dd></div>
                      </dl>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {documents.map(document => (
                          <div key={document.id} className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-sky)] p-3">
                            <div className="flex items-center justify-between gap-2 text-xs font-bold capitalize">
                              {document.doc_type.replace(/_/g, " ")} <StatusPill status={document.status} />
                            </div>
                            <p className="mt-2 truncate text-[11px] text-[color:var(--color-muted)]" title={document.storage_path}>{document.storage_path}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "loans" && (
          <div className="mt-4 card overflow-hidden" data-testid="loans-panel">
            {data.loans.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">No loans yet.</p>
            ) : (
              <div className="divide-y divide-[color:var(--color-line)]">
                {data.loans.map(l => {
                  const balance = Number(l.outstanding_principal ?? 0);
                  const instalment = Math.min(balance, Math.round(Number(l.total_repayment || l.principal) / (l.term_months || 1)));
                  return (
                    <div key={l.id} data-testid="admin-loan" data-status={l.status} className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{money(Number(l.principal))}</span>
                        <span className="text-xs text-[color:var(--color-muted)]">· {l.product_title} · {l.term_months} months</span>
                        <StatusPill status={l.status} />
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                        Total repayable {money(Number(l.total_repayment || l.principal))} · paid {money(Number(l.amount_paid ?? 0))} ·
                        balance <span data-testid="admin-loan-balance" className="font-bold text-[color:var(--color-fg)]">{money(balance)}</span> · {l.provider} {l.msisdn}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {l.status === "pending" && (
                          <button data-testid="disburse-loan" disabled={busy === l.id}
                            onClick={() => run(l.id, () => disburse({ data: { loanId: l.id } }))}
                            className="btn-primary rounded-full px-4 py-2 text-xs font-bold disabled:opacity-40">
                            {busy === l.id ? "Sending…" : `Disburse via ${l.provider}`}
                          </button>
                        )}
                        {l.status === "active" && balance > 0 && (
                          <button data-testid="admin-record-repayment" disabled={busy === l.id}
                            onClick={() => run(l.id, () => repay({ data: { loanId: l.id, amount: instalment } }))}
                            className="rounded-full border border-[color:var(--color-line)] px-4 py-2 text-xs font-bold hover:bg-[color:var(--color-sky)] disabled:opacity-40">
                            Record repayment {money(instalment)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "ledger" && (
          <div className="mt-4 card overflow-hidden" data-testid="ledger-panel">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-6 py-3">Type</th><th className="py-3">Amount</th><th className="py-3">Provider</th>
                  <th className="py-3">Status</th><th className="py-3">Reference</th><th className="py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-line)]">
                {data.transactions.map(t => (
                  <tr key={t.id} data-testid="ledger-row" data-type={t.tx_type}>
                    <td className="px-6 py-3 font-bold capitalize">{t.tx_type === "commitment" ? "service fee" : t.tx_type}</td>
                    <td className="py-3 tabular-nums">{money(Number(t.amount))}</td>
                    <td className="py-3">{t.provider}</td>
                    <td className="py-3"><StatusPill status={t.status} /></td>
                    <td className="py-3 text-xs text-[color:var(--color-muted)]">{t.provider_ref}</td>
                    <td className="py-3 text-xs text-[color:var(--color-muted)]">{new Date(t.occurred_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.transactions.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">No transactions recorded yet.</p>
            )}
          </div>
        )}

        <section data-testid="admin-notifications" className="mt-8 card overflow-hidden">
          <div className="border-b border-[color:var(--color-line)] px-6 py-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold"><Bell className="h-4 w-4" /> Back-office notifications</h2>
          </div>
          {data.notifications.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-[color:var(--color-muted)]">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-line)]">
              {data.notifications.map(n => (
                <li key={n.id} data-testid="admin-notification" data-kind={n.kind} className="px-6 py-4">
                  <div className="text-sm font-bold">{n.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--color-muted)]">{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
