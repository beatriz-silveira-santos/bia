import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { DemoBanner } from "@/components/store/DemoBanner";
import { MobileTabBar } from "@/components/store/MobileTabBar";
import { getSessionUser } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const count = await getCartCount(user?.id ?? null);
  return (
    <>
      <DemoBanner />
      <Header />
      <main id="conteudo">{children}</main>
      <Footer />
      {/* espaço para a barra inferior no celular */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" />
      <MobileTabBar cartCount={count} />
    </>
  );
}
