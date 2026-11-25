"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBag, IconGrid, IconHeart, IconHome, IconSearch } from "@/components/ui/icons";

const HIDE_ON = ["/checkout", "/entrar", "/cadastro", "/recuperar-senha", "/nova-senha"];

/** Barra de navegação inferior (celular): alcance fácil com o polegar. */
export function MobileTabBar({ cartCount }: { cartCount: number }) {
  const path = usePathname();
  if (HIDE_ON.some((p) => path.startsWith(p))) return null;
  const items = [
    { href: "/", label: "Início", icon: IconHome, active: path === "/" },
    { href: "/categorias", label: "Categorias", icon: IconGrid, active: path.startsWith("/categoria") || path.startsWith("/marcas") },
    { href: "/busca", label: "Buscar", icon: IconSearch, active: path.startsWith("/busca") },
    { href: "/favoritos", label: "Favoritos", icon: IconHeart, active: path.startsWith("/favoritos") },
    { href: "/carrinho", label: "Sacola", icon: IconBag, active: path.startsWith("/carrinho"), badge: cartCount },
  ];
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${badge} ${badge === 1 ? "item" : "itens"}` : undefined}
              className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition active:scale-95 ${active ? "text-ink" : "text-ink-muted"}`}
            >
              <span className="relative">
                <Icon width={24} height={24} strokeWidth={active ? 2 : 1.5} />
                {!!badge && (
                  <span aria-hidden className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-gold-ink px-1 text-[0.65rem] font-bold text-ivory">
                    {badge}
                  </span>
                )}
              </span>
              {label}
              {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
