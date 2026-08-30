-- 010 added a parameter, which creates an overload rather than replacing the
-- function. Two place_order() signatures make the call ambiguous to PostgREST,
-- which resolves by argument names and would have failed at runtime rather than
-- at deploy. Drop the pre-attempt_id version.
drop function if exists public.place_order(
  text,text,text,text,text,text,numeric,numeric,numeric,integer,text,text,text,
  boolean,text,jsonb,text,text,text,public.payment_status,text,integer,text,text,
  text,text,text,text,text,text,text,text,boolean);