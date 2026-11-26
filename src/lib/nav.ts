export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Início", href: "/" },
  {
    label: "Perfumes",
    href: "/categoria/perfumes",
    children: [
      { label: "Femininos", href: "/categoria/perfumes-femininos" },
      { label: "Masculinos", href: "/categoria/perfumes-masculinos" },
      { label: "Infantis", href: "/categoria/perfumes-infantis" },
      { label: "Árabes", href: "/categoria/perfumes-arabes" },
      { label: "Decantes 5 ml", href: "/categoria/decantes-5-ml" },
    ],
  },
  { label: "Skincare", href: "/categoria/skincare" },
  { label: "Cabelos", href: "/categoria/cabelos" },
  { label: "Kits e Presentes", href: "/categoria/kits-e-presentes" },
  { label: "Novidades", href: "/novidades" },
  { label: "Marcas", href: "/marcas" },
];

export const OFFERS_NAV: NavItem = { label: "Ofertas", href: "/ofertas" };

export const POLICY_LINKS = [
  { label: "Sobre a Bia Store", href: "/sobre" },
  { label: "Fale conosco", href: "/contato" },
  { label: "Perguntas frequentes", href: "/ajuda/perguntas-frequentes" },
  { label: "Entrega e frete", href: "/ajuda/entrega-e-frete" },
  { label: "Produtos sob encomenda", href: "/ajuda/produtos-sob-encomenda" },
  { label: "Pagamentos", href: "/ajuda/pagamentos" },
  { label: "Trocas e devoluções", href: "/ajuda/trocas-e-devolucoes" },
  { label: "Direito de arrependimento", href: "/ajuda/direito-de-arrependimento" },
  { label: "Termos de uso e compra", href: "/ajuda/termos-de-uso" },
  { label: "Política de privacidade", href: "/ajuda/politica-de-privacidade" },
  { label: "Política de cookies", href: "/ajuda/politica-de-cookies" },
];
