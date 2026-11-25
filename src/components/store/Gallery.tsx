"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { productImageUrl } from "@/lib/images";
import { IconClose } from "@/components/ui/icons";
import { ProductImage } from "./ProductImage";

export interface Media { id: string; kind: "image" | "video"; storage_path: string; alt_text: string }

/** Galeria: no celular, deslize para o lado (com indicadores); no desktop, miniaturas. Toque para ampliar. */
export function Gallery({ media, productName }: { media: Media[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  if (!media.length) {
    return (
      <div className="relative -mx-5 aspect-square overflow-hidden bg-white sm:mx-0 sm:aspect-[4/5] sm:rounded-[var(--radius-card)]">
        <ProductImage path={null} alt={null} sizes="50vw" />
      </div>
    );
  }
  const current = media[index];
  const go = (i: number) => {
    setIndex(i);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };
  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {media.length > 1 && (
        <ul className="hidden gap-2 lg:flex lg:flex-col" aria-label="Miniaturas">
          {media.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver ${m.kind === "video" ? "vídeo" : "imagem"} ${i + 1} de ${media.length}`}
                aria-current={i === index}
                className={`relative block h-20 w-16 overflow-hidden rounded-xl bg-white ring-1 transition ${i === index ? "ring-2 ring-ink" : "ring-line hover:ring-rose-gold"}`}
              >
                {m.kind === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-blush-100 text-xs font-semibold">Vídeo</span>
                ) : (
                  <Image src={productImageUrl(m.storage_path)!} alt="" fill sizes="64px" className="object-contain p-1" unoptimized />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative -mx-5 flex-1 sm:mx-0">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-white [scrollbar-width:none] sm:aspect-[4/5] sm:rounded-[var(--radius-card)] sm:ring-1 sm:ring-line/60 [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carrossel"
          aria-label={`Imagens de ${productName}`}
        >
          {media.map((m, i) => {
            const src = productImageUrl(m.storage_path)!;
            return (
              <div key={m.id} className="relative h-full w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} de ${media.length}`}>
                {m.kind === "video" ? (
                  <video src={src} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={m.alt_text} />
                ) : (
                  <button type="button" className="absolute inset-0 cursor-zoom-in" onClick={() => { setIndex(i); zoomRef.current?.showModal(); }} aria-label={`Ampliar imagem: ${m.alt_text}`}>
                    <Image src={src} alt={m.alt_text} fill priority={i === 0} sizes="(min-width:1024px) 50vw, 100vw" className="object-contain p-[6%] mix-blend-multiply" unoptimized />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {media.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
            {media.map((m, i) => (
              <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/25"}`} />
            ))}
          </div>
        )}
      </div>
      <dialog ref={zoomRef} className="m-auto max-h-[95dvh] max-w-[95vw] rounded-2xl bg-white p-0 backdrop:bg-ink/70" aria-label={`Imagem ampliada de ${productName}`} onClick={(e) => e.target === zoomRef.current && zoomRef.current?.close()}>
        <button type="button" className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-porcelain/90" onClick={() => zoomRef.current?.close()} aria-label="Fechar">
          <IconClose />
        </button>
        {current.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={productImageUrl(current.storage_path)!} alt={current.alt_text} className="max-h-[95dvh] max-w-[95vw] object-contain" />
        )}
      </dialog>
    </div>
  );
}
