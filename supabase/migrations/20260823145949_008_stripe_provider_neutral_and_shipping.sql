-- Stripe replaces myPOS as the card provider, and delivery becomes part of the
-- charged total.
--
-- Two changes, both forced by the same fact: the amount Stripe captures is
-- product + Econt delivery, but total_eur was generated as product alone, so
-- mark_order_paid() would have flagged payment_mismatch on every card order.
--
-- 1. mypos_* columns become provider_* . payment_provider already exists to say
--    which provider a row belongs to, so the reference columns had no business
--    naming one. Both tables are empty, so the rename costs nothing.
-- 2. shipping_eur is added and folded into the generated totals.

begin;

-- The admin view reads all four columns being changed; rebuilt at the end.
drop view if exists public.orders_admin;

-- 1. Provider-neutral payment references ------------------------------------
alter table public.orders rename column mypos_order_id to provider_order_id;
alter table public.orders rename column mypos_trnref  to provider_txn_ref;

comment on column public.orders.provider_order_id is
  'Our reference at the payment provider. For Stripe this is the PaymentIntent id (pi_...). Idempotency key for payment notifications.';
comment on column public.orders.provider_txn_ref is
  'The provider''s own transaction reference, echoed back on settlement.';

-- The webhook looks an order up by this and must never match two rows.
create unique index if not exists orders_provider_order_id_key
  on public.orders (provider_order_id)
  where provider_order_id is not null;

-- 2. Delivery joins the total ------------------------------------------------
alter table public.orders
  add column if not exists shipping_eur numeric not null default 0
    check (shipping_eur >= 0);

comment on column public.orders.shipping_eur is
  'Econt delivery, quoted server-side at checkout. 0 when the quote was unavailable and delivery is settled by phone.';

-- Generated columns cannot be altered in place; drop and re-add.
alter table public.orders drop column total_eur;
alter table public.orders drop column total_bgn;

alter table public.orders
  add column total_eur numeric
    generated always as (unit_price_eur * quantity + shipping_eur) stored;

-- Converted ONCE from the euro total (see lib/money.ts). Never from
-- unit_price_bgn, which would round twice.
alter table public.orders
  add column total_bgn numeric
    generated always as (round((unit_price_eur * quantity + shipping_eur) * 1.95583, 2)) stored;

comment on column public.orders.total_eur is
  'Product times quantity plus delivery. This is the amount charged.';
comment on column public.orders.total_bgn is
  'Informational lev equivalent, converted ONCE from the euro total (see lib/money.ts).';

commit;