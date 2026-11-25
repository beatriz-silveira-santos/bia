import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";
import { getStoreSettingsPublic, hasActivePromotions } from "@/lib/catalog";
import { OFFERS_NAV, PRIMARY_NAV } from "@/lib/nav";
import { IconBag, IconHeart, IconSearch, IconUser } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";

export async function Header() {
  const [user, promos, settings] = await Promise.all([getSessionUser(), hasActivePromotions(), getStoreSettingsPublic()]);
  const count = await getCartCount(user?.id ?? null);
  const items = promos ? [...PRIMARY_NAV.slice(0, 6), OFFERS_NAV, ...PRIMARY_NAV.slice(6)] : PRIMARY_NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/92 backdrop-blur supports-[backdrop-filter]:bg-ivory/80">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Pular para o conteúdo
      </a>
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center lg:h-20">
        <div className="flex items-center gap-1">
          <MobileMenu items={items} />
          <Link href="/busca" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush-100 lg:hidden" aria-label="Buscar produtos">
            <IconSearch />
          </Link>
          <form action="/busca" role="search" className="hidden lg:block">
            <label htmlFor="q-header" className="sr-only">Buscar produtos</label>
            <div className="flex items-center gap-2 rounded-full border border-line-strong bg-porcelain px-4 py-2 focus-within:border-ink">
              <IconSearch width={18} height={18} className="text-ink-muted" />
              <input id="q-header" name="q" type="search" placeholder="Buscar perfume, marca, skincare…" className="w-56 bg-transparent text-sm outline-none placeholder:text-ink-muted" />
            </div>
          </form>
        </div>
        <Link href="/" aria-label="Bia Store Importados — página inicial" className="justify-self-center">
          <Logo logoPath={settings?.logo_path} />
        </Link>
        <div className="flex items-center justify-end gap-0.5">
          <Link href="/conta" className="hidden h-11 w-11 items-center justify-center rounded-full hover:bg-blush-100 sm:inline-flex" aria-label={user ? "Minha conta" : "Entrar ou criar conta"}>
            <IconUser />
          </Link>
          <Link href="/favoritos" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush-100" aria-label="Favoritos">
            <IconHeart />
          </Link>
          <Link href="/carrinho" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush-100" aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
            <IconBag />
            {count > 0 && (
              <span aria-hidden className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.68rem] font-bold text-ivory">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
      <nav aria-label="Categorias" className="hidden border-t border-line/70 lg:block">
        <ul className="container-page flex items-center justify-center gap-8 text-[0.86rem] font-medium tracking-wide">
          {items.map((item) => (
            <li key={item.href} className="group relative">
              <Link href={item.href} className="flex h-12 items-center text-ink-soft transition hover:text-ink">
                {item.label}
              </Link>
              {item.children && (
                <div className="invisible absolute left-1/2 top-full z-50 w-60 -translate-x-1/2 pt-1 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="card p-2 shadow-[var(--shadow-lift)]">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} className="flex min-h-10 items-center rounded-lg px-3 text-ink-soft hover:bg-blush-50 hover:text-ink">{c.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
