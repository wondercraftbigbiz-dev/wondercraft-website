-- 007_total_bgn_round_once
--
-- Fixes a one-stotinka disagreement between the checkout and the admin view.
--
-- total_bgn was generated as `unit_price_bgn * quantity`, i.e. rounded per unit
-- and then multiplied. The UI converts the other way round — it sums in euro and
-- converts once — so three houses showed as 176,02 лв. in the modal and
-- 176,01 лв. in orders_admin:
--
--   per-unit first : round(30 * 1.95583) = 58.67 ; 58.67 * 3      = 176.01
--   once on total  : 30 * 3 = 90        ; round(90 * 1.95583)     = 176.02
--
-- lib/money.ts states the rule this column was breaking: round ONCE, on the
-- final total, or the parts stop adding up to the whole. The charge itself is in
-- euro and was always correct — this only ever affected the informational lev
-- figure — but a reconciliation that is off by a stotinka costs someone an
-- afternoon.
--
-- unit_price_bgn is left alone: as a per-unit display value it is correct.

drop view if exists public.orders_admin;

alter table public.orders drop column total_bgn;

alter table public.orders
  add column total_bgn numeric
    generated always as (round(unit_price_eur * quantity * 1.95583, 2)) stored;

comment on column public.orders.total_bgn is
  'Informational lev equivalent, converted ONCE from the euro total (see lib/money.ts). Never derived from unit_price_bgn — that rounds twice.';

create view public.orders_admin as
select
  o.order_number,
  o.created_at,
  o.status,
  o.payment_status,
  o.payment_provider,
  o.paid_at,
  o.paid_amount_eur,
  o.payment_mismatch,
  o.contact_name,
  o.contact_phone,
  c.email,
  o.contact_city,
  o.delivery_type,
  o.econt_city_name,
  o.econt_post_code,
  o.econt_office_code,
  o.econt_office_name,
  o.street,
  o.street_num,
  o.quarter,
  o.floor,
  o.apt,
  o.delivery_note,
  o.econt_unverified,
  o.product_name,
  o.product_id,
  o.quantity,
  o.total_eur,
  o.total_bgn,
  o.print_name,
  o.customization,
  o.message,
  o.marketing_consent_at_order,
  c.orders_count as customer_orders_count,
  case when c.orders_count > 1 then true else false end as is_repeat_customer,
  o.admin_notes,
  o.source,
  o.utm,
  o.mypos_order_id,
  o.mypos_trnref,
  o.id as order_id,
  o.customer_id
from public.orders o
join public.customers c on c.id = o.customer_id
order by o.created_at desc;
