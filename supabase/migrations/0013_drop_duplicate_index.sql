-- Two unique indexes on the same column, left behind by the myPOS rename.
--
-- Migration 008 renamed the COLUMN mypos_order_id -> provider_order_id, which
-- Postgres follows automatically in index definitions but does not rename the
-- INDEX. It then created orders_provider_order_id_key alongside, so the table
-- carried two identical partial unique indexes on provider_order_id: double the
-- write cost, and a confusing constraint name in any error message.
drop index if exists public.orders_mypos_order_id_key;
