import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, getStoreSettingsPublic } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { formatDateSP } from "@/lib/leadtime";
import { SITE } from "@/lib/site";
import { GENDER_LABEL } from "@/lib/types";
import { whatsappProductLink } from "@/lib/whatsapp";
import { getSessionUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { toggleFavorite } from "@/app/actions/cart";
import { AvailabilityBadge, PreorderNotice } from "@/components/store/Availability";
import { AddToCart } from "@/components/store/AddToCart";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Gallery, type Media } from "@/components/store/Gallery";
import { Price } from "@/components/store/Price";
import { ProductGrid, volumeLabel } from "@/components/store/ProductCard";
import { TrackedLink, TrackView } from "@/components/store/TrackedLink";
import { IconHeart, IconTruck, IconWhatsApp } from "@/components/ui/icons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return {};
  const p = data.product;
  const title = p.seo_title ?? [p.name, p.brand_name, volumeLabel(p)].filter(Boolean).join(" · ");
  const description = p.seo_description ?? p.description?.slice(0, 155) ?? `${p.name} na Bia Store Importados.`;
  const img = productImageUrl(p.cover_image);
  return {
    title,
    description,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { title, description, type: "website", images: img ? [{ url: img, alt: p.cover_alt ?? p.name }] : undefined },
  };
}

