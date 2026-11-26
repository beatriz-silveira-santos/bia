/** Faixa visível fora de produção, para que dados de demonstração nunca sejam confundidos com reais. */
export function DemoBanner() {
  if (process.env.APP_ENV === "production") return null;
  const preview = process.env.APP_ENV === "preview";
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ivory">
      {preview ? "Versão de teste · fotos, preços e estoque provisórios · compras desativadas" : "Ambiente de desenvolvimento — produtos e dados de DEMONSTRAÇÃO"}
    </div>
  );
}
