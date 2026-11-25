import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/conta", "/checkout", "/carrinho", "/favoritos", "/pedido", "/api", "/entrar", "/busca"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
