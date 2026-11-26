import { adminContext } from "@/lib/admin";
import { PRODUCT_CSV_COLUMNS } from "@/lib/csv";
import { ImportForm } from "@/components/admin/ImportForm";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Importar produtos" };
export default async function ImportPage() {
  const { db } = await adminContext();
  const [{ data: brands }, { data: cats }] = await Promise.all([db.from("brands").select("slug,name").order("name"), db.from("categories").select("slug,name").order("position")]);
  return (
    <div className="space-y-5">
      <h1 className="text-4xl">Importar produtos (CSV)</h1>
      <Panel title="1. Baixe o modelo">
        <p className="text-sm text-ink-soft">Use o <a href="/modelo-importacao-produtos.csv" className="underline" download>modelo de importação</a> (abre no Excel). Produtos novos entram como <strong>rascunho</strong>; com o mesmo SKU, a linha atualiza o produto existente. Depois inclua as fotos e ative cada produto.</p>
        <p className="mt-3 text-xs text-ink-muted">Colunas: {PRODUCT_CSV_COLUMNS.join(", ")}. Classificação: feminino, masculino, infantil, unissex. Modalidade: pronta_entrega, sob_encomenda, indisponivel. Decante: sim/nao. Preço: 129,90.</p>
        <details className="mt-3 text-xs"><summary className="cursor-pointer">Marcas e categorias aceitas</summary><p className="mt-2">Marcas: {(brands ?? []).map((b) => `${b.slug} (${b.name})`).join(", ")}</p><p className="mt-2">Categorias: {(cats ?? []).map((c) => c.slug).join(", ")}</p></details>
      </Panel>
      <Panel title="2. Envie o arquivo"><ImportForm /></Panel>
    </div>
  );
}
