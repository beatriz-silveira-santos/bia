-- =====================================================================
-- SEED LOCAL DE DEMONSTRAÇÃO — roda só em `supabase db reset` local.
-- NÃO é aplicado em produção. Nomes marcados [DEMO]; preços/estoques fictícios
-- apenas para visualizar as telas. Sem marcas reais associadas a produtos fictícios.
-- =====================================================================
update public.store_settings set
  checkout_enabled = true,
  preorder_default_lead_time_unit = 'calendar_days'   -- só para testes locais; a proprietária precisa confirmar
where id = 1;

insert into public.local_delivery_zones (name, cep_ranges, fee_cents, lead_time_text, active)
values ('[DEMO] Zona local de teste', '[{"from":"15000000","to":"15099999"}]', 1500, '1 dia útil após a preparação', true);

with c as (select slug, id from public.categories)
insert into public.products (slug, name, category_id, subcategory_id, gender, price_cents, promo_price_cents, volume_ml, is_decant,
  description, olfactory_family, accords, top_notes, heart_notes, base_notes, status, fulfillment_mode, preorder_max_quantity,
  stock_on_hand, weight_g, width_cm, height_cm, length_cm, highlights, sku, published_at, product_type)
values
 ('demo-floral-feminino', '[DEMO] Perfume floral feminino', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-femininos'), 'female', 32990, null, 100, false,
  'Produto de demonstração para visualizar a página. Não está à venda.', 'Floral', '{floral,frutado}', '{pera}', '{jasmim}', '{almíscar}', 'active', 'ready_stock', null, 4, 450, 12, 16, 8, '{new}', 'DEMO-001', now(), null),
 ('demo-amadeirado-masculino', '[DEMO] Perfume amadeirado masculino', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-masculinos'), 'male', 28990, 25990, 100, false,
  'Produto de demonstração.', 'Amadeirado', '{amadeirado,aromático}', '{bergamota}', '{lavanda}', '{cedro}', 'active', 'accepts_preorder', 5, 2, 450, 12, 16, 8, '{promo}', 'DEMO-002', now() - interval '1 day', null),
 ('demo-arabe-oud', '[DEMO] Perfume árabe oud', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-arabes'), 'unisex', 21990, null, 100, false,
  'Produto de demonstração.', 'Oriental', '{oud,âmbar}', '{açafrão}', '{rosa}', '{oud}', 'active', 'accepts_preorder', 3, 0, 500, 12, 16, 8, '{recommended}', 'DEMO-003', now() - interval '2 day', null),
 ('demo-arabe-baunilha', '[DEMO] Perfume árabe baunilha', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-arabes'), 'female', 18990, null, 100, false,
  'Produto de demonstração.', 'Gourmand', '{baunilha,doce}', '{}', '{}', '{}', 'active', 'ready_stock', null, 6, 500, 12, 16, 8, '{}', 'DEMO-004', now() - interval '3 day', null),
 ('demo-arabe-esgotado', '[DEMO] Perfume árabe esgotado', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-arabes'), 'male', 19990, null, 100, false,
  'Produto de demonstração sem estoque e sem encomenda.', 'Especiado', '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 0, 500, 12, 16, 8, '{}', 'DEMO-005', now() - interval '4 day', null),
 ('demo-decante-floral', '[DEMO] Decante 5 ml floral', (select id from c where slug='perfumes'), (select id from c where slug='decantes-5-ml'), 'female', 3990, null, 5, true,
  'Produto de demonstração.', 'Floral', '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 15, 60, 4, 10, 4, '{new}', 'DEMO-006', now(), null),
 ('demo-infantil', '[DEMO] Colônia infantil', (select id from c where slug='perfumes'), (select id from c where slug='perfumes-infantis'), 'kids', 8990, null, 100, false,
  'Produto de demonstração.', null, '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 3, 300, 8, 14, 6, '{}', 'DEMO-007', now(), null),
 ('demo-serum', '[DEMO] Sérum facial', (select id from c where slug='skincare'), null, 'not_applicable', 14990, null, 30, false,
  'Produto de demonstração.', null, '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 8, 150, 6, 12, 6, '{new}', 'DEMO-008', now(), 'Sérum'),
 ('demo-mascara-capilar', '[DEMO] Máscara capilar', (select id from c where slug='cabelos'), null, 'not_applicable', 9990, null, 200, false,
  'Produto de demonstração.', null, '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 5, 260, 8, 8, 8, '{}', 'DEMO-009', now(), 'Máscara'),
 ('demo-kit-presente', '[DEMO] Kit presente', (select id from c where slug='kits-e-presentes'), null, 'female', 42990, null, null, false,
  'Kit de demonstração com dois produtos da loja.', null, '{}', '{}', '{}', '{}', 'active', 'ready_stock', null, 0, 700, 20, 18, 10, '{}', 'DEMO-010', now(), null);

update public.products set is_bundle = true where slug = 'demo-kit-presente';
insert into public.bundle_items (bundle_product_id, component_product_id, quantity)
select (select id from public.products where slug='demo-kit-presente'), id, 1 from public.products where slug in ('demo-floral-feminino','demo-decante-floral');

insert into public.inventory_movements (product_id, kind, quantity, note)
select id, 'initial', stock_on_hand, 'Estoque inicial [DEMO]' from public.products where stock_on_hand > 0;
