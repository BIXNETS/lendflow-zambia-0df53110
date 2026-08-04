import { Link } from "@tanstack/react-router";
import { AlertTriangle, LoaderCircle, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import type { Account, Role } from "@/lib/demo-auth";

type Props = {
  account: Account | null | undefined;
  loading: boolean;
  error?: string;
  expectedRole?: Role;
  children: (account: Account) => ReactNode;
};

export function ProtectedRouteFallback({ account, loading, error, expectedRole, children }: Props) {
  if (loading) {
    return (
      <main className="grid min-h-[65vh] place-items-center px-6 text-center" role="status">
        <div>
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[color:var(--color-leaf-dark)]" />
          <p className="mt-3 text-sm font-semibold text-[color:var(--color-muted)]">Restoring your secure session…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-[65vh] place-items-center px-6">
        <section role="alert" className="card max-w-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-red-600" />
          <h1 className="mt-3 text-2xl font-black">We couldn&apos;t restore your account</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{error}</p>
          <Link to="/auth" className="btn-primary mt-5 inline-flex rounded-full px-6 py-3 text-sm font-bold">Sign in again</Link>
        </section>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="grid min-h-[65vh] place-items-center px-6">
        <section className="card max-w-lg p-8 text-center">
          <LogIn className="mx-auto h-7 w-7 text-[color:var(--color-leaf-dark)]" />
          <h1 className="mt-3 text-2xl font-black">Continue to your account</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">Sign in or create an account to finish onboarding.</p>
          <Link to="/auth" className="btn-primary mt-5 inline-flex rounded-full px-6 py-3 text-sm font-bold">Continue to onboarding</Link>
        </section>
      </main>
    );
  }

  if (expectedRole && account.role !== expectedRole) {
    const destination = account.role === "manager" ? "/manager" : "/dashboard";
    return (
      <main className="grid min-h-[65vh] place-items-center px-6">
        <section role="alert" className="card max-w-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" />
          <h1 className="mt-3 text-2xl font-black">This page isn&apos;t available for your account</h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">Open your assigned dashboard to continue.</p>
          <Link to={destination} className="btn-primary mt-5 inline-flex rounded-full px-6 py-3 text-sm font-bold">Open my dashboard</Link>
        </section>
      </main>
    );
  }

  return children(account);
}