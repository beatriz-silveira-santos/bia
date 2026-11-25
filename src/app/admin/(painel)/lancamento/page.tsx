import { adminContext } from "@/lib/admin";
import { env } from "@/lib/env";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Checklist de lançamento" };
export default async function Launch() {
  const { db } = await adminContext();
  const e = env();
  const [{ data: s }, { count: active }, { count: noImg }, { data: pages }, { count: zones }] = await Promise.all([
    db.from("store_settings").select("*").eq("id", 1).single(),
    db.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("products").select("id, product_images!left(id)", { count: "exact", head: true }).eq("status", "active").is("product_images", null),
    db.from("content_pages").select("slug,reviewed_by_owner,body_markdown"),
    db.from("local_delivery_zones").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  const pagesOk = (pages ?? []).every((p) => p.reviewed_by_owner && !p.body_markdown.includes("[PENDENTE"));
  const items: [boolean, string, string][] = [
    [!!s?.logo_path, "Logo original enviada", "Configurações › Logo"],
    [!!s?.hero_image_path, "Foto principal real da home", "Configurações › Foto principal"],
    [!!(s?.legal_name && s?.document_id), "Razão social e CPF/CNPJ", "Configurações › Dados da empresa"],
    [!!s?.contact_email, "E-mail comercial", "Configurações"],
    [!!s?.business_hours, "Horário de atendimento", "Configurações"],
    [!!(s?.address_publication_authorized && s?.public_address_city && s?.public_address_cep), "Endereço confirmado e autorizado (cidade, UF, CEP)", "Configurações"],
    [(active ?? 0) >= 15, `Pelo menos 15 produtos ativos com preço, estoque, peso e dimensões (${active ?? 0} ativos)`, "Produtos"],
    [(noImg ?? 0) === 0, "Todos os produtos ativos com foto real", "Produtos"],
    [!!s?.preorder_default_lead_time_unit, "Unidade dos 20 dias de encomenda confirmada (corridos ou úteis)", "Configurações › Prazos"],
    [!!e.INFINITEPAY_HANDLE, "InfiniteTag (handle) configurada como segredo", "docs/infinitepay.md"],
    [!!e.INFINITEPAY_API_KEY, "API Key da InfinitePay (para repassar juros e link de uso único)", "docs/infinitepay.md"],
    [e.SHIPPING_PROVIDER !== "none", "Provedor de frete configurado (Correios com contrato ou agregador)", "docs/frete.md"],
    [(zones ?? 0) > 0 || true, "Entrega local: CEPs cobertos e preços revisados (opcional)", "Entrega local"],
    [e.EMAIL_PROVIDER !== "none", "Provedor de e-mail e domínio autenticado (SPF/DKIM/DMARC)", "docs/email.md"],
    [pagesOk, "Políticas e páginas revisadas, sem [PENDENTE]", "Páginas"],
    [!!e.CRON_SECRET, "Tarefa agendada (expiração de reservas) configurada", "docs/cloudflare.md"],
    [e.APP_ENV === "production", "Ambiente de produção (domínio e DNS autorizados)", "docs/dominio-dns.md"],
  ];
  const done = items.filter(([ok]) => ok).length;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Checklist de lançamento</h1>
      <p className="text-sm text-ink-muted">{done} de {items.length} itens concluídos. Libere as compras (Configurações › Liberação de vendas) somente com os itens críticos resolvidos e após um teste real de baixo valor autorizado por você.</p>
      <Panel title="Itens">
        <ul className="space-y-2">{items.map(([ok, label, where]) => <li key={label} className="flex items-start gap-3 text-sm"><span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-success text-white" : "border border-line-strong"}`}>{ok ? "✓" : ""}</span><span><span className="sr-only">{ok ? "Concluído: " : "Pendente: "}</span>{label} <span className="text-ink-muted">— {where}</span></span></li>)}</ul>
      </Panel>
    </div>
  );
}
