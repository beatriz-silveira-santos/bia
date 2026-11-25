"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { productImageUrl } from "@/lib/images";
import { IconClose } from "@/components/ui/icons";
import { ProductImage } from "./ProductImage";

export interface Media { id: string; kind: "image" | "video"; storage_path: string; alt_text: string }

export function Gallery({ media, productName }: { media: Media[]; productName: string }) {
  const [index, setIndex] = useState(0);
  const zoomRef = useRef<HTMLDialogElement>(null);
  if (!media.length) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)]">
        <ProductImage path={null} alt={null} sizes="50vw" />
      </div>
    );
  }
  const current = media[index];
  const src = productImageUrl(current.storage_path)!;
  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {media.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Miniaturas">
          {media.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver ${m.kind === "video" ? "vídeo" : "imagem"} ${i + 1} de ${media.length}`}
                aria-current={i === index}
                className={`relative block h-20 w-16 overflow-hidden rounded-xl ring-1 transition ${i === index ? "ring-2 ring-ink" : "ring-line hover:ring-rose-gold"}`}
              >
                {m.kind === "video" ? (
                  <span className="flex h-full w-full items-center justify-center bg-blush-100 text-xs font-semibold">Vídeo</span>
                ) : (
                  <Image src={productImageUrl(m.storage_path)!} alt="" fill sizes="64px" className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-[var(--radius-card)] bg-blush-50">
        {current.kind === "video" ? (
          <video src={src} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={current.alt_text} />
        ) : (
          <button type="button" className="absolute inset-0 cursor-zoom-in" onClick={() => zoomRef.current?.showModal()} aria-label={`Ampliar imagem: ${current.alt_text}`}>
            <Image src={src} alt={current.alt_text} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </button>
        )}
      </div>
      <dialog ref={zoomRef} className="m-auto max-h-[95dvh] max-w-[95vw] rounded-2xl bg-porcelain p-0 backdrop:bg-ink/70" aria-label={`Imagem ampliada de ${productName}`} onClick={(e) => e.target === zoomRef.current && zoomRef.current?.close()}>
        <button type="button" className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-porcelain/90" onClick={() => zoomRef.current?.close()} aria-label="Fechar">
          <IconClose />
        </button>
        {current.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={current.alt_text} className="max-h-[95dvh] max-w-[95vw] object-contain" />
        )}
      </dialog>
    </div>
  );
}
