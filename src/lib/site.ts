/** Dados públicos confirmados da marca (dados pendentes ficam em store_settings, editáveis no painel). */
export const SITE = {
  name: "Bia Store Importados",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  canonicalHost: "biastoreimportados.com.br",
  instagramHandle: "biastore_importados",
  instagramUrl: "https://www.instagram.com/biastore_importados/",
  whatsappE164: "5517992066575",
  whatsappDisplay: "+55 17 99206-6575",
  defaultDescription:
    "Curadoria de perfumes importados e árabes, decantes de 5 ml, skincare e cuidados capilares, com atendimento próximo.",
} as const;

export const PREORDER_DEFAULT_COPY =
  "Produto sob encomenda. O pagamento é realizado integralmente no pedido e a postagem ocorrerá em até {prazo} após a confirmação do pagamento. O prazo de transporte começa após a postagem e é adicional.";
