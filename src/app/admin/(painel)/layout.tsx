import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const NAV = [
  ["/admin", "Visão geral"], ["/admin/pedidos", "Pedidos"], ["/admin/encomendas", "Encomendas"], ["/admin/produtos", "Produtos"],
  ["/admin/estoque", "Estoque"], ["/admin/promocoes", "Promoções"], ["/admin/frete", "Entrega local"], ["/admin/avaliacoes", "Avaliações"],
  ["/admin/clientes", "Clientes"], ["/admin/marketing", "Marketing"], ["/admin/conteudo", "Páginas"], ["/admin/configuracoes", "Configurações"],
  ["/admin/lancamento", "Checklist de lançamento"],
] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const { count } = await supabaseAdmin().from("admin_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null);
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-5">
          <Link href="/admin" className="font-display text-2xl">Bia Store <span className="block text-[0.6rem] font-sans font-semibold uppercase tracking-[0.3em] text-rose-gold-ink">Painel</span></Link>
        </div>
        <nav aria-label="Painel" className="px-3 pb-4">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([href, label]) => (
              <li key={href}><Link href={href} className="flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm hover:bg-blush-50">{label}</Link></li>
            ))}
            <li><Link href="/admin/alertas" className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm hover:bg-blush-50">Alertas {count ? <span className="rounded-full bg-danger px-2 text-xs text-white">{count}</span> : null}</Link></li>
          </ul>
        </nav>
        <div className="hidden border-t border-line p-5 text-xs text-ink-muted lg:block">
          <p className="truncate">{user.email}</p>
          <form action={signOut} className="mt-2"><input type="hidden" name="scope" value="global" /><button className="underline">Sair (todas as sessões)</button></form>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 p-5 sm:p-8">{children}</main>
    </div>
  );
}
