import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/conta");
  const links = [
    { href: "/conta", label: "Meus dados" },
    { href: "/conta/pedidos", label: "Pedidos" },
    { href: "/conta/enderecos", label: "Endereços" },
    { href: "/favoritos", label: "Favoritos" },
  ];
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-4xl sm:text-5xl">Minha conta</h1>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Minha conta">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {links.map((l) => <li key={l.href}><Link href={l.href} className="flex min-h-11 items-center whitespace-nowrap rounded-full px-4 hover:bg-blush-100">{l.label}</Link></li>)}
            <li>
              <form action={signOut}><button className="flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-ink-muted hover:bg-blush-100">Sair</button></form>
            </li>
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
