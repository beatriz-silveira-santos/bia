"use client";
import { useSyncExternalStore } from "react";

/** Lê o cookie de consentimento como fonte externa (sem setState em efeitos). */
function subscribe(cb: () => void) {
  window.addEventListener("bs-consent", cb);
  return () => window.removeEventListener("bs-consent", cb);
}
const snapshot = () => document.cookie.match(/(?:^|;\s*)bs_consent=([^;]+)/)?.[1] ?? "";

export function useConsentRaw(): string | null {
  // null no servidor/hidratação; string ("" = sem escolha) no cliente
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function parseConsentRaw(raw: string | null) {
  try {
    const v = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    return { analytics: v?.analytics === true, marketing: v?.marketing === true };
  } catch {
    return { analytics: false, marketing: false };
  }
}
