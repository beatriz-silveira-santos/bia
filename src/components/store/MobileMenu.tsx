"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevron, IconClose, IconMenu } from "@/components/ui/icons";
import type { NavItem } from "@/lib/nav";

export function MobileMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // O menu fecha sozinho ao navegar: fica aberto apenas para a rota em que foi aberto
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full lg:hidden" aria-label="Abrir menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconMenu />
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-[88vw] max-w-sm bg-ivory p-0 text-ink backdrop:bg-ink/30 open:animate-[slidein_.25s_ease-out]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="eyebrow">Menu</span>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <IconClose />
          </button>
        </div>
        <nav aria-label="Menu principal" className="px-5 py-3">
          <ul>
            {items.map((item) => (
              <li key={item.href} className="border-b border-line/70">
                {item.children ? (
                  <details className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-lg">
                      {item.label}
                      <IconChevron className="transition group-open:rotate-90" />
                    </summary>
                    <ul className="pb-3 pl-3">
                      <li><Link href={item.href} className="flex min-h-11 items-center text-ink-soft">Ver todos os perfumes</Link></li>
                      {item.children.map((c) => (
                        <li key={c.href}><Link href={c.href} className="flex min-h-11 items-center text-ink-soft">{c.label}</Link></li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link href={item.href} className="flex min-h-14 items-center text-lg">{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-1 text-ink-soft">
            <li><Link href="/conta" className="flex min-h-11 items-center">Minha conta</Link></li>
            <li><Link href="/favoritos" className="flex min-h-11 items-center">Favoritos</Link></li>
            <li><Link href="/carrinho" className="flex min-h-11 items-center">Carrinho</Link></li>
          </ul>
        </nav>
      </dialog>
    </>
  );
}
