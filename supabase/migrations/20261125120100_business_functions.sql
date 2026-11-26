-- =====================================================================
-- Regras de negócio transacionais (pedido, estoque, encomenda, pagamento)
-- Funções "svc_*" só podem ser chamadas pelo service_role (servidor).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------
create or replace function public.has_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- Administradora com MFA verificado (aal2) na sessão atual
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role()
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- ---------------------------------------------------------------------
-- Perfil automático ao cadastrar
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
          nullif(left(new.raw_user_meta_data ->> 'phone', 20), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Prazos: dias corridos ou úteis, fuso America/Sao_Paulo, feriados
-- Retorna o fim do dia-limite (23:59:59 em São Paulo) em UTC.
-- ---------------------------------------------------------------------
create or replace function public.compute_dispatch_due(p_from timestamptz, p_value integer, p_unit text)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  d date := (p_from at time zone 'America/Sao_Paulo')::date;
  added integer := 0;
begin
  if p_value is null or p_value < 0 then raise exception 'invalid_lead_time'; end if;
  if p_unit = 'calendar_days' then
    d := d + p_value;
  elsif p_unit = 'business_days' then
    while added < p_value loop
      d := d + 1;
      if extract(isodow from d) < 6 and not exists (select 1 from public.holidays h where h.day = d) then
        added := added + 1;
      end if;
    end loop;
  else
    raise exception 'lead_time_unit_not_configured';
  end if;
  return ((d + time '23:59:59') at time zone 'America/Sao_Paulo');
end $$;

-- ---------------------------------------------------------------------
-- Catálogo público (somente colunas seguras + disponibilidade calculada)
-- ---------------------------------------------------------------------
create or replace view public.catalog_products
with (security_barrier = true) as
with s as (select * from public.store_settings where id = 1),
bundle_avail as (
  select bi.bundle_product_id,
         min(floor((c.stock_on_hand - c.stock_reserved)::numeric / bi.quantity))::integer as available,
         bool_and(c.status = 'active') as components_active
  from public.bundle_items bi
  join public.products c on c.id = bi.component_product_id
  group by bi.bundle_product_id
),
base as (
  select p.*,
    case when p.is_bundle then
           least(coalesce(ba.available, 0), coalesce(p.bundle_max_quantity, 2147483647))
           * (case when coalesce(ba.components_active, false) then 1 else 0 end)
         else p.stock_on_hand - p.stock_reserved end as available_stock,
    coalesce(p.preorder_lead_time_value, s.preorder_default_lead_time_value) as eff_lead_value,
    coalesce(p.preorder_lead_time_unit, s.preorder_default_lead_time_unit) as eff_lead_unit,
    case when p.preorder_max_quantity is null then null
         else greatest(p.preorder_max_quantity - p.preorder_reserved - p.preorder_committed, 0) end as preorder_remaining
  from public.products p
  cross join s
  left join bundle_avail ba on ba.bundle_product_id = p.id
  where p.status in ('active','sold_out')
)
select
  b.id, b.slug, b.name, b.brand_id, br.name as brand_name, br.slug as brand_slug,
  b.category_id, c.slug as category_slug, c.name as category_name,
  b.subcategory_id, sc.slug as subcategory_slug, sc.name as subcategory_name,
  b.gender, b.price_cents, b.promo_price_cents,
  coalesce(b.promo_price_cents, b.price_cents) as effective_price_cents,
  b.volume_ml, b.is_decant, b.description, b.top_notes, b.heart_notes, b.base_notes,
  b.accords, b.olfactory_family, b.olfactory_description, b.product_type,
  b.contents, b.how_to_use, b.composition, b.warnings, b.benefits, b.sku,
  b.highlights, b.is_bundle, b.seo_title, b.seo_description, b.published_at, b.created_at,
  b.search_text,
  case
    when b.status = 'sold_out' or b.fulfillment_mode = 'unavailable' then 'sold_out'
    when b.available_stock > 0 then 'ready_stock'
    when not b.is_bundle and b.fulfillment_mode = 'accepts_preorder'
         and b.eff_lead_unit is not null
         and coalesce(b.preorder_remaining, 1) > 0 then 'preorder'
    else 'sold_out'
  end as sale_state,
  case
    when b.status = 'sold_out' or b.fulfillment_mode = 'unavailable' then 0
    when b.available_stock > 0 then least(b.available_stock, 20)
    when not b.is_bundle and b.fulfillment_mode = 'accepts_preorder' and b.eff_lead_unit is not null
      then least(coalesce(b.preorder_remaining, 20), 20)
    else 0
  end as max_purchasable,
  b.eff_lead_value as preorder_lead_time_value,
  b.eff_lead_unit as preorder_lead_time_unit,
  (select pi.storage_path from public.product_images pi
     where pi.product_id = b.id and pi.kind = 'image' order by pi.position limit 1) as cover_image,
  (select pi.alt_text from public.product_images pi
     where pi.product_id = b.id and pi.kind = 'image' order by pi.position limit 1) as cover_alt,
  rv.review_count, rv.rating_avg
from base b
join public.categories c on c.id = b.category_id
left join public.categories sc on sc.id = b.subcategory_id
left join public.brands br on br.id = b.brand_id
left join lateral (
  select count(*)::integer as review_count, round(avg(r.rating)::numeric, 1) as rating_avg
  from public.reviews r where r.product_id = b.id and r.status = 'approved'
) rv on true;

-- Fingerprint do carrinho (usado para amarrar a cotação de frete ao conteúdo do carrinho)
create or replace function public.cart_fingerprint(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(md5(string_agg(ci.product_id::text || ':' || ci.quantity::text, ',' order by ci.product_id)), 'empty')
  from public.carts c join public.cart_items ci on ci.cart_id = c.id
  where c.user_id = p_user;
$$;

-- ---------------------------------------------------------------------
-- Criação do pedido (servidor). Recalcula tudo, reserva estoque/capacidade.
-- ---------------------------------------------------------------------
create or replace function public.svc_create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_shipping_quote_id uuid,
  p_shipping_option_code text,
  p_coupon_code text,
  p_preorder_ack boolean,
  p_preorder_terms_text text,
  p_customer jsonb,
  p_attribution jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.store_settings%rowtype;
  v_cart_id uuid;
  v_fp text;
  v_quote public.shipping_quotes%rowtype;
  v_option jsonb;
  v_addr public.addresses%rowtype;
  v_addr_json jsonb;
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_eligible integer := 0;
  v_shipping integer := 0;
  v_has_preorder boolean := false;
  v_coupon public.coupons%rowtype;
  v_uses integer;
  v_expires timestamptz;
  r record;
  c record;
  v_avail integer;
  v_fulfillment text;
  v_item_id uuid;
  v_rule_items jsonb := '[]'::jsonb;
  v_components jsonb;
begin
  select * into s from public.store_settings where id = 1;
  if not s.checkout_enabled then raise exception 'checkout_disabled'; end if;

  select id into v_cart_id from public.carts where user_id = p_user_id;
  if v_cart_id is null or not exists (select 1 from public.cart_items where cart_id = v_cart_id) then
    raise exception 'cart_empty';
  end if;

  -- Trava (em ordem determinística) todos os produtos envolvidos, inclusive componentes de kits
  perform 1 from public.products p
   where p.id in (
     select ci.product_id from public.cart_items ci where ci.cart_id = v_cart_id
     union
     select bi.component_product_id from public.cart_items ci
       join public.bundle_items bi on bi.bundle_product_id = ci.product_id
      where ci.cart_id = v_cart_id)
   order by p.id for update;

  v_fp := public.cart_fingerprint(p_user_id);

  -- Frete: cotação feita pelo servidor, do mesmo usuário, válida e para o mesmo carrinho
  select * into v_quote from public.shipping_quotes
   where id = p_shipping_quote_id and user_id = p_user_id and expires_at > now();
  if v_quote.id is null then raise exception 'shipping_quote_invalid'; end if;
  if v_quote.cart_fingerprint <> v_fp then raise exception 'shipping_quote_stale'; end if;
  select o into v_option from jsonb_array_elements(v_quote.options) o where o ->> 'code' = p_shipping_option_code;
  if v_option is null then raise exception 'shipping_option_invalid'; end if;
  v_shipping := (v_option ->> 'price_cents')::integer;
  if v_shipping is null or v_shipping < 0 then raise exception 'shipping_option_invalid'; end if;

  if coalesce(v_option ->> 'kind', 'carrier') = 'pickup' then
    if not s.pickup_enabled then raise exception 'pickup_disabled'; end if;
    v_addr_json := null;
  else
    select * into v_addr from public.addresses where id = p_address_id and user_id = p_user_id;
    if v_addr.id is null then raise exception 'address_invalid'; end if;
    if v_addr.cep <> v_quote.destination_cep then raise exception 'shipping_quote_cep_mismatch'; end if;
    v_addr_json := jsonb_build_object(
      'recipient_name', v_addr.recipient_name, 'phone', v_addr.phone, 'cep', v_addr.cep,
      'street', v_addr.street, 'number', v_addr.number, 'complement', v_addr.complement,
      'neighborhood', v_addr.neighborhood, 'city', v_addr.city, 'state', v_addr.state);
  end if;

  v_expires := now() + make_interval(mins => s.reservation_minutes);

  insert into public.orders (user_id, subtotal_cents, discount_cents, shipping_cents, total_cents,
                             customer_snapshot, shipping_address, shipping_option, dispatch_rule,
                             payment_expires_at, attribution)
  values (p_user_id, 0, 0, 0, 0, coalesce(p_customer, '{}'::jsonb), v_addr_json, v_option,
          '{}'::jsonb, v_expires, p_attribution)
  returning id into v_order_id;

  for r in
    select ci.quantity, p.*, b.name as brand_name,
           coalesce(p.preorder_lead_time_value, s.preorder_default_lead_time_value) as lead_value,
           coalesce(p.preorder_lead_time_unit, s.preorder_default_lead_time_unit) as lead_unit
      from public.cart_items ci
      join public.products p on p.id = ci.product_id
      left join public.brands b on b.id = p.brand_id
     where ci.cart_id = v_cart_id
     order by p.id
  loop
    if r.status <> 'active' or r.price_cents is null or r.fulfillment_mode = 'unavailable' then
      raise exception 'product_unavailable:%', r.slug;
    end if;
    v_components := null;

    if r.is_bundle then
      -- Kits: somente pronta entrega; reserva cada componente
      if r.bundle_max_quantity is not null and r.quantity > r.bundle_max_quantity then
        raise exception 'insufficient_stock:%', r.slug;
      end if;
      if not exists (select 1 from public.bundle_items where bundle_product_id = r.id) then
        raise exception 'product_unavailable:%', r.slug;
      end if;
      for c in select bi.quantity as per_kit, cp.* from public.bundle_items bi
                 join public.products cp on cp.id = bi.component_product_id
                where bi.bundle_product_id = r.id order by cp.id loop
        if c.status <> 'active' or c.stock_on_hand - c.stock_reserved < c.per_kit * r.quantity then
          raise exception 'insufficient_stock:%', r.slug;
        end if;
        update public.products set stock_reserved = stock_reserved + c.per_kit * r.quantity where id = c.id;
        insert into public.stock_reservations (order_id, product_id, quantity, kind, expires_at)
        values (v_order_id, c.id, c.per_kit * r.quantity, 'stock', v_expires);
      end loop;
      select jsonb_agg(jsonb_build_object('product_id', cp.id, 'name', cp.name, 'sku', cp.sku, 'quantity', bi.quantity))
        into v_components
        from public.bundle_items bi join public.products cp on cp.id = bi.component_product_id
       where bi.bundle_product_id = r.id;
      v_fulfillment := 'ready_stock';
    else
      v_avail := r.stock_on_hand - r.stock_reserved;
      if v_avail >= r.quantity then
        v_fulfillment := 'ready_stock';
        update public.products set stock_reserved = stock_reserved + r.quantity where id = r.id;
        insert into public.stock_reservations (order_id, product_id, quantity, kind, expires_at)
        values (v_order_id, r.id, r.quantity, 'stock', v_expires);
      elsif v_avail > 0 then
        -- Há unidades físicas, mas não o suficiente: a cliente precisa ajustar a quantidade
        raise exception 'insufficient_stock:%', r.slug;
      elsif r.fulfillment_mode = 'accepts_preorder' then
        if r.lead_unit is null then raise exception 'preorder_unit_not_configured'; end if;
        if r.preorder_max_quantity is not null
           and r.preorder_reserved + r.preorder_committed + r.quantity > r.preorder_max_quantity then
          raise exception 'preorder_capacity_exceeded:%', r.slug;
        end if;
        v_fulfillment := 'preorder';
        v_has_preorder := true;
        update public.products set preorder_reserved = preorder_reserved + r.quantity where id = r.id;
        insert into public.stock_reservations (order_id, product_id, quantity, kind, expires_at)
        values (v_order_id, r.id, r.quantity, 'preorder', v_expires);
      else
        raise exception 'insufficient_stock:%', r.slug;
      end if;
    end if;

    insert into public.order_items (order_id, product_id, product_name, brand_name, sku, description_snapshot,
                                    unit_price_cents, quantity, line_total_cents, fulfillment,
                                    lead_time_value, lead_time_unit, is_bundle, bundle_components)
    values (v_order_id, r.id, r.name, r.brand_name, r.sku,
            concat_ws(' · ', r.name, case when r.volume_ml is not null then trim(to_char(r.volume_ml, 'FM9999.9')) || ' ml' end),
            coalesce(r.promo_price_cents, r.price_cents), r.quantity,
            coalesce(r.promo_price_cents, r.price_cents) * r.quantity, v_fulfillment,
            case when v_fulfillment = 'preorder' then r.lead_value end,
            case when v_fulfillment = 'preorder' then r.lead_unit end,
            r.is_bundle, v_components)
    returning id into v_item_id;

    if v_fulfillment = 'preorder' then
      v_rule_items := v_rule_items || jsonb_build_object('order_item_id', v_item_id, 'value', r.lead_value, 'unit', r.lead_unit);
    end if;

    v_subtotal := v_subtotal + coalesce(r.promo_price_cents, r.price_cents) * r.quantity;
  end loop;

  if v_has_preorder and not coalesce(p_preorder_ack, false) then
    raise exception 'preorder_ack_required';
  end if;
  if v_has_preorder and coalesce(trim(p_preorder_terms_text), '') = '' then
    raise exception 'preorder_terms_missing';
  end if;

  -- Cupom (nunca aplicado automaticamente)
  if coalesce(trim(p_coupon_code), '') <> '' then
    select * into v_coupon from public.coupons where code = upper(trim(p_coupon_code)) for update;
    if v_coupon.id is null or not v_coupon.active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then
      raise exception 'coupon_invalid';
    end if;
    if v_coupon.max_uses is not null then
      select count(*) into v_uses from public.coupon_redemptions where coupon_id = v_coupon.id and status <> 'released';
      if v_uses >= v_coupon.max_uses then raise exception 'coupon_exhausted'; end if;
    end if;
    if v_coupon.per_customer_limit is not null then
      select count(*) into v_uses from public.coupon_redemptions
       where coupon_id = v_coupon.id and user_id = p_user_id and status <> 'released';
      if v_uses >= v_coupon.per_customer_limit then raise exception 'coupon_customer_limit'; end if;
    end if;
    if v_coupon.min_subtotal_cents is not null and v_subtotal < v_coupon.min_subtotal_cents then
      raise exception 'coupon_min_subtotal';
    end if;
    select coalesce(sum(oi.line_total_cents), 0) into v_eligible
      from public.order_items oi join public.products p on p.id = oi.product_id
     where oi.order_id = v_order_id
       and (not v_coupon.bundles_only or oi.is_bundle)
       and (cardinality(v_coupon.product_ids) = 0 and cardinality(v_coupon.category_ids) = 0
            or p.id = any(v_coupon.product_ids)
            or p.category_id = any(v_coupon.category_ids)
            or p.subcategory_id = any(v_coupon.category_ids));
    if v_eligible = 0 then raise exception 'coupon_not_applicable'; end if;
    if v_coupon.discount_type = 'percent' then
      v_discount := floor(v_eligible * v_coupon.discount_value / 100.0);
    else
      v_discount := least(v_coupon.discount_value, v_eligible);
    end if;
    insert into public.coupon_redemptions (coupon_id, order_id, user_id) values (v_coupon.id, v_order_id, p_user_id);
  end if;

  if v_subtotal - v_discount + v_shipping < 100 then raise exception 'order_total_below_minimum'; end if;

  update public.orders set
    subtotal_cents = v_subtotal,
    discount_cents = v_discount,
    shipping_cents = v_shipping,
    total_cents = v_subtotal - v_discount + v_shipping,
    coupon_id = v_coupon.id,
    coupon_code = v_coupon.code,
    has_preorder = v_has_preorder,
    preorder_terms_text = case when v_has_preorder then p_preorder_terms_text end,
    preorder_terms_accepted_at = case when v_has_preorder then now() end,
    dispatch_rule = case when v_has_preorder
      then jsonb_build_object('kind', 'preorder', 'single_shipment', s.mixed_cart_single_shipment, 'items', v_rule_items)
      else jsonb_build_object('kind', 'ready', 'value', s.preparation_business_days, 'unit', 'business_days') end
  where id = v_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order_id, null, 'awaiting_payment', 'Pedido criado. Aguardando pagamento.');

  return to_jsonb(v_order) || jsonb_build_object(
    'items', (select jsonb_agg(to_jsonb(oi) order by oi.product_name) from public.order_items oi where oi.order_id = v_order_id));
end $$;

-- ---------------------------------------------------------------------
-- Confirmação de pagamento (somente após verificação server-side no provedor)
-- Idempotente: pode ser chamada várias vezes para o mesmo pedido.
-- ---------------------------------------------------------------------
create or replace function public.svc_confirm_payment(
  p_order_nsu text,
  p_invoice_slug text,
  p_transaction_nsu text,
  p_amount_cents integer,
  p_paid_amount_cents integer,
  p_installments integer,
  p_capture_method text,
  p_receipt_url text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := now();
  res record;
  it record;
  v_due timestamptz;
  v_max_due timestamptz;
  v_new_status text;
begin
  select * into v_order from public.orders where order_nsu = p_order_nsu for update;
  if v_order.id is null then
    insert into public.admin_alerts (kind, details)
    values ('unknown_order', jsonb_build_object('order_nsu', p_order_nsu, 'transaction_nsu', p_transaction_nsu, 'amount', p_amount_cents));
    return 'unknown_order';
  end if;

  if v_order.status not in ('awaiting_payment', 'payment_failed') then
    if v_order.paid_at is not null then return 'already_processed'; end if;
    -- Pagamento chegou para pedido cancelado/expirado: não mexe no estoque, sinaliza para análise
    insert into public.payments (order_id, order_nsu, invoice_slug, transaction_nsu, status, amount_cents,
                                 paid_amount_cents, installments, capture_method, receipt_url, verified_at)
    values (v_order.id, p_order_nsu, p_invoice_slug, p_transaction_nsu, 'review', p_amount_cents,
            p_paid_amount_cents, p_installments, p_capture_method, p_receipt_url, v_now)
    on conflict do nothing;
    if not exists (select 1 from public.admin_alerts where kind = 'late_payment' and order_id = v_order.id) then
      insert into public.admin_alerts (kind, order_id, details)
      values ('late_payment', v_order.id, jsonb_build_object('status', v_order.status, 'transaction_nsu', p_transaction_nsu));
    end if;
    return 'late_payment';
  end if;

  if p_amount_cents is distinct from v_order.total_cents
     or coalesce(p_paid_amount_cents, 0) < v_order.total_cents then
    insert into public.payments (order_id, order_nsu, invoice_slug, transaction_nsu, status, amount_cents,
                                 paid_amount_cents, installments, capture_method, receipt_url, verified_at)
    values (v_order.id, p_order_nsu, p_invoice_slug, p_transaction_nsu, 'review', p_amount_cents,
            p_paid_amount_cents, p_installments, p_capture_method, p_receipt_url, v_now)
    on conflict do nothing;
    if not exists (select 1 from public.admin_alerts where kind = 'payment_mismatch' and order_id = v_order.id) then
      insert into public.admin_alerts (kind, order_id, details)
      values ('payment_mismatch', v_order.id, jsonb_build_object(
        'expected', v_order.total_cents, 'amount', p_amount_cents, 'paid_amount', p_paid_amount_cents));
    end if;
    return 'amount_mismatch';
  end if;

  insert into public.payments (order_id, order_nsu, invoice_slug, transaction_nsu, status, amount_cents,
                               paid_amount_cents, installments, capture_method, receipt_url, verified_at)
  values (v_order.id, p_order_nsu, p_invoice_slug, p_transaction_nsu, 'paid', p_amount_cents,
          p_paid_amount_cents, p_installments, p_capture_method, p_receipt_url, v_now)
  on conflict do nothing;

  -- Consome reservas: estoque físico baixa; encomenda vira compromisso
  for res in select * from public.stock_reservations where order_id = v_order.id and status = 'active'
             order by product_id for update loop
    if res.kind = 'stock' then
      update public.products set stock_on_hand = stock_on_hand - res.quantity,
                                 stock_reserved = stock_reserved - res.quantity
       where id = res.product_id;
      insert into public.inventory_movements (product_id, kind, quantity, order_id, note)
      values (res.product_id, 'sale', -res.quantity, v_order.id, 'Venda ' || v_order.number);
    else
      update public.products set preorder_reserved = preorder_reserved - res.quantity,
                                 preorder_committed = preorder_committed + res.quantity
       where id = res.product_id;
    end if;
    update public.stock_reservations set status = 'consumed', resolved_at = v_now where id = res.id;
  end loop;

  if v_order.has_preorder then
    v_max_due := null;
    for it in select * from public.order_items where order_id = v_order.id and fulfillment = 'preorder' loop
      v_due := public.compute_dispatch_due(v_now, it.lead_time_value, it.lead_time_unit);
      v_max_due := greatest(coalesce(v_max_due, v_due), v_due);
      insert into public.preorder_allocations (order_id, order_item_id, product_id, quantity, paid_at, dispatch_due_at, supplier_name)
      select v_order.id, it.id, it.product_id, it.quantity, v_now, v_due, p.supplier_name
        from public.products p where p.id = it.product_id;
    end loop;
    v_new_status := 'awaiting_procurement';
  else
    v_max_due := public.compute_dispatch_due(v_now, coalesce((v_order.dispatch_rule ->> 'value')::integer, 3), 'business_days');
    v_new_status := 'paid';
  end if;

  update public.orders set status = v_new_status, paid_at = v_now, dispatch_due_at = v_max_due
   where id = v_order.id;
  update public.coupon_redemptions set status = 'confirmed' where order_id = v_order.id;

  insert into public.order_status_history (order_id, from_status, to_status, note, actor)
  values (v_order.id, v_order.status, v_new_status,
          case when v_order.has_preorder
               then 'Pagamento confirmado. Encomenda aguardando abastecimento.'
               else 'Pagamento confirmado.' end, 'webhook');

  -- Remove do carrinho os produtos comprados
  delete from public.cart_items ci using public.carts c, public.order_items oi
   where ci.cart_id = c.id and c.user_id = v_order.user_id
     and oi.order_id = v_order.id and oi.product_id = ci.product_id;

  return 'confirmed';
end $$;

-- Registro de falha de pagamento (não libera reserva: a cliente pode tentar novamente até expirar)
create or replace function public.svc_mark_payment_failed(p_order_nsu text)
returns text language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where order_nsu = p_order_nsu for update;
  if v_order.id is null then return 'unknown_order'; end if;
  if v_order.status <> 'awaiting_payment' then return 'ignored'; end if;
  update public.orders set status = 'payment_failed' where id = v_order.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, actor)
  values (v_order.id, v_order.status, 'payment_failed', 'Pagamento não aprovado. Você pode tentar novamente.', 'webhook');
  return 'marked';
end $$;

-- ---------------------------------------------------------------------
-- Liberação de reservas vencidas (executar periodicamente)
-- ---------------------------------------------------------------------
create or replace function public.release_order_reservations(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare res record;
begin
  for res in select * from public.stock_reservations where order_id = p_order_id and status = 'active'
             order by product_id for update loop
    if res.kind = 'stock' then
      update public.products set stock_reserved = stock_reserved - res.quantity where id = res.product_id;
    else
      update public.products set preorder_reserved = preorder_reserved - res.quantity where id = res.product_id;
    end if;
    update public.stock_reservations set status = 'released', resolved_at = now() where id = res.id;
  end loop;
  update public.coupon_redemptions set status = 'released' where order_id = p_order_id and status = 'pending';
end $$;

create or replace function public.svc_expire_pending_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare o record; n integer := 0;
begin
  for o in select * from public.orders
            where status in ('awaiting_payment','payment_failed') and payment_expires_at < now()
            order by created_at for update skip locked loop
    perform public.release_order_reservations(o.id);
    update public.orders set status = 'cancelled', cancelled_at = now(),
                             cancel_reason = 'Pagamento não concluído no prazo' where id = o.id;
    insert into public.order_status_history (order_id, from_status, to_status, note)
    values (o.id, o.status, 'cancelled', 'Pagamento não concluído no prazo. Nenhuma cobrança foi confirmada.');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Operações administrativas (chamadas pelo servidor após validar admin+MFA)
-- ---------------------------------------------------------------------
create or replace function public.svc_admin_adjust_stock(p_actor uuid, p_product_id uuid, p_delta integer, p_kind text, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer;
begin
  if p_kind not in ('initial','adjustment','return','loss') then raise exception 'invalid_kind'; end if;
  if p_delta = 0 then raise exception 'invalid_quantity'; end if;
  update public.products set stock_on_hand = stock_on_hand + p_delta where id = p_product_id
  returning stock_on_hand into v_new;
  if v_new is null then raise exception 'product_not_found'; end if;
  insert into public.inventory_movements (product_id, kind, quantity, note, created_by)
  values (p_product_id, p_kind, p_delta, p_note, p_actor);
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'stock.adjust', 'product', p_product_id::text, jsonb_build_object('delta', p_delta, 'kind', p_kind, 'note', p_note));
  return v_new;
end $$;

-- Recebimento de mercadoria: vincula primeiro às encomendas pagas (FIFO por prazo), sobra vai para o estoque físico
create or replace function public.svc_admin_receive_stock(p_actor uuid, p_product_id uuid, p_quantity integer, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_left integer := p_quantity;
  v_take integer;
  a record;
  v_allocated integer := 0;
  v_orders uuid[] := '{}';
  o uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'product_not_found'; end if;

  insert into public.inventory_movements (product_id, kind, quantity, note, created_by)
  values (p_product_id, 'receipt', p_quantity, p_note, p_actor);

  for a in select * from public.preorder_allocations
            where product_id = p_product_id and status in ('awaiting_purchase','purchased','awaiting_receipt')
            order by dispatch_due_at, paid_at for update loop
    exit when v_left = 0;
    v_take := least(v_left, a.quantity - a.quantity_received);
    continue when v_take <= 0;
    update public.preorder_allocations
       set quantity_received = quantity_received + v_take,
           status = case when quantity_received + v_take = quantity then 'received' else status end,
           received_at = case when quantity_received + v_take = quantity then now() else received_at end
     where id = a.id;
    update public.products set preorder_committed = preorder_committed - v_take where id = p_product_id;
    insert into public.inventory_movements (product_id, kind, quantity, order_id, note, created_by)
    values (p_product_id, 'preorder_allocation', 0, a.order_id,
            'Vinculado à encomenda (' || v_take || ' un.)', p_actor);
    v_left := v_left - v_take;
    v_allocated := v_allocated + v_take;
    v_orders := array_append(v_orders, a.order_id);
  end loop;

  if v_left > 0 then
    update public.products set stock_on_hand = stock_on_hand + v_left where id = p_product_id;
  end if;

  -- Pedidos cujas encomendas foram todas recebidas avançam de status
  foreach o in array (select array_agg(distinct x) from unnest(v_orders) x) loop
    if not exists (select 1 from public.preorder_allocations where order_id = o and status not in ('received','cancelled','refunded')) then
      update public.orders set status = 'procurement_received' where id = o and status = 'awaiting_procurement';
      if found then
        insert into public.order_status_history (order_id, from_status, to_status, note, actor)
        values (o, 'awaiting_procurement', 'procurement_received', 'Produto recebido. Preparando postagem.', 'admin:' || p_actor);
      end if;
    end if;
  end loop;

  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'stock.receive', 'product', p_product_id::text,
          jsonb_build_object('quantity', p_quantity, 'allocated', v_allocated, 'to_stock', v_left, 'note', p_note));

  return jsonb_build_object('allocated', v_allocated, 'to_stock', v_left, 'orders', to_jsonb(coalesce((select array_agg(distinct x) from unnest(v_orders) x), '{}')));
end $$;

create or replace function public.svc_admin_update_allocation(p_actor uuid, p_allocation_id uuid, p_status text, p_eta date, p_note text, p_notify boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status is not null and p_status not in ('awaiting_purchase','purchased','awaiting_receipt') then
    raise exception 'invalid_status';  -- recebido/postado/cancelado têm fluxos próprios
  end if;
  update public.preorder_allocations
     set status = coalesce(p_status, status), internal_eta = coalesce(p_eta, internal_eta)
   where id = p_allocation_id and status in ('awaiting_purchase','purchased','awaiting_receipt');
  if not found then raise exception 'allocation_not_editable'; end if;
  if coalesce(trim(p_note), '') <> '' then
    insert into public.procurement_updates (allocation_id, note, notify_customer, created_by)
    values (p_allocation_id, p_note, coalesce(p_notify, false), p_actor);
  end if;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'preorder.update', 'preorder_allocation', p_allocation_id::text,
          jsonb_build_object('status', p_status, 'eta', p_eta));
end $$;

create or replace function public.svc_admin_set_order_status(p_actor uuid, p_order_id uuid, p_to text, p_note text, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; ok boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found'; end if;
  ok := case p_to
    when 'preparing' then v_order.status in ('paid')
    when 'ready_to_ship' then v_order.status in ('paid','preparing','procurement_received')
    when 'shipped' then v_order.status in ('paid','preparing','procurement_received','ready_to_ship')
    when 'delivered' then v_order.status = 'shipped'
    else false end;
  if not ok then raise exception 'invalid_transition:%->%', v_order.status, p_to; end if;
  if p_to in ('ready_to_ship','shipped') and exists (
       select 1 from public.preorder_allocations where order_id = p_order_id and status not in ('received','ready_to_ship','shipped','cancelled','refunded')) then
    raise exception 'preorder_not_received';
  end if;
  update public.orders set status = p_to,
         tracking_code = coalesce(nullif(trim(p_tracking), ''), tracking_code),
         shipped_at = case when p_to = 'shipped' then now() else shipped_at end,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = p_order_id;
  if p_to in ('ready_to_ship','shipped') then
    update public.preorder_allocations set status = p_to where order_id = p_order_id and status in ('received','ready_to_ship');
  end if;
  insert into public.order_status_history (order_id, from_status, to_status, note, actor)
  values (p_order_id, v_order.status, p_to, p_note, 'admin:' || p_actor);
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'order.status', 'order', p_order_id::text, jsonb_build_object('from', v_order.status, 'to', p_to, 'tracking', p_tracking));
end $$;

-- Cancelamento: devolve estoque físico ainda não enviado e libera compromissos de encomenda.
-- O estorno financeiro é feito no painel da InfinitePay; depois registra-se com svc_admin_mark_refunded.
create or replace function public.svc_admin_cancel_order(p_actor uuid, p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; it record; a record; comp record;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found'; end if;
  if v_order.status in ('shipped','delivered','cancelled','refunded') then
    raise exception 'order_not_cancellable:%', v_order.status;
  end if;

  if v_order.paid_at is null then
    perform public.release_order_reservations(p_order_id);
  else
    -- Itens de pronta entrega voltam ao estoque físico
    for it in select * from public.order_items where order_id = p_order_id and fulfillment = 'ready_stock' loop
      if it.is_bundle then
        for comp in select (x ->> 'product_id')::uuid as pid, (x ->> 'quantity')::integer as q
                      from jsonb_array_elements(it.bundle_components) x loop
          update public.products set stock_on_hand = stock_on_hand + comp.q * it.quantity where id = comp.pid;
          insert into public.inventory_movements (product_id, kind, quantity, order_id, note, created_by)
          values (comp.pid, 'sale_cancelled', comp.q * it.quantity, p_order_id, 'Cancelamento ' || v_order.number, p_actor);
        end loop;
      elsif it.product_id is not null then
        update public.products set stock_on_hand = stock_on_hand + it.quantity where id = it.product_id;
        insert into public.inventory_movements (product_id, kind, quantity, order_id, note, created_by)
        values (it.product_id, 'sale_cancelled', it.quantity, p_order_id, 'Cancelamento ' || v_order.number, p_actor);
      end if;
    end loop;
    -- Encomendas: compromisso pendente é liberado; unidades já recebidas vão para o estoque físico
    for a in select * from public.preorder_allocations where order_id = p_order_id
               and status not in ('cancelled','refunded','shipped') for update loop
      update public.products set
        preorder_committed = preorder_committed - (a.quantity - a.quantity_received),
        stock_on_hand = stock_on_hand + a.quantity_received
       where id = a.product_id;
      if a.quantity_received > 0 then
        insert into public.inventory_movements (product_id, kind, quantity, order_id, note, created_by)
        values (a.product_id, 'sale_cancelled', a.quantity_received, p_order_id, 'Encomenda cancelada, unidades recebidas voltam ao estoque', p_actor);
      end if;
      update public.preorder_allocations set status = 'cancelled' where id = a.id;
    end loop;
    update public.coupon_redemptions set status = 'released' where order_id = p_order_id;
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, note, actor)
  values (p_order_id, v_order.status, 'cancelled', p_reason, coalesce('admin:' || p_actor::text, 'system'));
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'order.cancel', 'order', p_order_id::text, jsonb_build_object('reason', p_reason, 'was_paid', v_order.paid_at is not null));
end $$;

create or replace function public.svc_admin_mark_refunded(p_actor text, p_order_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found'; end if;
  if v_order.status = 'refunded' then return; end if;
  if v_order.paid_at is null then raise exception 'order_not_paid'; end if;
  if v_order.status <> 'cancelled' then
    -- Estorno sem cancelamento prévio (ex.: evento do provedor): cancela antes para devolver estoque
    if p_actor like 'admin:%' or p_actor = 'webhook' then
      perform public.svc_admin_cancel_order(
        case when p_actor like 'admin:%' then substring(p_actor from 7)::uuid else null end,
        p_order_id, coalesce(p_note, 'Estorno registrado'));
    end if;
  end if;
  update public.orders set status = 'refunded' where id = p_order_id;
  update public.preorder_allocations set status = 'refunded' where order_id = p_order_id and status = 'cancelled';
  update public.payments set status = 'refunded' where order_id = p_order_id and status in ('paid','settled');
  insert into public.order_status_history (order_id, from_status, to_status, note, actor)
  values (p_order_id, 'cancelled', 'refunded', coalesce(p_note, 'Estorno realizado.'), p_actor);
end $$;

-- ---------------------------------------------------------------------
-- Avaliação: somente cliente com pedido entregue contendo o produto
-- ---------------------------------------------------------------------
create or replace function public.submit_review(p_product_id uuid, p_order_id uuid, p_rating integer, p_comment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.id = p_order_id and o.user_id = auth.uid() and o.status = 'delivered'
       and (oi.product_id = p_product_id
            or exists (select 1 from jsonb_array_elements(coalesce(oi.bundle_components, '[]'::jsonb)) x
                        where (x ->> 'product_id')::uuid = p_product_id))) then
    raise exception 'purchase_not_verified';
  end if;
  select coalesce(split_part(nullif(trim(full_name), ''), ' ', 1), 'Cliente') into v_name from public.profiles where id = auth.uid();
  insert into public.reviews (product_id, user_id, order_id, rating, comment, author_display_name)
  values (p_product_id, auth.uid(), p_order_id, p_rating, nullif(trim(p_comment), ''), coalesce(v_name, 'Cliente'))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.immutable_unaccent(text) to anon, authenticated;
grant execute on function public.has_admin_role() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.submit_review(uuid, uuid, integer, text) to authenticated;
grant execute on function public.compute_dispatch_due(timestamptz, integer, text) to anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
