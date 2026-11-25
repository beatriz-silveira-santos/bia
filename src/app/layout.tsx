import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/manrope";
import "./globals.css";
import { SITE } from "@/lib/site";
import { CookieBanner } from "@/components/store/CookieBanner";
import { ThirdPartyScripts } from "@/components/store/ThirdPartyScripts";
import { PageViewTracker } from "@/components/store/PageViewTracker";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://biastoreimportados.com.br"),
  title: { default: `${SITE.name} — Perfumes importados, árabes, decantes e skincare`, template: `%s | ${SITE.name}` },
  description: SITE.defaultDescription,
  openGraph: { type: "website", locale: "pt_BR", siteName: SITE.name, description: SITE.defaultDescription },
  alternates: { canonical: "/" },
  robots: process.env.APP_ENV === "production" ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf7f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <CookieBanner />
        <PageViewTracker />
        <ThirdPartyScripts ga4Id={process.env.NEXT_PUBLIC_GA4_ID} pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
      </body>
    </html>
  );
}
