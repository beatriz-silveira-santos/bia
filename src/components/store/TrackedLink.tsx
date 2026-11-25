"use client";
import { useEffect, type AnchorHTMLAttributes, type ReactNode } from "react";
import { track, type TrackEvent } from "@/lib/analytics/client";

/** Link externo (WhatsApp/Instagram) com evento de clique, sem dados pessoais. */
export function TrackedLink({
  event, label, productId, children, ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { event: TrackEvent; label?: string; productId?: string; children: ReactNode }) {
  return (
    <a
      {...rest}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        track(event, { label, product_id: productId });
        rest.onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}

export function TrackView({ event, productId, valueCents, searchTerm }: { event: TrackEvent; productId?: string; valueCents?: number; searchTerm?: string }) {
  useEffect(() => {
    track(event, { product_id: productId, value_cents: valueCents, search_term: searchTerm });
  }, [event, productId, valueCents, searchTerm]);
  return null;
}
