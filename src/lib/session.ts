import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { Account, Role } from "@/lib/demo-auth";


export type SignResult = { ok: true; account: Account } | { ok: false; error: string };

/** Make sure a profile row exists for the signed-in user (no auth-schema trigger available). */
async function ensureProfile(userId: string, meta: Record<string, string>) {
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) return;
  await supabase.from("profiles").insert({
    id: userId,
    first_name: meta.first_name ?? null,
    last_name: meta.last_name ?? null,
    phone: meta.phone ?? null,
  });
}

async function accountFromSession(): Promise<Account | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  await ensureProfile(user.id, (user.user_metadata ?? {}) as Record<string, string>);

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);


  const isAdmin = (roles ?? []).some(r => r.role === "admin");
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
    (user.email ?? "").split("@")[0]!;

  return {
    email: user.email ?? "",
    password: "",
    name,
    role: (isAdmin ? "manager" : "client") as Role,
    phone: profile?.phone ?? meta.phone ?? "",
  };
}

export async function signInAccount(email: string, password: string): Promise<SignResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  const account = await accountFromSession();
  if (!account) return { ok: false, error: "Could not load your account." };
  return { ok: true, account };
}

export async function signUpAccount(input: {
  name: string; email: string; password: string; phone: string;
}): Promise<SignResult> {
  const [first_name, ...rest] = input.name.trim().split(/\s+/);
  const { error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      data: { first_name: first_name ?? "", last_name: rest.join(" "), phone: input.phone },
    },
  });
  if (error) return { ok: false, error: error.message };

  const account = await accountFromSession();
  if (!account) {
    return { ok: false, error: "Account created. Please check your email to confirm, then sign in." };
  }
  return { ok: true, account };
}

export async function signOutAccount() {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/reset-password`
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function updateAccountPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function getAccount(): Promise<Account | null> {
  return accountFromSession();
}

/** Client-side hook: null while loading, then the signed-in account or false. */
export function useAccount() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getAccount().then(a => alive && setAccount(a));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      getAccount().then(a => alive && setAccount(a));
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  return { account, loading: account === undefined };
}

/**
 * Identity verification status for the signed-in borrower.
 * Returns "signed_out" when there is no session, otherwise the profile's
 * kyc_status ("pending" | "approved" | "rejected"). null while loading.
 */
export function useKycStatus() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { if (alive) setStatus("signed_out"); return; }
      const { data } = await supabase.from("profiles").select("kyc_status").eq("id", u.user.id).maybeSingle();
      if (alive) setStatus(data?.kyc_status ?? "pending");

      // Live updates: unlock the wizard the moment an admin approves the documents.
      if (!channel && alive) {
        channel = supabase
          .channel(`kyc-${u.user.id}`)
          .on("postgres_changes",
            { event: "*", schema: "public", table: "profiles", filter: `id=eq.${u.user.id}` },
            (payload) => {
              const next = (payload.new as { kyc_status?: string } | null)?.kyc_status;
              if (alive && next) setStatus(next);
            })
          .on("postgres_changes",
            { event: "*", schema: "public", table: "kyc_documents", filter: `user_id=eq.${u.user.id}` },
            () => { void load(); })
          .subscribe();
      }
    };

    void load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
    });
    // Safety net if the realtime socket drops.
    const timer = setInterval(() => { void load(); }, 10000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return status;
}

