import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCart, summarizeCart } from "@/lib/cart";
import { getStoreSettingsPublic } from "@/lib/catalog";
import { formatLeadTime } from "@/lib/leadtime";
import { formatBRL } from "@/lib/money";
import { updateCartItem } from "@/app/actions/cart";
import { AvailabilityBadge } from "@/components/store/Availability";
import { ProductImage } from "@/components/store/ProductImage";
import { volumeLabel } from "@/components/store/ProductCard";
import { CartQuote } from "@/components/store/CartQuote";
import { IconClock, IconInfo } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const user = await requireUser("/carrinho");
  const [lines, settings, { aviso }] = await Promise.all([getCart(user.id), getStoreSettingsPublic(), searchParams]);
  const sum = summarizeCart(lines);
  const prep = settings?.preparation_business_days ?? 3;

  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-4xl sm:text-5xl">Carrinho</h1>
      {aviso && <p role="alert" className="mb-6 rounded-xl bg-warning-bg px-4 py-3 text-sm">{aviso.slice(0, 200)}</p>}
      {!lines.length ? (
        <div className="card p-10 text-center">
          <p className="font-display text-2xl">Seu carrinho está vazio</p>
          <Link href="/categoria/perfumes" className="btn-primary mt-6">Explorar produtos</Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <section aria-label="Itens do carrinho">
            <ul className="divide-y divide-line border-y border-line">
              {lines.map(({ product: p, quantity }) => {
                const over = quantity > p.max_purchasable;
                return (
                  <li key={p.id} className="flex gap-4 py-5">
                    <Link href={`/produto/${p.slug}`} className="relative block h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-blush-50">
                      <ProductImage path={p.cover_image} alt={p.cover_alt ?? p.name} sizes="96px" />
                    </Link>
                    <div className="flex flex-1 flex-col gap-1">
                      {p.brand_name && <p className="eyebrow">{p.brand_name}</p>}
                      <Link href={`/produto/${p.slug}`} className="font-medium">{p.name}</Link>
                      <p className="text-sm text-ink-muted">{volumeLabel(p)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <AvailabilityBadge state={p.sale_state} />
                        {p.sale_state === "preorder" && (
                          <span className="text-xs text-ink-soft">Postagem em até {formatLeadTime(p.preorder_lead_time_value, p.preorder_lead_time_unit)} após o pagamento</span>
                        )}
                        {p.sale_state === "ready_stock" && <span className="text-xs text-ink-soft">Preparação em até {prep} dias úteis</span>}
                      </div>
                      {(over || p.sale_state === "sold_out") && (
                        <p role="alert" className="text-sm text-danger">
                          {p.sale_state === "sold_out" ? "Este produto ficou indisponível. Remova-o para continuar." : `Disponível no momento: ${p.max_purchasable}. Ajuste a quantidade.`}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <form action={updateCartItem} className="flex items-center gap-2">
                          <input type="hidden" name="productId" value={p.id} />
                          <label htmlFor={`q-${p.id}`} className="sr-only">Quantidade de {p.name}</label>
                          <select id={`q-${p.id}`} name="quantity" defaultValue={quantity} className="field !w-20 !py-2">
                            {Array.from({ length: Math.max(p.max_purchasable, quantity, 1) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <button className="text-sm font-semibold underline underline-offset-4">Atualizar</button>
                        </form>
                        <form action={updateCartItem}>
                          <input type="hidden" name="productId" value={p.id} />
                          <input type="hidden" name="quantity" value="0" />
                          <button className="text-sm text-ink-muted underline underline-offset-4">Remover</button>
                        </form>
                        <p className="font-semibold">{formatBRL(p.effective_price_cents * quantity)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-36 lg:self-start" aria-label="Resumo">
            {sum.hasPreorder && (
              <div role="note" className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-bg p-4 text-sm">
                <IconClock className="mt-0.5 shrink-0 text-warning" />
                <p>
                  {sum.mixed ? (
                    <>Seu carrinho tem itens de <strong>pronta entrega</strong> e <strong>sob encomenda</strong>. Por padrão, o pedido inteiro será enviado em <strong>uma única remessa</strong> quando todos os itens estiverem disponíveis, com postagem em até <strong>{formatLeadTime(Math.max(...sum.preorderLines.map((l) => l.product.preorder_lead_time_value)), sum.preorderLines[0].product.preorder_lead_time_unit)}</strong> após a confirmação do pagamento. O transporte é adicional.</>
                  ) : (
                    <>Item(ns) sob encomenda: pagamento integral antecipado e postagem em até <strong>{formatLeadTime(Math.max(...sum.preorderLines.map((l) => l.product.preorder_lead_time_value)), sum.preorderLines[0].product.preorder_lead_time_unit)}</strong> após a confirmação do pagamento. O transporte é adicional.</>
                  )}
                </p>
              </div>
            )}
            <div className="card space-y-4 p-6">
              <div className="flex justify-between"><span>Subtotal</span><strong>{formatBRL(sum.subtotal)}</strong></div>
              <div>
                <p className="mb-2 font-medium">Frete</p>
                <CartQuote />
              </div>
              <p className="flex gap-2 text-xs text-ink-muted"><IconInfo width={16} height={16} className="shrink-0" /> Preços, estoque, cupom e frete são conferidos novamente no checkout.</p>
              {sum.blocked.length > 0 ? (
                <button className="btn-primary w-full" disabled>Ajuste os itens para continuar</button>
              ) : (
                <Link href="/checkout" className="btn-primary w-full">Continuar para o checkout</Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
