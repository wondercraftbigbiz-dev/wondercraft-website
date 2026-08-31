-- The shop promises 14-day returns (components/site/guarantee.tsx), so a
-- refunded order is a real state, not a hypothetical. Without an amount column a
-- partial refund is indistinguishable from a full one, and the payment_status
-- enum already had 'refunded' waiting with nothing to write into.
--
-- numeric in euro, matching paid_amount_eur and the rest of this schema.
alter table public.orders
  add column if not exists refunded_eur numeric not null default 0
    check (refunded_eur >= 0);

comment on column public.orders.refunded_eur is
  'Total refunded so far. Equal to total_eur for a full refund, less for a partial one.';