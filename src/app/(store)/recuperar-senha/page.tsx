import type { Metadata } from "next";
import { ResetForm } from "@/components/store/AuthForms";
export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };
export default function Page() {
  return (
    <div className="container-page max-w-lg py-12">
      <h1 className="mb-6 text-4xl">Recuperar senha</h1>
      <div className="card p-6 sm:p-8"><ResetForm /></div>
    </div>
  );
}
