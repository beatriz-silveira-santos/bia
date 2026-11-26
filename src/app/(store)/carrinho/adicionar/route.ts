import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { addForUser } from "@/app/actions/cart";
import { getSessionUser } from "@/lib/auth";

/** Conclui o "adicionar ao carrinho" iniciado antes do login. */
export async function GET(req: NextRequest) {
  const p = z.string().uuid().safeParse(req.nextUrl.searchParams.get("p"));
  const q = z.coerce.number().int().min(1).max(20).safeParse(req.nextUrl.searchParams.get("q") ?? 1);
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  if (p.success && q.success) {
    const res = await addForUser(user.id, p.data, q.data);
    if (res && !res.ok) return NextResponse.redirect(new URL(`/carrinho?aviso=${encodeURIComponent(res.message)}`, req.url));
  }
  return NextResponse.redirect(new URL("/carrinho", req.url));
}