function Notes({ label, notes }: { label: string; notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-gold-ink">{label}</dt>
      <dd className="mt-1 text-ink-soft">{notes.join(", ")}</dd>
    </div>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product: p, media, bundle, reviews } = data;
  const [related, settings, user] = await Promise.all([getRelatedProducts(p), getStoreSettingsPublic(), getSessionUser()]);
  let isFavorite = false;
  if (user) {
    const { data: fav } = await (await supabaseServer()).from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", p.id).maybeSingle();
    isFavorite = !!fav;
  }
  const vol = volumeLabel(p);
  const url = `${SITE.url}/produto/${p.slug}`;
  const prep = settings?.preparation_business_days ?? 3;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku ?? undefined,
    brand: p.brand_name ? { "@type": "Brand", name: p.brand_name } : undefined,
    description: p.description ?? undefined,
    image: media.filter((m) => m.kind === "image").map((m) => productImageUrl(m.storage_path)),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: (p.effective_price_cents / 100).toFixed(2),
      availability: p.sale_state === "ready_stock" ? "https://schema.org/InStock" : p.sale_state === "preorder" ? "https://schema.org/PreOrder" : "https://schema.org/OutOfStock",
    },
    // Nota agregada somente com avaliações reais aprovadas
    aggregateRating: p.review_count > 0 ? { "@type": "AggregateRating", ratingValue: p.rating_avg, reviewCount: p.review_count } : undefined,
  };

  const details: [string, string | null][] = [
    ["Conteúdo", p.contents],
    ["Modo de uso", p.how_to_use],
    ["Benefícios (conforme fabricante)", p.benefits],
    ["Composição", p.composition],
    ["Advertências", p.warnings],
  ];

  return (
    <div className="container-page py-6 sm:py-10">
      <TrackView event="view_item" productId={p.id} valueCents={p.effective_price_cents} />
      <Breadcrumbs
        items={[
          { label: p.category_name, href: `/categoria/${p.category_slug}` },
          ...(p.subcategory_slug ? [{ label: p.subcategory_name!, href: `/categoria/${p.subcategory_slug}` }] : []),
          { label: p.name },
        ]}
      />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <Gallery media={media as Media[]} productName={p.name} />
        <div className="lg:sticky lg:top-36 lg:self-start">
          {p.brand_name && <p className="eyebrow mb-3">{p.brand_name}</p>}
          <h1 className="text-4xl leading-tight sm:text-5xl">{p.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-muted">
            {vol && <span className={p.is_decant ? "rounded-full bg-ink px-3 py-1 text-sm font-semibold text-ivory" : ""}>{vol}</span>}
            {p.gender !== "not_applicable" && <span>{GENDER_LABEL[p.gender]}</span>}
            <AvailabilityBadge state={p.sale_state} size="md" />
          </p>
          <div className="mt-6"><Price price={p.price_cents} promo={p.promo_price_cents} size="lg" /></div>
          {settings && (settings.payment_pix_enabled || settings.payment_credit_card_enabled) && (
            <p className="mt-1 text-sm text-ink-muted">
              {[settings.payment_pix_enabled && "Pix", settings.payment_credit_card_enabled && `cartão de crédito em até ${settings.max_installments}x (juros do parcelamento informados no pagamento)`].filter(Boolean).join(" ou ")}
            </p>
          )}

          {p.is_decant && (
            <div className="mt-6 rounded-2xl border border-line bg-blush-50 p-4 text-sm text-ink-soft">
              <strong className="text-ink">Decante 5 ml:</strong> você recebe 5 ml da fragrância, fracionados do frasco original em um frasco menor. As imagens identificadas como “frasco original” mostram a embalagem de origem, não o frasco de 5 ml enviado.
            </div>
          )}

          <div className="mt-6 space-y-4">
            {p.sale_state === "preorder" && <PreorderNotice value={p.preorder_lead_time_value} unit={p.preorder_lead_time_unit} />}
            <AddToCart productId={p.id} saleState={p.sale_state} max={p.max_purchasable} priceCents={p.effective_price_cents} path={`/produto/${p.slug}`} />
            {p.sale_state === "sold_out" && <p id="sold-out-msg" className="text-sm text-ink-muted">Este produto está esgotado. Fale com a gente pelo WhatsApp para saber sobre reposição.</p>}
            <div className="flex gap-2">
              <form action={toggleFavorite} className="flex-1">
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="returnTo" value={`/produto/${p.slug}`} />
                <button type="submit" className="btn-secondary w-full" aria-pressed={isFavorite}>
                  <IconHeart width={18} height={18} fill={isFavorite ? "currentColor" : "none"} /> {isFavorite ? "Nos favoritos" : "Favoritar"}
                </button>
              </form>
              <TrackedLink event="whatsapp_click" label="produto" productId={p.id} href={whatsappProductLink(p.name, url)} className="btn-whatsapp flex-1" aria-label="Tirar dúvidas pelo WhatsApp (abre o aplicativo)">
                <IconWhatsApp width={18} height={18} /> Dúvidas
              </TrackedLink>
            </div>
          </div>

          <div className="mt-6 flex gap-3 rounded-2xl border border-line p-4 text-sm text-ink-soft">
            <IconTruck className="shrink-0 text-rose-gold" />
            <p>
              {p.sale_state === "preorder"
                ? "Frete calculado no carrinho pelo CEP. O prazo de transporte é estimado e começa após a postagem."
                : `Preparação em até ${prep} dias úteis após a confirmação do pagamento. O prazo de transporte é estimado e calculado no carrinho pelo CEP, adicional à preparação.`}
            </p>
          </div>

          {p.description && (
            <section className="mt-8" aria-labelledby="desc">
              <h2 id="desc" className="mb-2 text-2xl">Descrição</h2>
              <p className="whitespace-pre-line text-ink-soft">{p.description}</p>
            </section>
          )}

          {(p.top_notes.length > 0 || p.heart_notes.length > 0 || p.base_notes.length > 0 || p.accords.length > 0 || p.olfactory_family) && (
            <section className="mt-8" aria-labelledby="olfativo">
              <h2 id="olfativo" className="mb-3 text-2xl">Perfil olfativo</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {p.olfactory_family && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-gold-ink">Família olfativa</dt>
                    <dd className="mt-1 text-ink-soft">{p.olfactory_family}</dd>
                  </div>
                )}
                <Notes label="Acordes principais" notes={p.accords} />
                <Notes label="Notas de saída" notes={p.top_notes} />
                <Notes label="Notas de coração" notes={p.heart_notes} />
                <Notes label="Notas de fundo" notes={p.base_notes} />
              </dl>
              {p.olfactory_description && <p className="mt-4 text-ink-soft">{p.olfactory_description}</p>}
            </section>
          )}

          {bundle.length > 0 && (
            <section className="mt-8" aria-labelledby="kit">
              <h2 id="kit" className="mb-3 text-2xl">O que vem no kit</h2>
              <ul className="space-y-2 text-ink-soft">
                {(bundle as unknown as { quantity: number; component: { slug: string; name: string; brand_name: string | null } }[]).map((b) => (
                  <li key={b.component.slug}>{b.quantity}× <a href={`/produto/${b.component.slug}`} className="underline underline-offset-4">{b.component.name}</a>{b.component.brand_name ? ` — ${b.component.brand_name}` : ""}</li>
                ))}
              </ul>
            </section>
          )}

          {details.some(([, v]) => v) && (
            <section className="mt-8 divide-y divide-line border-y border-line" aria-label="Informações do produto">
              {details.filter(([, v]) => v).map(([label, value]) => (
                <details key={label} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-medium">
                    {label}<span aria-hidden className="text-xl text-rose-gold transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="whitespace-pre-line pb-4 text-ink-soft">{value}</p>
                </details>
              ))}
            </section>
          )}
        </div>
      </div>

      <section className="mt-20" aria-labelledby="avaliacoes">
        <h2 id="avaliacoes" className="mb-6 text-3xl">Avaliações</h2>
        {reviews.length === 0 ? (
          <p className="card p-6 text-ink-soft">Seja a primeira pessoa a avaliar este produto. Avaliações são liberadas para clientes após a entrega do pedido.</p>
        ) : (
          <>
            <p className="mb-6 text-ink-soft"><strong className="text-ink">{p.rating_avg?.toLocaleString("pt-BR")}</strong> de 5 · {p.review_count} {p.review_count === 1 ? "avaliação" : "avaliações"} de clientes</p>
            <ul className="grid gap-4 md:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="card p-6">
                  <p aria-label={`Nota ${r.rating} de 5`} className="text-rose-gold-ink">{"★".repeat(r.rating)}<span className="text-line-strong">{"★".repeat(5 - r.rating)}</span></p>
                  {r.comment && <p className="mt-2 text-ink-soft">{r.comment}</p>}
                  <p className="mt-3 text-xs text-ink-muted">{r.author_display_name} · {formatDateSP(r.created_at)}{r.verified_purchase && " · Compra verificada"}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="relacionados">
          <h2 id="relacionados" className="mb-6 text-3xl">Você também pode gostar</h2>
          <ProductGrid products={related} listName="relacionados" />
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
