import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: tells the login page whether the first administrator still needs to be created. */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (error) throw new Error(error.message);
  return { needed: (count ?? 0) === 0 };
});

const credentials = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8).max(72) });

/** Public, single-use: creates the first admin only while no admin exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => credentials.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador. Peça um convite.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true };
  });

async function assertAdmin(supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores podem fazer isso.");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: users, error }, { data: roles }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      role: (roles ?? []).find((r) => r.user_id === u.id && r.role === "admin") ? "admin" : (roles ?? []).some((r) => r.user_id === u.id) ? "viewer" : "none",
    }));
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => credentials.extend({ role: z.enum(["admin", "viewer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "viewer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode alterar o seu próprio perfil.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode remover a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
