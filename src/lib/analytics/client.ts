"use client";

export type TrackEvent =
  | "page_view" | "view_item" | "search" | "add_to_cart" | "remove_from_cart" | "begin_checkout"
  | "newsletter_signup" | "whatsapp_click" | "instagram_click";

export function readConsent(): { analytics: boolean; marketing: boolean } {
  if (typeof document === "undefined") return { analytics: false, marketing: false };
  const m = document.cookie.match(/(?:^|;\s*)bs_consent=([^;]+)/);
  try {
    const v = m ? JSON.parse(decodeURIComponent(m[1])) : null;
    return { analytics: v?.analytics === true, marketing: v?.marketing === true };
  } catch {
    return { analytics: false, marketing: false };
  }
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const META_EVENT: Partial<Record<TrackEvent, string>> = {
  page_view: "PageView", view_item: "ViewContent", search: "Search", add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout", newsletter_signup: "Lead", whatsapp_click: "Contact",
};

/**
 * Envia evento ao banco próprio (sem dados pessoais) e, com consentimento, ao GA4/Meta Pixel.
 * Nunca envia e-mail, telefone, endereço ou dados de pagamento.
 */
export function track(event: TrackEvent, props: { product_id?: string; value_cents?: number; label?: string; search_term?: string } = {}) {
  const consent = readConsent();
  if (!consent.analytics) return;
  const payload = JSON.stringify({ event, path: location.pathname, ...props });
  try {
    const sent = navigator.sendBeacon?.("/api/events", new Blob([payload], { type: "application/json" }));
    if (!sent) void fetch("/api/events", { method: "POST", body: payload, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    /* silencioso */
  }
  window.gtag?.("event", event, { value: props.value_cents != null ? props.value_cents / 100 : undefined, currency: "BRL", item_id: props.product_id, search_term: props.search_term });
  if (consent.marketing && META_EVENT[event]) {
    const metaName = META_EVENT[event]!;
    const params = { content_ids: props.product_id ? [props.product_id] : undefined, value: props.value_cents != null ? props.value_cents / 100 : undefined, currency: "BRL", search_string: props.search_term };
    if (metaName === "Contact") window.fbq?.("trackCustom", "WhatsAppClick", params);
    else window.fbq?.("track", metaName, params);
  }
}
