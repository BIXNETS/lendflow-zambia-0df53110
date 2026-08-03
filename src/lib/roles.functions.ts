import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "borrower";

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  roles: AppRole[];
  createdAt: string | null;
  lastSignInAt: string | null;
};

/** Throws unless the caller holds the admin role (checked as the user, via RLS-safe RPC). */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    return { userId: context.userId, roles, isAdmin: roles.includes("admin") };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: TeamMember[]; adminCount: number }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usersRes }, { data: roleRows }, { data: profiles }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("profiles").select("id, first_name, last_name"),
    ]);

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    }
    const nameById = new Map<string, string>();
    for (const p of (profiles ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      nameById.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ").trim());
    }

    const members: TeamMember[] = (usersRes?.users ?? []).map((u) => ({
      userId: u.id,
      email: u.email ?? "",
      name: nameById.get(u.id) || (u.email ?? "").split("@")[0] || "Unknown",
      roles: rolesByUser.get(u.id) ?? [],
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));

    members.sort((a, b) => Number(b.roles.includes("admin")) - Number(a.roles.includes("admin")) || a.email.localeCompare(b.email));
    const adminCount = members.filter((m) => m.roles.includes("admin")).length;
    return { members, adminCount };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "borrower"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.grant && data.role === "admin") {
      if (data.userId === context.userId) throw new Error("You cannot remove your own admin role.");
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("At least one admin must remain.");
    }

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const grantAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = (usersRes?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!match) throw new Error("No account found with that email. Ask them to sign up first.");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: match.id, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true as const, userId: match.id };
  });
