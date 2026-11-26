import type { PackageSpec } from "./types";

export interface ItemDims {
  weight_g: number | null;
  width_cm: number | null;
  height_cm: number | null;
  length_cm: number | null;
  quantity: number;
}

/** Margem para embalagem/proteção (configurável). */
export const PACKING = { extraWeightG: 150, paddingCm: 2, minLength: 16, minWidth: 11, minHeight: 2, maxSumCm: 200, maxSideCm: 100, maxWeightG: 30000 };

/**
 * Consolida itens em um pacote de forma conservadora (não subestima volume):
 * empilha pelo menor lado de cada item, usa a maior largura e o maior comprimento,
 * soma margens de embalagem e respeita os mínimos dos Correios.
 * Retorna null se algum item não tiver peso/dimensões cadastrados.
 */
export function consolidatePackage(items: ItemDims[]): PackageSpec | null {
  if (!items.length) return null;
  let weight = PACKING.extraWeightG;
  let maxA = 0;
  let maxB = 0;
  let stack = 0;
  for (const it of items) {
    if (!it.weight_g || !it.width_cm || !it.height_cm || !it.length_cm) return null;
    const dims = [Number(it.width_cm), Number(it.height_cm), Number(it.length_cm)].sort((a, b) => b - a);
    weight += it.weight_g * it.quantity;
    maxA = Math.max(maxA, dims[0]);
    maxB = Math.max(maxB, dims[1]);
    stack += dims[2] * it.quantity;
  }
  const length = Math.max(PACKING.minLength, Math.ceil(maxA + PACKING.paddingCm));
  const width = Math.max(PACKING.minWidth, Math.ceil(maxB + PACKING.paddingCm));
  const height = Math.max(PACKING.minHeight, Math.ceil(stack + PACKING.paddingCm));
  return { weight_g: Math.ceil(weight), length_cm: length, width_cm: width, height_cm: height };
}

export function exceedsCarrierLimits(p: PackageSpec) {
  return (
    p.weight_g > PACKING.maxWeightG ||
    Math.max(p.length_cm, p.width_cm, p.height_cm) > PACKING.maxSideCm ||
    p.length_cm + p.width_cm + p.height_cm > PACKING.maxSumCm
  );
}

export function normalizeCep(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(d) && d !== "00000000" ? d : null;
}
