import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { requestPasswordReset, signInAccount, signUpAccount, useAccount } from "@/lib/session";
import { inputCls } from "@/components/Wizard";
import { cn } from "@/lib/utils";
import { Clock, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LendFlow Africa" },
      { name: "description", content: "Sign in to your LendFlow Africa borrower or manager dashboard, or create a new client account." },
      { property: "og:title", content: "Sign in — LendFlow Africa" },
      { property: "og:description", content: "Access your LendFlow Africa dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Turn raw auth errors into something a borrower can act on. */
function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email address, then sign in.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account — switch to Sign in.";
  if (m.includes("weak") || m.includes("easy to guess"))
    return "That password is too easy to guess. Try a longer one with numbers and symbols.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const go = (role: string) => navigate({ to: role === "manager" ? "/manager" : "/dashboard" });

  // Already signed in? Don't leave the user staring at a form that "does nothing".
  useEffect(() => {
    if (account) go(account.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    if (mode === "signup") {
      if (!name.trim()) return setError("Please enter your full name.");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await signInAccount(cleanEmail, password);
        if (!res.ok) return setError(friendly(res.error));
        go(res.account.role);
      } else {
        const res = await signUpAccount({ name, email: cleanEmail, password, phone });
        if (!res.ok) {
          if (/check your email/i.test(res.error)) return setNotice(res.error);
          return setError(friendly(res.error));
        }
        go(res.account.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async () => {
    setError("");
    setNotice("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter your email address above, then request a reset link.");
      return;
    }
    setResetting(true);
    const result = await requestPasswordReset(cleanEmail);
    setResetting(false);
    if (!result.ok) {
      setError(friendly(result.error));
      return;
    }
    setNotice("If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.");
  };


  const HIGHLIGHTS = [
    { icon: ShieldCheck, title: "Bank-grade security", body: "Your details are encrypted in transit and at rest." },
    { icon: Clock, title: "Decisions in minutes", body: "Verify your identity once and apply any time." },
    { icon: Lock, title: "You stay in control", body: "Track balances, repayments and receipts in your dashboard." },
  ];


  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 py-6">
        <Link to="/"><Brand /></Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 pb-20 lg:grid-cols-2">
        <div className="card rise p-8">
          <div className="flex gap-2 rounded-full bg-[color:var(--color-sky)] p-1">
            {(["signin", "signup"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={cn("flex-1 rounded-full px-4 py-2 text-sm font-bold transition",
                  mode === m ? "bg-white text-[color:var(--color-navy)] shadow" : "text-[color:var(--color-muted)]")}>
                {m === "signin" ? "Sign in" : "New client"}
              </button>
            ))}
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your client account"}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {mode === "signin" ? "Managers and clients use the same sign-in." : "Free to join. Apply for 2.5% interest loans in minutes."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <Labelled label="Full name">
                  <input value={name} onChange={e => setName(e.target.value)} className={inputCls()} placeholder="Joseph Banda" />
                </Labelled>
                <Labelled label="Mobile number">
                  <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls()} placeholder="+260 97 000 0000" />
                </Labelled>
              </>
            )}
            <Labelled label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls()} placeholder="you@example.com" />
            </Labelled>
            <Labelled label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls()} placeholder="••••••••" />
            </Labelled>
            {mode === "signin" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={sendResetLink}
                  disabled={resetting}
                  className="text-sm font-bold text-[color:var(--color-leaf-dark)] hover:underline disabled:opacity-60"
                >
                  {resetting ? "Sending…" : "Forgot password?"}
                </button>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-[color:var(--color-mint)] px-3 py-2 text-sm font-semibold text-[color:var(--color-leaf-dark)]">{notice}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card p-8">
            <div className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-leaf-dark)]">
              Why LendFlow
            </div>
            <div className="mt-5 space-y-4">
              {HIGHLIGHTS.map(h => (
                <div key={h.title} className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-mint)] p-5">
                  <div className="flex items-center gap-2 text-sm font-black text-[color:var(--color-navy)]">
                    <h.icon className="h-4 w-4" /> {h.title}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--color-muted)]">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 text-sm text-[color:var(--color-muted)]">
            New clients: register above, then pay a <strong className="text-[color:var(--color-navy)]">10–15% service fee</strong> to
            unlock your 2.5% interest loan.
          </div>
        </div>
      </main>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[color:var(--color-muted)]">{label}</label>
      {children}
    </div>
  );
}
