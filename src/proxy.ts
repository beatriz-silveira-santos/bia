import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase, aplica domínio canônico e captura atribuição (UTM/referrer)
 * em cookie de primeira parte. A autorização real é verificada no servidor e no banco.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // Domínio canônico: www -> raiz (somente em produção)
  if (process.env.APP_ENV === "production" && request.headers.get("host")?.startsWith("www.")) {
    const target = new URL(url.toString());
    target.host = target.host.replace(/^www\./, "");
    target.port = "";
    return NextResponse.redirect(target, 308);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Áreas que exigem login (a checagem definitiva ocorre nas páginas/ações do servidor)
  const needsAuth = ["/conta", "/checkout", "/favoritos", "/carrinho"].some((p) => url.pathname.startsWith(p));
  if (needsAuth && !claims) {
    const login = new URL("/entrar", request.url);
    login.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(login);
  }
  if (url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/entrar") && !claims) {
    return NextResponse.redirect(new URL("/admin/entrar", request.url));
  }

  // Atribuição: first-touch (não sobrescreve) e last-touch (só quando há origem identificável)
  // Somente com consentimento de analytics (cookie "bs_consent" gravado pelo banner de cookies)
  const consent = parseConsent(request.cookies.get("bs_consent")?.value);
  if (consent.analytics && request.method === "GET" && !url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api")) {
    const utm = Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
        .map((k) => [k, url.searchParams.get(k)?.slice(0, 100)])
        .filter(([, v]) => v),
    );
    const ref = request.headers.get("referer");
    let refHost: string | null = null;
    try {
      refHost = ref ? new URL(ref).hostname : null;
    } catch {
      refHost = null;
    }
    const external = refHost && refHost !== url.hostname && !refHost.endsWith("biastoreimportados.com.br");
    if (Object.keys(utm).length > 0 || external) {
      const touch = JSON.stringify({ ...utm, ref: external ? refHost : undefined, path: url.pathname, at: Date.now() });
      const opts = { httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 90 };
      if (!request.cookies.get("bs_ft")) response.cookies.set("bs_ft", touch, opts);
      response.cookies.set("bs_lt", touch, opts);
    }
    if (!request.cookies.get("bs_vid")) {
      response.cookies.set("bs_vid", crypto.randomUUID(), {
        httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 395,
      });
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|woff2?)$).*)"],
};

function parseConsent(raw: string | undefined): { analytics: boolean; marketing: boolean } {
  try {
    const v = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    return { analytics: v?.analytics === true, marketing: v?.marketing === true };
  } catch {
    return { analytics: false, marketing: false };
  }
}
