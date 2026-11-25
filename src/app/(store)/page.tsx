import Link from "next/link";
import Image from "next/image";
import { getStoreSettingsPublic, listProducts } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { SITE } from "@/lib/site";
import { Shelf } from "@/components/store/Shelf";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { TrackedLink } from "@/components/store/TrackedLink";
import { IconInstagram } from "@/components/ui/icons";


const SHORTCUTS = [
  { label: "Feminino", href: "/categoria/perfumes-femininos", tone: "from-blush-100 to-blush-200" },
  { label: "Masculino", href: "/categoria/perfumes-masculinos", tone: "from-champagne-soft to-champagne" },
  { label: "Infantil", href: "/categoria/perfumes-infantis", tone: "from-blush-50 to-blush-100" },
  { label: "Skincare", href: "/categoria/skincare", tone: "from-porcelain to-blush-100" },
  { label: "Cabelos", href: "/categoria/cabelos", tone: "from-champagne-soft to-blush-100" },
  { label: "Decantes 5 ml", href: "/categoria/decantes-5-ml", tone: "from-blush-100 to-champagne" },
];

export default async function HomePage() {
  const [settings, arabes, skincare, cabelos, kits, novidades] = await Promise.all([
    getStoreSettingsPublic(),
    listProducts({ category: "perfumes-arabes", pageSize: 8 }),
    listProducts({ category: "skincare", pageSize: 8 }),
    listProducts({ category: "cabelos", pageSize: 8 }),
    listProducts({ category: "kits-e-presentes", pageSize: 8 }),
    listProducts({ sort: "newest", pageSize: 8 }),
  ]);
  const hero = productImageUrl(settings?.hero_image_path ?? null);

  return (
    <>
      {/* 1. Destaque principal */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
          <div className="order-2 lg:order-1">
            <p className="eyebrow mb-5">Perfumes importados · Árabes · Skincare</p>
            <h1 className="text-[length:var(--text-display)] leading-[var(--text-display--line-height)] text-ink">
              Fragrâncias e cuidados <em className="font-normal italic text-rose-gold-ink">escolhidos</em> com carinho.
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-soft">
              Perfumes importados e árabes, decantes de 5 ml para conhecer antes do frasco, skincare e cuidados capilares.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/categoria/perfumes" className="btn-primary">Explorar produtos</Link>
              <Link href="/categoria/decantes-5-ml" className="btn-secondary">Conhecer os decantes</Link>
            </div>
          </div>
          <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush-100 via-blush-50 to-champagne-soft sm:aspect-[5/4] lg:order-2 lg:aspect-[4/5]">
            {hero ? (
              <Image src={hero} alt={settings?.hero_image_alt ?? "Produtos da Bia Store Importados"} fill priority sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10 text-center" role="img" aria-label="Espaço reservado para a fotografia principal da loja">
                <span className="block h-px w-16 bg-rose-gold-light" />
                <span className="font-display text-3xl italic text-ink-soft">Bia Store</span>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-muted">Fotografia real dos produtos em breve</span>
                <span className="block h-px w-16 bg-rose-gold-light" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-rose-gold-light/60" aria-hidden />
          </div>
        </div>
      </section>

      {/* 2. Atalhos */}
      <nav aria-label="Atalhos por categoria" className="container-page">
        <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
          {SHORTCUTS.map((s) => (
            <li key={s.href} className="shrink-0">
              <Link href={s.href} className={`group flex h-28 w-36 flex-col justify-between rounded-2xl bg-gradient-to-br ${s.tone} p-4 ring-1 ring-line transition hover:ring-rose-gold sm:w-auto`}>
                <span className="block h-px w-6 bg-rose-gold" aria-hidden />
                <span className="font-display text-xl leading-tight text-ink">{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 3–7. Vitrines */}
      <Shelf eyebrow="Oriente" title="Perfumes árabes" href="/categoria/perfumes-arabes" products={arabes.products} listName="home-arabes" />
      <Shelf eyebrow="Pele" title="Skincare" href="/categoria/skincare" products={skincare.products} listName="home-skincare" />
      <Shelf eyebrow="Fios" title="Cuidados capilares" href="/categoria/cabelos" products={cabelos.products} listName="home-cabelos" />
      <Shelf eyebrow="Para presentear" title="Kits e combos" href="/categoria/kits-e-presentes" products={kits.products} listName="home-kits" />
      <Shelf eyebrow="Acabaram de chegar" title="Novidades" href="/novidades" products={novidades.products} listName="home-novidades" />

      {/* 8. Sobre */}
      <section className="container-page py-14" aria-labelledby="sobre-titulo">
        <div className="grid gap-8 rounded-[2rem] bg-blush-50 p-8 sm:p-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="eyebrow mb-3">Sobre nós</p>
            <h2 id="sobre-titulo" className="text-4xl">Bia Store Importados</h2>
          </div>
          <div className="space-y-4 text-lg text-ink-soft">
            <p>{settings?.about_text ?? "Uma curadoria de perfumes importados e árabes, decantes de 5 ml, skincare e cuidados capilares, com atendimento próximo pelo WhatsApp e pelo Instagram."}</p>
            <Link href="/sobre" className="inline-block text-base font-semibold text-ink underline decoration-rose-gold underline-offset-[6px]">Conheça a loja</Link>
          </div>
        </div>
      </section>

      {/* 9. Instagram e e-mail */}
      <section className="container-page pb-6" aria-labelledby="novidades-titulo">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="card flex flex-col justify-between gap-6 p-8 sm:p-10">
            <div>
              <p className="eyebrow mb-3">Instagram</p>
              <h2 className="text-3xl">Acompanhe @{SITE.instagramHandle}</h2>
              <p className="mt-3 text-ink-soft">Lançamentos, dicas de uso e bastidores da curadoria.</p>
            </div>
            <TrackedLink event="instagram_click" label="home" href={SITE.instagramUrl} className="btn-secondary self-start">
              <IconInstagram width={18} height={18} /> Ver Instagram
            </TrackedLink>
          </div>
          <div className="card p-8 sm:p-10">
            <p className="eyebrow mb-3">E-mail</p>
            <h2 id="novidades-titulo" className="text-3xl">Receba novidades e cupons</h2>
            <p className="mb-5 mt-3 text-ink-soft">Somente com sua autorização. Cancele quando quiser.</p>
            <NewsletterForm source="home" />
          </div>
        </div>
      </section>
    </>
  );
}
