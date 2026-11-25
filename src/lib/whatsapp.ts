import { SITE } from "./site";

export const WHATSAPP_GENERAL_MESSAGE =
  "Olá! Conheci a Bia Store Importados pelo Instagram e gostaria de informações sobre os produtos.";

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${SITE.whatsappE164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function whatsappProductLink(productName: string, url?: string): string {
  const msg = `Olá! Tenho interesse no produto "${productName}" da Bia Store Importados${url ? ` (${url})` : ""}. Pode me ajudar?`;
  return whatsappLink(msg);
}
