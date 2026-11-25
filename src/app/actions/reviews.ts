"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export type ReviewState = { ok: boolean; message: string } | null;

export async function submitReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const parsed = z.object({ productId: z.string().uuid(), orderId: z.string().uuid(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional() })
    .safeParse({ productId: form.get("productId"), orderId: form.get("orderId"), rating: form.get("rating"), comment: form.get("comment") || undefined });
  if (!parsed.success) return { ok: false, message: "Escolha uma nota de 1 a 5." };
  const { error } = await (await supabaseServer()).rpc("submit_review", { p_product_id: parsed.data.productId, p_order_id: parsed.data.orderId, p_rating: parsed.data.rating, p_comment: parsed.data.comment ?? null });
  if (error) return { ok: false, message: error.message.includes("duplicate") ? "Você já avaliou este produto neste pedido." : "Avaliação disponível somente após a entrega do pedido." };
  revalidatePath("/conta/pedidos");
  return { ok: true, message: "Obrigada! Sua avaliação será publicada após moderação." };
}
