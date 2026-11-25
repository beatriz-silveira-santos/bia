import { adminContext } from "@/lib/admin";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Novo produto" };
export default async function NewProduct() {
  const { db } = await adminContext();
  const [{ data: brands }, { data: categories }] = await Promise.all([db.from("brands").select("id,name").order("name"), db.from("categories").select("id,name,parent_id").order("position")]);
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Novo produto</h1>
      <p className="text-sm text-ink-muted">Salve primeiro como rascunho; depois inclua fotos reais, estoque e ative.</p>
      <ProductForm product={null} brands={brands ?? []} categories={categories ?? []} />
    </div>
  );
}
