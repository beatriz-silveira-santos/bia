-- =====================================================================
-- Row Level Security: tudo fechado por padrão; liberações explícitas.
-- Administração passa pelo servidor (service_role) após validar admin + MFA (aal2);
-- as políticas is_admin() abaixo são uma segunda camada de defesa.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'store_settings','profiles','user_roles','addresses','brands','categories','products','product_images',
    'bundle_items','inventory_movements','carts','cart_items','favorites','local_delivery_zones','shipping_quotes',
    'coupons','orders','order_items','order_status_history','stock_reservations','coupon_redemptions',
    'preorder_allocations','procurement_updates','payments','payment_webhook_events','admin_alerts','reviews',
    'email_subscribers','email_suppression_list','email_log','marketing_touchpoints','analytics_events',
    'support_requests','holidays','content_pages','admin_audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- user_roles: ninguém altera via API (nem a admin) — provisionamento só por SQL/service_role
drop policy admin_all on public.user_roles;
create policy own_roles_read on public.user_roles for select to authenticated using (user_id = auth.uid());
grant select on public.user_roles to authenticated;

-- Auditoria: admin só lê (escrita apenas pelo servidor)
drop policy admin_all on public.admin_audit_log;
create policy admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());
grant select on public.admin_audit_log to authenticated;

-- Eventos de webhook/pagamentos: admin só lê
drop policy admin_all on public.payment_webhook_events;
create policy admin_read on public.payment_webhook_events for select to authenticated using (public.is_admin());
grant select on public.payment_webhook_events to authenticated;
drop policy admin_all on public.payments;
create policy admin_read on public.payments for select to authenticated using (public.is_admin());
grant select on public.payments to authenticated;

-- ---------------------------------------------------------------------
-- Leitura pública do catálogo (somente via colunas/linhas publicadas)
-- ---------------------------------------------------------------------
grant select on public.store_settings to anon, authenticated;
create policy public_read on public.store_settings for select to anon, authenticated using (true);

grant select on public.brands, public.categories to anon, authenticated;
create policy public_read on public.brands for select to anon, authenticated using (active);
create policy public_read on public.categories for select to anon, authenticated using (active);

-- Visibilidade pública de um produto, sem expor a tabela products ao público
-- (security definer: lê só o status; usado nas políticas de imagens e kits).
create or replace function public.is_product_public(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products p where p.id = p_id and p.status in ('active','sold_out'));
$$;
revoke all on function public.is_product_public(uuid) from public;
grant execute on function public.is_product_public(uuid) to anon, authenticated;

grant select on public.product_images to anon, authenticated;
create policy public_read on public.product_images for select to anon, authenticated
  using (public.is_product_public(product_id));

grant select on public.bundle_items to anon, authenticated;
create policy public_read on public.bundle_items for select to anon, authenticated
  using (public.is_product_public(bundle_product_id));

grant select on public.reviews to anon, authenticated;
create policy public_read on public.reviews for select to anon, authenticated using (status = 'approved');
create policy own_read on public.reviews for select to authenticated using (user_id = auth.uid());

grant select on public.content_pages to anon, authenticated;
create policy public_read on public.content_pages for select to anon, authenticated using (true);

grant select on public.holidays to anon, authenticated;
create policy public_read on public.holidays for select to anon, authenticated using (true);

grant select on public.local_delivery_zones to anon, authenticated;
create policy public_read on public.local_delivery_zones for select to anon, authenticated using (active);

-- A tabela products NÃO é exposta diretamente (contém campos internos);
-- o público lê a view catalog_products, que filtra status e colunas.
grant select on public.catalog_products to anon, authenticated;
-- Admin lê products completo via RLS (admin_all) quando autenticada com aal2
grant select, insert, update, delete on public.products to authenticated;

-- ---------------------------------------------------------------------
-- Dados da própria cliente
-- ---------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
create policy own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update, delete on public.addresses to authenticated;
create policy own_all on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.favorites to authenticated;
create policy own_all on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.carts to authenticated;
create policy own_all on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.cart_items to authenticated;
create policy own_all on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

grant select on public.orders, public.order_items, public.order_status_history to authenticated;
create policy own_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy own_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy own_read on public.order_status_history for select to authenticated
  using (visible_to_customer and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

grant select, insert on public.support_requests to authenticated;
create policy own_read on public.support_requests for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.support_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open'
              and (order_id is null or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));

-- Demais tabelas (estoque, reservas, encomendas, pagamentos, analytics, e-mail, alertas, cupons)
-- só são acessíveis pela admin (políticas admin_all) e pelo servidor (service_role).
grant select, insert, update, delete on
  public.inventory_movements, public.stock_reservations, public.preorder_allocations, public.procurement_updates,
  public.coupons, public.coupon_redemptions, public.admin_alerts, public.email_subscribers,
  public.email_suppression_list, public.email_log, public.marketing_touchpoints, public.analytics_events,
  public.shipping_quotes
to authenticated;
grant insert, update, delete on public.brands, public.categories, public.product_images, public.bundle_items,
  public.local_delivery_zones, public.content_pages, public.holidays, public.store_settings to authenticated;
grant update on public.reviews, public.orders to authenticated;

-- Colunas de produto ocultas mesmo para quem tiver select via RLS de admin? (admin precisa vê-las) — mantido.

-- ---------------------------------------------------------------------
-- Storage: bucket público de imagens de produtos; upload só admin (aal2)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy products_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'products' and public.is_admin());
create policy products_admin_update on storage.objects for update to authenticated using (bucket_id = 'products' and public.is_admin());
create policy products_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'products' and public.is_admin());
