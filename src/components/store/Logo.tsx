import Image from "next/image";
import { productImageUrl } from "@/lib/images";

/**
 * Enquanto a proprietária não envia o arquivo original da logomarca, exibimos o nome da
 * marca em texto (não é uma nova logo). Quando `logoPath` estiver configurado no painel,
 * a logo original é usada sem alterações.
 */
export function Logo({ logoPath, className = "" }: { logoPath?: string | null; className?: string }) {
  const src = productImageUrl(logoPath ?? null);
  if (src) {
    return <Image src={src} alt="Bia Store Importados" width={180} height={56} className={`h-10 w-auto ${className}`} priority unoptimized />;
  }
  return (
    <span className={`inline-flex flex-col items-center leading-none ${className}`}>
      <span className="font-display text-[1.7rem] font-medium tracking-tight text-ink">Bia Store</span>
      <span className="mt-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.42em] text-rose-gold-ink">Importados</span>
    </span>
  );
}
