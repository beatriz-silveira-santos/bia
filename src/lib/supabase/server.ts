import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Cliente com a sessão da usuária (cookies). Respeita RLS. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const e = env();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de Server Component: o proxy.ts cuida da renovação da sessão.
        }
      },
    },
  });
}

/** Cliente público sem sessão (catálogo). Respeita RLS como "anon". */
export function supabasePublic(): SupabaseClient {
  const e = env();
  return createPlainClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente com chave secreta (ignora RLS). Usar SOMENTE no servidor, depois de
 * validar a identidade/permissão da chamada. Nunca importar em componente cliente.
 */
export function supabaseAdmin(): SupabaseClient {
  const e = env();
  if (!e.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY não configurada");
  return createPlainClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
