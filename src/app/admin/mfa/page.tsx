import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { MfaPanel } from "@/components/admin/AdminAuth";

export default async function MfaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/entrar");
  const { data: isAdmin } = await (await supabaseServer()).rpc("has_admin_role");
  if (!isAdmin) redirect("/admin/entrar?erro=sem-permissao");
  if (user.aal === "aal2") redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 shadow-[var(--shadow-soft)]">
        <p className="eyebrow">Etapa 2 de 2</p>
        <h1 className="mb-6 mt-2 text-3xl">Verificação em duas etapas</h1>
        <MfaPanel />
      </div>
    </main>
  );
}
