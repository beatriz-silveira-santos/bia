import Image from "next/image";
import { productImageUrl } from "@/lib/images";

/** Imagem de produto; sem foto, mostra placeholder neutro (nunca inventa frasco/embalagem). */
export function ProductImage({
  path, alt, sizes, priority = false, className = "",
}: { path: string | null; alt: string | null; sizes: string; priority?: boolean; className?: string }) {
  const src = productImageUrl(path);
  if (!src) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-b from-blush-50 to-champagne-soft ${className}`} role="img" aria-label="Imagem do produto em breve">
        <span className="flex flex-col items-center gap-2 text-center text-ink-muted">
          <span className="block h-px w-10 bg-rose-gold-light" />
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.25em]">Imagem em breve</span>
          <span className="block h-px w-10 bg-rose-gold-light" />
        </span>
      </div>
    );
  }
  return (
    <Image src={src} alt={alt ?? ""} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} unoptimized={src.startsWith("/")} />
  );
}
