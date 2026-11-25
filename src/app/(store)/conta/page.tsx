import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { MarketingForm, ProfileForm, SupportForm } from "@/components/store/AccountForms";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/conta");
  const supabase = await supabaseServer();
  const { data: profile } = await supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle();
  const { data: sub } = await supabaseAdmin().from("email_subscribers").select("status").eq("email", (user.email ?? "").toLowerCase()).maybeSingle();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card p-6" aria-labelledby="h-dados">
        <h2 id="h-dados" className="mb-1 text-2xl">Meus dados</h2>
        <p className="mb-4 text-sm text-ink-muted">{user.email}</p>
        <ProfileForm name={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
      </section>
      <section className="card p-6" aria-labelledby="h-com">
        <h2 id="h-com" className="mb-4 text-2xl">Comunicação</h2>
        <p className="mb-4 text-sm text-ink-muted">E-mails sobre seus pedidos (confirmação, envio etc.) são sempre enviados. Os promocionais dependem da sua escolha.</p>
        <MarketingForm subscribed={sub?.status === "subscribed"} />
      </section>
      <section className="card p-6" aria-labelledby="h-at">
        <h2 id="h-at" className="mb-4 text-2xl">Atendimento</h2>
        <SupportForm />
      </section>
      <section className="card p-6" aria-labelledby="h-seg">
        <h2 id="h-seg" className="mb-4 text-2xl">Segurança</h2>
        <p className="mb-4 text-sm text-ink-soft">Encerre a sessão em todos os dispositivos se você entrou em um aparelho que não é seu.</p>
        <form action={signOut}><input type="hidden" name="scope" value="global" /><button className="btn-secondary">Sair de todos os dispositivos</button></form>
        <p className="mt-4 text-sm text-ink-soft">Para solicitar cópia ou exclusão dos seus dados, use o atendimento acima. Veja a <Link className="underline" href="/ajuda/politica-de-privacidade">Política de privacidade</Link>.</p>
      </section>
    </div>
  );
}
