import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { deleteAddress } from "@/app/actions/account";
import { AddressForm, type AddressRow } from "@/components/store/AddressForm";

export const metadata: Metadata = { title: "Endereços", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/conta/enderecos");
  const { data } = await (await supabaseServer()).from("addresses").select("*").eq("user_id", user.id).order("created_at");
  const list = (data ?? []) as AddressRow[];
  return (
    <div className="space-y-6">
      {list.map((a) => (
        <details key={a.id} className="card p-5">
          <summary className="cursor-pointer"><strong>{a.label ?? a.recipient_name}</strong> — {a.street}, {a.number} · {a.city}/{a.state}</summary>
          <div className="mt-4"><AddressForm initial={a} /></div>
          <form action={deleteAddress} className="mt-3"><input type="hidden" name="id" value={a.id} /><button className="text-sm text-danger underline">Excluir endereço</button></form>
        </details>
      ))}
      <section className="card p-5"><h2 className="mb-4 text-2xl">Novo endereço</h2><AddressForm /></section>
    </div>
  );
}
