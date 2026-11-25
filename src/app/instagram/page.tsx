import type { Metadata } from "next";
import Link from "next/link";
import { getStoreSettingsPublic, hasActivePromotions, listProducts } from "@/lib/catalog";
import { SITE } from "@/lib/site";
import { formatLeadTime } from "@/lib/leadtime";
import { whatsappLink, WHATSAPP_GENERAL_MESSAGE } from "@/lib/whatsapp";
import { Logo } from "@/components/store/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { Price } from "@/components/store/Price";
import { ProductImage } from "@/components/store/ProductImage";
import { TrackedLink } from "@/components/store/TrackedLink";
import { AvailabilityBadge } from "@/components/store/Availability";
import { DemoBanner } from "@/components/store/DemoBanner";
import { IconInstagram, IconWhatsApp } from "@/components/ui/icons";
import type { CatalogProduct } from "@/lib/types";

export const metadata: Metadata = {
  title: "Bia Store Importados — link da bio",
  description: SITE.defaultDescription,
  alternates: { canonical: "/instagram" },
};

const SHORTCUTS = [
  ["Perfumes femininos", "perfumes-femininos"], ["Perfumes masculinos", "perfumes-masculinos"], ["Perfumes infantis", "perfumes-infantis"],
  ["Perfumes árabes", "perfumes-arabes"], ["Decantes 5 ml", "decantes-5-ml"], ["Skincare", "skincare"], ["Cabelos", "cabelos"],
] as const;

/** Mantém as UTMs da bio nos links internos para a atribuição chegar até a compra. */
function withUtm(path: string, sp: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  (["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const).forEach((k) => sp[k] && q.set(k, sp[k]!.slice(0, 100)));
  if (!q.has("utm_source")) {
    q.set("utm_source", "instagram");
    q.set("utm_medium", "bio");
    q.set("utm_campaign", "perfil");
  }
  return `${path}?${q}`;
}

function MiniCard({ p, href }: { p: CatalogProduct; href: string }) {
  return (
    <Link href={href} className="group block w-40 shrink-0 snap-start">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-blush-50"><ProductImage path={p.cover_image} alt={p.cover_alt ?? p.name} sizes="160px" /></div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
      <div className="mt-1 flex flex-col gap-1"><Price price={p.price_cents} promo={p.promo_price_cents} size="sm" /><AvailabilityBadge state={p.sale_state} /></div>
      {p.sale_state === "preorder" && <p className="mt-1 text-[0.7rem] leading-snug text-ink-muted">Pagamento antecipado · postagem em até {formatLeadTime(p.preorder_lead_time_value, p.preorder_lead_time_unit)}</p>}
    </Link>
  );
}

export default async function InstagramLanding({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [settings, novos, destaques, kits, promos] = await Promise.all([
    getStoreSettingsPublic(),
    listProducts({ sort: "newest", pageSize: 8, availability: ["ready_stock", "preorder"] }),
    listProducts({ highlight: "bestseller", pageSize: 8, availability: ["ready_stock", "preorder"] }),
    listProducts({ category: "kits-e-presentes", pageSize: 6, availability: ["ready_stock"] }),
    hasActivePromotions(),
  ]);
  const offers = promos ? await listProducts({ highlight: "promo", pageSize: 6, availability: ["ready_stock", "preorder"] }) : null;

  return (
    <>
      <DemoBanner />
      <main id="conteudo" className="mx-auto min-h-dvh max-w-md bg-ivory px-5 pb-10 pt-8">
        <header className="flex flex-col items-center text-center">
          <Logo logoPath={settings?.logo_path} />
          <p className="mt-4 text-[0.95rem] text-ink-soft">Curadoria de perfumes importados, fragrâncias árabes, decantes de 5 ml e cuidados pessoais.</p>
        </header>

        <div className="mt-7 space-y-3">
          <Link href={withUtm("/", sp)} className="btn-primary w-full !min-h-14 text-base">Comprar na loja</Link>
          <TrackedLink event="whatsapp_click" label="instagram-landing" href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} className="btn-whatsapp w-full !min-h-14 text-base">
            <IconWhatsApp width={20} height={20} /> Fale com a Bia pelo WhatsApp
          </TrackedLink>
          <p className="text-center text-xs text-ink-muted">O WhatsApp abre em outro aplicativo; o atendimento é feito por pessoas.</p>
        </div>

        <nav aria-label="Categorias" className="mt-8">
          <ul className="grid grid-cols-2 gap-2">
            {SHORTCUTS.map(([label, slug], i) => (
              <li key={slug} className={i === SHORTCUTS.length - 1 ? "col-span-2" : ""}>
                <Link href={withUtm(`/categoria/${slug}`, sp)} className="flex min-h-14 items-center justify-center rounded-2xl border border-line bg-porcelain px-3 text-center text-[0.92rem] font-medium hover:border-rose-gold">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {[
          ["Lançamentos", novos.products],
          ["Mais vendidos", destaques.products],
          ...(offers?.products.length ? [["Ofertas ativas", offers.products] as const] : []),
          ["Kits e combos", kits.products],
        ].map(([title, list]) =>
          (list as CatalogProduct[]).length ? (
            <section key={title as string} className="mt-10" aria-label={title as string}>
              <h2 className="mb-3 text-2xl">{title as string}</h2>
              <div className="relative -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
                {(list as CatalogProduct[]).map((p) => <MiniCard key={p.id} p={p} href={withUtm(`/produto/${p.slug}`, sp)} />)}
              </div>
            </section>
          ) : null,
        )}

        <section className="mt-10 rounded-3xl bg-blush-50 p-6" aria-labelledby="ig-news">
          <h2 id="ig-news" className="text-2xl">Novidades e cupons por e-mail</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">Opcional. Só com sua autorização.</p>
          <NewsletterForm source="instagram" tone="blush" />
        </section>

        <TrackedLink event="instagram_click" label="instagram-landing" href={SITE.instagramUrl} className="btn-secondary mt-8 w-full">
          <IconInstagram width={18} height={18} /> Ver Instagram @{SITE.instagramHandle}
        </TrackedLink>

        <footer className="mt-10 text-center text-xs text-ink-muted">
          <nav aria-label="Informações" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/ajuda/entrega-e-frete">Entrega</Link>
            <Link href="/ajuda/produtos-sob-encomenda">Encomendas</Link>
            <Link href="/ajuda/trocas-e-devolucoes">Trocas</Link>
            <Link href="/ajuda/politica-de-privacidade">Privacidade</Link>
            <Link href="/ajuda/termos-de-uso">Termos</Link>
          </nav>
          <p className="mt-4">© {new Date().getFullYear()} {SITE.name}</p>
        </footer>
      </main>
    </>
  );
}
