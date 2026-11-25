/** Faixa visível fora de produção, para que dados de demonstração nunca sejam confundidos com reais. */
export function DemoBanner() {
  if (process.env.APP_ENV === "production") return null;
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory">
      Ambiente de {process.env.APP_ENV === "preview" ? "homologação" : "desenvolvimento"} — produtos e dados de DEMONSTRAÇÃO
    </div>
  );
}
