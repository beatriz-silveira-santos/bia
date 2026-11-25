import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cancelar inscrição", robots: { index: false } };

async function unsubscribe(form: FormData) {
  "use server";
  const token = String(form.get("token") ?? "");
  if (!/^[a-f0-9]{48}$/.test(token)) return;
  const db = supabaseAdmin();
  const { data } = await db.from("email_subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("unsubscribe_token", token).select("email").maybeSingle();
  if (data) await db.from("email_suppression_list").upsert({ email: data.email, reason: "descadastro pelo link" }, { onConflict: "email" });
  redirect("/descadastro?ok=1");
}

/** Descadastro em um clique (POST) a partir do link dos e-mails promocionais. */
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string; ok?: string }> }) {
  const { t, ok } = await searchParams;
  if (ok) return <div className="container-page max-w-lg py-16 text-center"><h1 className="mb-4 text-4xl">Inscrição cancelada</h1><p className="text-ink-soft">Você não receberá mais e-mails promocionais.</p></div>;
  return (
    <div className="container-page max-w-lg py-16 text-center">
      <h1 className="mb-4 text-4xl">Cancelar inscrição</h1>
      <p className="mb-6 text-ink-soft">Você deixará de receber e-mails promocionais. E-mails sobre pedidos continuam sendo enviados.</p>
      <form action={unsubscribe}><input type="hidden" name="token" value={t ?? ""} /><button className="btn-primary">Confirmar cancelamento</button></form>
    </div>
  );
}
