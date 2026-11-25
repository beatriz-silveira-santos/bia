import type { Metadata } from "next";
import { SignInForm, SignUpForm } from "@/components/store/AuthForms";

export const metadata: Metadata = { title: "Entrar ou criar conta", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next: rawNext, erro } = await searchParams;
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/conta";
  return (
    <div className="container-page py-10 sm:py-16">
      <h1 className="mb-2 text-4xl sm:text-5xl">Sua conta</h1>
      <p className="mb-10 text-ink-soft">Para comprar, é preciso entrar ou criar uma conta. Navegar pela loja continua livre.</p>
      {erro === "link-invalido" && <p role="alert" className="mb-6 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">O link é inválido ou expirou. Tente novamente.</p>}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-6 sm:p-8" aria-labelledby="t-entrar"><h2 id="t-entrar" className="mb-6 text-2xl">Já tenho conta</h2><SignInForm next={next} /></section>
        <section className="card p-6 sm:p-8" aria-labelledby="t-criar"><h2 id="t-criar" className="mb-6 text-2xl">Criar conta</h2><SignUpForm next={next} /></section>
      </div>
    </div>
  );
}
