import type { Metadata } from "next";
export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Bia Store" }, robots: { index: false, follow: false } };
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f6f2ef]">{children}</div>;
}
