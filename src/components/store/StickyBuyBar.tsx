"use client";
import { useEffect, useState } from "react";

/** Celular: quando o botão principal sai da tela, mostra preço + botão fixos acima da barra inferior. */
export function StickyBuyBar({ priceLabel, label }: { priceLabel: string; label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById("add-to-cart");
    if (!target) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line/80 bg-ivory/95 px-4 py-3 backdrop-blur transition-transform duration-300 lg:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-[200%]"}`}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <p className="text-lg font-semibold tabular-nums text-ink">{priceLabel}</p>
        <button type="submit" form="add-to-cart" tabIndex={show ? 0 : -1} className="btn-primary flex-1 !min-h-12">{label}</button>
      </div>
    </div>
  );
}
