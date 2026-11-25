import type { Metadata } from "next";
import { ContentPage } from "@/components/store/ContentPage";
import { TrackedLink } from "@/components/store/TrackedLink";
import { whatsappLink, WHATSAPP_GENERAL_MESSAGE } from "@/lib/whatsapp";
import { IconWhatsApp } from "@/components/ui/icons";
export const metadata: Metadata = { title: "Fale conosco", alternates: { canonical: "/contato" } };
export default function Page() {
  return (
    <>
      <ContentPage slug="contato" />
      <div className="container-page max-w-3xl">
        <TrackedLink event="whatsapp_click" label="contato" href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} className="btn-whatsapp"><IconWhatsApp width={18} height={18} /> Falar no WhatsApp</TrackedLink>
      </div>
    </>
  );
}
