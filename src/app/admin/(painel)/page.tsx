/* eslint-disable react-hooks/purity -- Server Component renderizado por requisição */
import Link from "next/link";
import { adminContext, resolvePeriod } from "@/lib/admin";
import { formatBRL } from "@/lib/money";
import { formatDateSP } from "@/lib/leadtime";
import { DemoTag, Panel, PeriodFilter, Stat, Table } from "@/components/admin/ui";

export const metadata = { title: "Visão geral" };

const CHANNEL_LABEL: Record<string, string> = {
  instagram_bio: "Instagram (bio)", instagram_stories: "Instagram (Stories)", instagram_post: "Instagram (publicações)", instagram: "Instagram",
  meta_ads: "Meta Ads", facebook: "Facebook", google: "Google (orgânico)", google_ads: "Google Ads", whatsapp: "WhatsApp", email: "E-mail", direto: "Direto / não identificado", referencia: "Outros sites",
};
const ch = (c: string | null) => (c ? CHANNEL_LABEL[c] ?? c.replace(/^utm:/, "UTM: ") : "Não identificado");

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db } = await adminContext();
  const period = resolvePeriod(sp.periodo, sp.de, sp.ate);
  const from = period.from.toISOString(), to = period.to.toISOString();

  const [paidRes, cancelRes, eventsRes, profilesRes, allPaidRes, itemsRes, lowStockRes, allocRes, subsRes, unsubRes, cartsRes, alertsRes] = await Promise.all([
    db.from("orders").select("id,user_id,total_cents,has_preorder,attribution,paid_at").gte("paid_at", from).lt("paid_at", to),
    db.from("orders").select("id,status,total_cents").gte("cancelled_at", from).lt("cancelled_at", to),
    db.from("analytics_events").select("event_name,visitor_id,path,channel,product_id,props").gte("created_at", from).lt("created_at", to).limit(50000),
    db.from("profiles").select("id,created_at"),
    db.from("orders").select("user_id").not("paid_at", "is", null),
    db.from("order_items").select("product_id,product_name,quantity,line_total_cents,fulfillment,orders!inner(paid_at)").gte("orders.paid_at", from).lt("orders.paid_at", to),
    db.from("products").select("id,name,stock_on_hand,stock_reserved,preorder_committed,status").neq("status", "archived").order("stock_on_hand"),
    db.from("preorder_allocations").select("id,status,dispatch_due_at,quantity,quantity_received"),
    db.from("email_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
    db.from("email_subscribers").select("id", { count: "exact", head: true }).gte("unsubscribed_at", from).lt("unsubscribed_at", to),
    db.from("carts").select("id,updated_at,cart_items(quantity)"),
    db.from("admin_alerts").select("id,kind,created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(5),
  ]);

  const paid = (paidRes.data ?? []).filter(Boolean);
  const gross = paid.reduce((s, o) => s + o.total_cents, 0);
  const preorderPaid = paid.filter((o) => o.has_preorder);
  const cancelled = (cancelRes.data ?? []).filter((o) => o.status === "cancelled");
  const refunded = (cancelRes.data ?? []).filter((o) => o.status === "refunded");
  const events = eventsRes.data ?? [];
  const pv = events.filter((e) => e.event_name === "page_view");
  const visitors = new Set(pv.map((e) => e.visitor_id).filter(Boolean)).size;
  const count = (n: string) => events.filter((e) => e.event_name === n).length;
  const profiles = profilesRes.data ?? [];
  const newCustomers = profiles.filter((p) => p.created_at >= from && p.created_at < to).length;
  const buyerCounts = new Map<string, number>();
  (allPaidRes.data ?? []).forEach((o) => buyerCounts.set(o.user_id, (buyerCounts.get(o.user_id) ?? 0) + 1));
  const recurring = [...buyerCounts.values()].filter((n) => n >= 2).length;

  const byChannel = new Map<string, number>();
  pv.forEach((e) => byChannel.set(e.channel ?? "direto", (byChannel.get(e.channel ?? "direto") ?? 0) + 1));
  const revenueByChannel = new Map<string, { n: number; v: number }>();
  paid.forEach((o) => {
    const c = (o.attribution as { last_channel?: string } | null)?.last_channel ?? "direto";
    const r = revenueByChannel.get(c) ?? { n: 0, v: 0 };
    revenueByChannel.set(c, { n: r.n + 1, v: r.v + o.total_cents });
  });
  const pages = new Map<string, number>();
  pv.forEach((e) => pages.set(e.path ?? "/", (pages.get(e.path ?? "/") ?? 0) + 1));
  const wa = new Map<string, number>();
  events.filter((e) => e.event_name === "whatsapp_click").forEach((e) => wa.set(e.path ?? "/", (wa.get(e.path ?? "/") ?? 0) + 1));

  const prod = new Map<string, { name: string; q: number; v: number }>();
  (itemsRes.data ?? []).forEach((i) => {
    const k = i.product_id ?? i.product_name;
    const r = prod.get(k) ?? { name: i.product_name, q: 0, v: 0 };
    prod.set(k, { name: i.product_name, q: r.q + i.quantity, v: r.v + i.line_total_cents });
  });
  const views = new Map<string, number>();
  events.filter((e) => e.event_name === "view_item" && e.product_id).forEach((e) => views.set(e.product_id!, (views.get(e.product_id!) ?? 0) + 1));
  const products = lowStockRes.data ?? [];
  const noSales = products.filter((p) => p.status === "active" && !prod.has(p.id));
  const low = products.filter((p) => p.status === "active" && p.stock_on_hand - p.stock_reserved <= 2);
  const allocs = allocRes.data ?? [];
  const openAllocs = allocs.filter((a) => !["shipped", "cancelled", "refunded"].includes(a.status));
  const overdue = openAllocs.filter((a) => new Date(a.dispatch_due_at) < new Date());
  const soon = openAllocs.filter((a) => { const t = new Date(a.dispatch_due_at).getTime(); return t >= Date.now() && t < Date.now() + 3 * 86400_000; });
  const carts = (cartsRes.data ?? []).filter((c) => (c.cart_items as { quantity: number }[]).length > 0);
  const abandoned = carts.filter((c) => Date.now() - new Date(c.updated_at).getTime() > 24 * 3600_000);

  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><h1 className="text-4xl">Visão geral</h1><DemoTag /></div>
        <a href={`/admin/exportar/pedidos?periodo=${period.key}${sp.de ? `&de=${sp.de}&ate=${sp.ate}` : ""}`} className="btn-secondary !min-h-10 text-sm">Exportar pedidos (CSV)</a>
      </header>
      <PeriodFilter base="/admin" current={period.key} />
      <p className="text-sm text-ink-muted">{period.label}: {formatDateSP(period.from)} a {formatDateSP(new Date(period.to.getTime() - 1))} (horário de Brasília)</p>

      {(alertsRes.data ?? []).length > 0 && (
        <Link href="/admin/alertas" className="block rounded-2xl border border-danger/40 bg-danger-bg p-4 text-sm text-danger">Há alertas que precisam de atenção (pagamentos em análise, prazos de encomenda etc.). Ver alertas →</Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faturamento bruto confirmado" value={formatBRL(gross)} hint={`${paid.length} pedidos pagos`} />
        <Stat label="Valor líquido" value="—" hint="Taxas da InfinitePay não são informadas pela API; consulte o extrato da InfinitePay." />
        <Stat label="Ticket médio" value={paid.length ? formatBRL(Math.round(gross / paid.length)) : "—"} />
        <Stat label="Cancelados / reembolsados" value={`${cancelled.length} / ${refunded.length}`} />
        <Stat label="Encomendas pagas" value={formatBRL(preorderPaid.reduce((s, o) => s + o.total_cents, 0))} hint={`${preorderPaid.length} pedidos com item sob encomenda (separados da pronta entrega)`} />
        <Stat label="Encomendas em atraso" value={String(overdue.length)} hint={`${soon.length} vencem em até 3 dias`} tone={overdue.length ? "danger" : soon.length ? "warn" : undefined} />
        <Stat label="Clientes" value={String(profiles.length)} hint={`${newCustomers} novas no período · ${recurring} recorrentes`} />
        <Stat label="Taxa de conversão (estimada)" value={pct(paid.length, visitors)} hint="Pedidos pagos ÷ visitantes com consentimento de medição" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Funil (somente visitantes com consentimento)">
          <Table head={["Etapa", "Eventos"]} rows={[["Visitas (páginas vistas)", pv.length], ["Visitantes", visitors], ["Visualizações de produto", count("view_item")], ["Adicionar ao carrinho", count("add_to_cart")], ["Início do checkout", count("begin_checkout")], ["Compras aprovadas", paid.length]].map(([a, b]) => [a, String(b)])} />
        </Panel>
        <Panel title="Aquisição — origem das visitas">
          <Table head={["Origem", "Visitas", "Pedidos pagos", "Receita atribuída*"]} rows={[...new Set([...byChannel.keys(), ...revenueByChannel.keys()])].sort((a, b) => (byChannel.get(b) ?? 0) - (byChannel.get(a) ?? 0)).map((c) => [ch(c), String(byChannel.get(c) ?? 0), String(revenueByChannel.get(c)?.n ?? 0), formatBRL(revenueByChannel.get(c)?.v ?? 0)])} />
          <p className="mt-3 text-xs text-ink-muted">*Último toque identificado. Bloqueio de cookies, troca de aparelho e apps externos impedem a identificação perfeita.</p>
        </Panel>
        <Panel title="Produtos mais vendidos">
          <Table head={["Produto", "Qtd.", "Receita", "Conversão*"]} rows={[...prod.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 10).map(([id, p]) => [p.name, String(p.q), formatBRL(p.v), views.get(id) ? pct(p.q, views.get(id)!) : "—"])} />
          <p className="mt-3 text-xs text-ink-muted">*Unidades vendidas ÷ visualizações do produto (estimado).</p>
        </Panel>
        <Panel title="Páginas mais vistas">
          <Table head={["Página", "Visitas"]} rows={[...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, n]) => [p, String(n)])} />
        </Panel>
        <Panel title="Cliques no WhatsApp">
          <Table head={["Página de origem", "Cliques"]} rows={[...wa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, n]) => [p, String(n)])} />
        </Panel>
        <Panel title="Estoque" action={<Link href="/admin/estoque" className="text-sm underline">Gerenciar</Link>}>
          <Table head={["Produto", "Físico", "Reservado", "Encomendado"]} rows={low.slice(0, 10).map((p) => [p.name, String(p.stock_on_hand), String(p.stock_reserved), String(p.preorder_committed)])} empty="Nenhum produto com estoque baixo." />
          <p className="mt-3 text-xs text-ink-muted">{noSales.length} produtos ativos sem venda no período.</p>
        </Panel>
        <Panel title="Carrinhos">
          <Table head={["Situação", "Quantidade"]} rows={[["Com itens", String(carts.length)], ["Sem atividade há mais de 24h (abandonados)", String(abandoned.length)]]} />
        </Panel>
        <Panel title="Marketing">
          <Table head={["Indicador", "Valor"]} rows={[["Inscritas ativas", String(subsRes.count ?? 0)], ["Descadastros no período", String(unsubRes.count ?? 0)], ["Inscrições no período (eventos)", String(count("newsletter_signup"))]]} />
        </Panel>
      </div>
    </div>
  );
}
