import Link from "next/link";
import { getStoreSettingsPublic } from "@/lib/catalog";
import { POLICY_LINKS } from "@/lib/nav";
import { SITE } from "@/lib/site";
import { whatsappLink, WHATSAPP_GENERAL_MESSAGE } from "@/lib/whatsapp";
import { IconInstagram, IconWhatsApp } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { TrackedLink } from "./TrackedLink";
import { CookiePreferencesButton } from "./CookieBanner";

export async function Footer() {
  const s = await getStoreSettingsPublic();
  const methods = [s?.payment_pix_enabled && "Pix", s?.payment_credit_card_enabled && `Cartão de crédito${s.max_installments > 1 ? ` (até ${s.max_installments}x)` : ""}`].filter(Boolean);
  const showAddress = s?.address_publication_authorized && s.public_address_line;
  return (
    <footer className="mt-24 border-t border-line bg-blush-50/60">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo logoPath={s?.logo_path} className="!items-start" />
          <p className="max-w-sm text-ink-soft">Curadoria de perfumes importados e árabes, decantes de 5 ml, skincare e cuidados capilares.</p>
          <div className="flex flex-wrap gap-2">
            <TrackedLink event="whatsapp_click" label="footer" href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} className="btn-whatsapp !min-h-11 !px-4 text-sm">
              <IconWhatsApp width={18} height={18} /> {SITE.whatsappDisplay}
            </TrackedLink>
            <TrackedLink event="instagram_click" label="footer" href={SITE.instagramUrl} className="btn-secondary !min-h-11 !px-4 text-sm">
              <IconInstagram width={18} height={18} /> @{SITE.instagramHandle}
            </TrackedLink>
          </div>
          <p className="text-xs text-ink-muted">O WhatsApp abre em um aplicativo externo. O atendimento é feito por pessoas, sem respostas automáticas.</p>
        </div>
        <div>
          <h2 className="eyebrow mb-4 !font-sans">Atendimento</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            {s?.contact_email && <li><a href={`mailto:${s.contact_email}`} className="hover:text-ink">{s.contact_email}</a></li>}
            {s?.business_hours && <li>{s.business_hours}</li>}
            {showAddress && (
              <li>
                {s!.public_address_line}
                {s!.public_address_city && <> — {s!.public_address_city}/{s!.public_address_state}</>}
                {s!.public_address_cep && <> · CEP {s!.public_address_cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}</>}
              </li>
            )}
            {s?.legal_name && <li>{s.legal_name}{s.document_id ? ` · ${s.document_id}` : ""}</li>}
            {methods.length > 0 && <li className="pt-2"><span className="font-medium text-ink">Pagamento:</span> {methods.join(" e ")} via InfinitePay</li>}
          </ul>
        </div>
        <nav aria-label="Políticas e ajuda">
          <h2 className="eyebrow mb-4 !font-sans">Informações</h2>
          <ul className="grid gap-2 text-sm text-ink-soft">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>
            ))}
            <li><CookiePreferencesButton /></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-6 text-xs text-ink-muted">© {new Date().getFullYear()} {SITE.name}. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
