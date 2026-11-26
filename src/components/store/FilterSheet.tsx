"use client";
import { useRef } from "react";
import { IconClose, IconSliders } from "@/components/ui/icons";

/** Celular: botão fixo "Filtrar e ordenar" que abre um painel de baixo para cima. */
export function FilterSheet({ active, total, children }: { active: boolean; total: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="lg:hidden">
      <div className="sticky top-16 z-20 -mx-5 bg-ivory/95 px-5 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => ref.current?.showModal()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong bg-porcelain text-[0.95rem] font-semibold text-ink active:scale-[0.98]"
        >
          <IconSliders width={20} height={20} /> Filtrar e ordenar
          {active && <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-ivory">ativos</span>}
        </button>
      </div>
      <dialog
        ref={ref}
        aria-label="Filtrar e ordenar"
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-[1.75rem] bg-ivory p-0 backdrop:bg-ink/50 open:animate-[sheet_.25s_ease-out]"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />
          <p className="font-display text-2xl">Filtrar e ordenar</p>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush-100">
            <IconClose />
          </button>
        </div>
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <p className="mb-4 text-sm text-ink-muted">{total === 1 ? "1 produto" : `${total} produtos`} nesta lista</p>
          {children}
        </div>
      </dialog>
    </div>
  );
}
