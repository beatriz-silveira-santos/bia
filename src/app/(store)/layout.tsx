import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { DemoBanner } from "@/components/store/DemoBanner";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <Header />
      <main id="conteudo">{children}</main>
      <Footer />
    </>
  );
}
