import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor. Segredos NUNCA usam o prefixo NEXT_PUBLIC_.
 * Em Cloudflare Workers, cadastre-as com `wrangler secret put NOME`.
 */
const schema = z.object({
  APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10).optional(),
  INFINITEPAY_HANDLE: z.string().optional(),
  INFINITEPAY_API_KEY: z.string().optional(),
  SHIPPING_PROVIDER: z.enum(["none", "correios", "melhorenvio"]).default("none"),
  CORREIOS_USER: z.string().optional(),
  CORREIOS_ACCESS_CODE: z.string().optional(),
  CORREIOS_CONTRACT: z.string().optional(),
  CORREIOS_POSTCARD: z.string().optional(),
  CORREIOS_SERVICES: z.string().default("03220,03298"),
  MELHORENVIO_TOKEN: z.string().optional(),
  MELHORENVIO_SANDBOX: z.enum(["true", "false"]).default("true"),
  MELHORENVIO_USER_AGENT: z.string().default("Bia Store Importados (contato pendente)"),
  EMAIL_PROVIDER: z.enum(["none", "brevo"]).default("none"),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("Bia Store Importados"),
  CRON_SECRET: z.string().min(24).optional(),
  META_CAPI_TOKEN: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Não expõe valores, só nomes das variáveis faltantes
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuração ausente ou inválida: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().APP_ENV === "production";
