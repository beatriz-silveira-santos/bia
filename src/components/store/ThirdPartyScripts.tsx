"use client";
import Script from "next/script";
import { parseConsentRaw, useConsentRaw } from "@/lib/analytics/consent-store";

/** GA4 e Meta Pixel só carregam após consentimento (medição / marketing). */
export function ThirdPartyScripts({ ga4Id, pixelId }: { ga4Id?: string; pixelId?: string }) {
  const consent = parseConsentRaw(useConsentRaw());
  return (
    <>
      {ga4Id && consent.analytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(ga4Id)},{anonymize_ip:true});`}</Script>
        </>
      )}
      {pixelId && consent.marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`}</Script>
      )}
    </>
  );
}
