import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader, ShieldCheck, Upload, XCircle } from "lucide-react";
import { AppShell, StatusPill } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/session";
import { getMyOverview, saveKycDocument } from "@/lib/lending.functions";
import { ProtectedRouteFallback } from "@/components/ProtectedRouteFallback";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "Identity verification — LendFlow Africa" },
      { name: "description", content: "Upload your national ID and a selfie to verify your identity and unlock LendFlow Africa loan applications." },
      { property: "og:title", content: "Identity verification — LendFlow Africa" },
      { property: "og:description", content: "Verify your identity to unlock loan applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: KycPage,
});

const DOCS = [
  { type: "id_front" as const, label: "National ID — front", hint: "Clear photo of the front of your ID card." },
  { type: "id_back" as const, label: "National ID — back", hint: "Clear photo of the back of your ID card." },
  { type: "selfie" as const, label: "Selfie holding your ID", hint: "Your face and the ID must both be readable." },
];

type DocRow = { id: string; doc_type: string; status: string; review_notes: string | null };

function KycPage() {
  const { account, loading, error: sessionError } = useAccount();
  const overview = useServerFn(getMyOverview);
  const save = useServerFn(saveKycDocument);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [kyc, setKyc] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await overview({});
      setDocs(data.documents as DocRow[]);
      setKyc(data.kycStatus ?? "pending");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load identity verification.");
    } finally {
      setLoaded(true);
    }
  }, [overview]);

  useEffect(() => {
    if (loading || sessionError || !account || account.role !== "client") return;
    void refresh();
  }, [loading, sessionError, account, refresh]);

  if (loading || sessionError || !account || account.role !== "client") {
    return <ProtectedRouteFallback account={account} loading={loading} error={sessionError} expectedRole="client">{() => <></>}</ProtectedRouteFallback>;
  }
  if (!loaded) {
    return <div className="grid min-h-[60vh] place-items-center p-10 text-sm font-semibold text-[color:var(--color-muted)]">Loading identity verification…</div>;
  }

  const upload = async (docType: (typeof DOCS)[number]["type"], file: File) => {
    setError("");
    setBusy(docType);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${uid}/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      await save({ data: { docType, storagePath: path } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const verified = kyc === "approved";

  return (
    <AppShell user={account} subtitle="Identity verification">
      <div className="rise mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Verify your identity</h1>
        <p className="mt-1 text-[color:var(--color-muted)]">
          We must confirm who you are before any LendFlow loan can be applied for or disbursed.
        </p>

        <div
          data-testid="kyc-status"
          data-status={kyc}
          className={`mt-6 flex items-center gap-3 rounded-2xl p-5 ${
            verified ? "bg-[color:var(--color-mint)]" : kyc === "rejected" ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          {verified ? <ShieldCheck className="h-6 w-6 text-[color:var(--color-leaf-dark)]" /> : <Upload className="h-6 w-6 text-amber-600" />}
          <div>
            <div className="font-bold capitalize">Verification status: {kyc}</div>
            <div className="text-sm text-[color:var(--color-muted)]">
              {verified
                ? "You're verified — loan applications are unlocked."
                : "Upload all three documents. A LendFlow officer reviews them, usually within a few hours."}
            </div>
          </div>
          {verified && (
            <Link to="/" className="btn-primary ml-auto rounded-full px-5 py-2 text-xs font-bold">Apply for a loan</Link>
          )}
        </div>

        {error && <p className="mt-4 field-error text-sm text-red-600">{error}</p>}

        <div className="mt-6 grid gap-4">
          {DOCS.map(d => {
            const row = docs.find(x => x.doc_type === d.type);
            return (
              <div key={d.type} data-testid={`kyc-doc-${d.type}`} className="card flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold">
                    {d.label}
                    {row && <StatusPill status={row.status} />}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-muted)]">{row?.review_notes ?? d.hint}</div>
                </div>
                {row?.status === "approved" ? (
                  <CheckCircle2 className="h-6 w-6 text-[color:var(--color-leaf)]" />
                ) : (
                  <UploadButton
                    testId={`kyc-upload-${d.type}`}
                    busy={busy === d.type}
                    label={row ? "Replace" : "Upload"}
                    onFile={f => upload(d.type, f)}
                  />
                )}
                {row?.status === "rejected" && <XCircle className="h-5 w-5 text-red-500" />}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function UploadButton({ label, busy, onFile, testId }:
  { label: string; busy: boolean; onFile: (f: File) => void; testId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        data-testid={testId}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn-navy inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold disabled:opacity-60"
      >
        {busy ? <Loader className="spin h-4 w-4" /> : <Upload className="h-4 w-4" />} {busy ? "Uploading…" : label}
      </button>
    </>
  );
}
