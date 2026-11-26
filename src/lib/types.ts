import type { LeadUnit } from "./leadtime";

export type SaleState = "ready_stock" | "preorder" | "sold_out";
export type Gender = "female" | "male" | "kids" | "unisex" | "not_applicable";

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string;
  category_slug: string;
  category_name: string;
  subcategory_id: string | null;
  subcategory_slug: string | null;
  subcategory_name: string | null;
  gender: Gender;
  price_cents: number;
  promo_price_cents: number | null;
  effective_price_cents: number;
  volume_ml: number | null;
  is_decant: boolean;
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  accords: string[];
  olfactory_family: string | null;
  olfactory_description: string | null;
  product_type: string | null;
  contents: string | null;
  how_to_use: string | null;
  composition: string | null;
  warnings: string | null;
  benefits: string | null;
  sku: string | null;
  highlights: ("new" | "bestseller" | "recommended" | "promo")[];
  is_bundle: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  sale_state: SaleState;
  max_purchasable: number;
  preorder_lead_time_value: number;
  preorder_lead_time_unit: LeadUnit | null;
  cover_image: string | null;
  cover_alt: string | null;
  review_count: number;
  rating_avg: number | null;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_path: string | null;
  seo_title: string | null;
  seo_description: string | null;
  position: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export const GENDER_LABEL: Record<Gender, string> = {
  female: "Feminino",
  male: "Masculino",
  kids: "Infantil",
  unisex: "Unissex",
  not_applicable: "Não se aplica",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  preparing: "Em preparação",
  awaiting_procurement: "Pago — aguardando abastecimento",
  procurement_received: "Encomenda recebida — preparando postagem",
  ready_to_ship: "Pronto para postagem",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  payment_failed: "Pagamento não aprovado",
};
