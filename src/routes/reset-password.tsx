import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { inputCls } from "@/components/Wizard";
import { supabase } from "@/integrations/supabase/client";
import { updateAccountPassword } from "@/lib/session";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — LendFlow Africa" },
      { name: "description", content: "Securely choose a new password for your LendFlow Africa account." },
      { property: "og:title", content: "Reset password — LendFlow Africa" },
      { property: "og:description", content: "Securely choose a new LendFlow Africa account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const isRecovery = hash.get("type") === "recovery" || query.get("type") === "recovery";

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setReady(isRecovery || Boolean(data.session));
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    const result = await updateAccountPassword(password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setComplete(true);
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 py-6">
        <Link to="/"><Brand /></Link>
      </header>
      <main className="mx-auto max-w-lg px-6 pb-20 pt-6">
        <section className="card rise p-8">
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--color-mint)] text-[color:var(--color-leaf-dark)]">
            {complete ? <CheckCircle2 className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>
          <h1 className="text-2xl font-black">{complete ? "Password updated" : "Choose a new password"}</h1>

          {complete ? (
            <>
              <p className="mt-3 text-sm text-[color:var(--color-muted)]">Your new password is ready to use.</p>
              <button onClick={() => navigate({ to: "/auth" })} className="btn-primary mt-6 w-full rounded-full px-6 py-3 text-sm font-bold">
                Continue to sign in
              </button>
            </>
          ) : checking ? (
            <p className="mt-3 text-sm text-[color:var(--color-muted)]">Checking your secure reset link…</p>
          ) : !ready ? (
            <>
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">This reset link is invalid or has expired.</p>
              <Link to="/auth" className="btn-navy mt-6 block rounded-full px-6 py-3 text-center text-sm font-bold">Request another link</Link>
            </>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Label label="New password">
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputCls()} />
              </Label>
              <Label label="Confirm new password">
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputCls()} />
              </Label>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60">
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[color:var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}