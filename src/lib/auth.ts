import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  aal: "aal1" | "aal2";
}

/** Usuária autenticada (JWT validado via getClaims). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return { id: c.sub, email: (c.email as string) ?? null, aal: (c.aal as "aal1" | "aal2") ?? "aal1" };
}

export async function requireUser(next: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return u;
}

/**
 * Exige administradora com MFA verificado (aal2). A checagem é feita no banco (função is_admin),
 * que lê o papel em user_roles e o nível de autenticação do JWT.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const supabase = await supabaseServer();
  const u = await getSessionUser();
  if (!u) redirect("/admin/entrar");
  const { data: hasRole } = await supabase.rpc("has_admin_role");
  if (!hasRole) redirect("/admin/entrar?erro=sem-permissao");
  if (u.aal !== "aal2") redirect("/admin/mfa");
  const { data: ok } = await supabase.rpc("is_admin");
  if (!ok) redirect("/admin/mfa");
  return u;
}
