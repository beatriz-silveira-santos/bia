import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { NewPasswordForm } from "@/components/store/AuthForms";
export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };
export default async function Page() {
  await requireUser("/recuperar-senha");
  return (
    <div className="container-page max-w-lg py-12">
      <h1 className="mb-6 text-4xl">Criar nova senha</h1>
      <div className="card p-6 sm:p-8"><NewPasswordForm /></div>
    </div>
  );
}
