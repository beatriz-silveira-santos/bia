"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { addToCart, type CartActionState } from "@/app/actions/cart";
import { track } from "@/lib/analytics/client";
import type { SaleState } from "@/lib/types";

export function AddToCart({ productId, saleState, max, priceCents, path }: { productId: string; saleState: SaleState; max: number; priceCents: number; path: string }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(addToCart, null);
  const [qty, setQty] = useState(1);
  useEffect(() => {
    if (state?.ok) track("add_to_cart", { product_id: productId, value_cents: priceCents * qty });
  }, [state, productId, priceCents, qty]);

  if (saleState === "sold_out" || max < 1) {
    return (
      <button type="button" disabled className="btn-primary w-full" aria-describedby="sold-out-msg">
        Indisponível no momento
      </button>
    );
  }
  const label = saleState === "preorder" ? "Encomendar" : "Adicionar ao carrinho";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="returnTo" value={path} />
      <div className="flex gap-3">
        <div className="flex items-center rounded-full border border-line-strong">
          <button type="button" className="h-12 w-11 text-xl" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade" disabled={qty <= 1}>−</button>
          <label htmlFor="qty" className="sr-only">Quantidade</label>
          <input id="qty" name="quantity" type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Math.min(max, Math.max(1, Number(e.target.value) || 1)))} className="w-10 bg-transparent text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <button type="button" className="h-12 w-11 text-xl" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Aumentar quantidade" disabled={qty >= max}>+</button>
        </div>
        <button type="submit" className="btn-primary flex-1" disabled={pending}>{pending ? "Adicionando…" : label}</button>
      </div>
      {max <= 5 && <p className="text-xs text-ink-muted">Máximo de {max} {max === 1 ? "unidade" : "unidades"} por pedido no momento.</p>}
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
          {state.message} {state.ok && <Link href="/carrinho" className="font-semibold underline underline-offset-4">Ver carrinho</Link>}
        </p>
      )}
    </form>
  );
}
