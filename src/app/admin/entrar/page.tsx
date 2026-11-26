import { AdminLoginForm } from "@/components/admin/AdminAuth";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8 shadow-[var(--shadow-soft)]">
        <p className="eyebrow">Acesso restrito</p>
        <h1 className="mb-6 mt-2 text-3xl">Painel administrativo</h1>
        {erro === "sem-permissao" && <p role="alert" className="mb-4 rounded-xl bg-danger-bg p-3 text-sm text-danger">Esta conta não tem permissão de administradora.</p>}
        <AdminLoginForm />
        <p className="mt-6 text-xs text-ink-muted">Área exclusiva da proprietária. Autenticação em duas etapas obrigatória.</p>
      </div>
    </main>
  );
}
