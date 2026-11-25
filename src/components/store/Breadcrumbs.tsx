import Link from "next/link";
import { SITE } from "@/lib/site";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const all = [{ label: "Início", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.label, item: it.href ? `${SITE.url}${it.href}` : undefined })),
  };
  return (
    <nav aria-label="Trilha de navegação" className="text-[0.8rem] text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-line-strong">/</span>}
            {it.href && i < all.length - 1 ? (
              <Link href={it.href} className="hover:text-ink">{it.label}</Link>
            ) : (
              <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-ink-soft">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </nav>
  );
}
