# Database schema

`public.orders` and `public.customers` are where every order lives. The
application never writes to them directly — it goes through two SECURITY DEFINER
functions, `place_order()` and `mark_order_paid()`, because that is where the
concurrency is. A Stripe webhook retry and a browser confirmation can arrive at
the same instant, and a `for update` in plpgsql is a great deal harder to get
wrong than a read-modify-write in TypeScript.

## These files are the source of truth

`lib/order/repository.ts` calls both functions by name with **positional
arguments**. If a signature here drifts from that file, every order is refused at
`createIntent()` and the customer sees a generic "temporarily unavailable".
Change them together.

## Why there is one baseline rather than a numbered history

Migrations 001-012 were applied directly to the project (`ppuxxxhflctkzahnvxje`)
through the Supabase API before any SQL lived in this repository. Their
cumulative result is captured in `0000_baseline.sql`, dumped from the live
database rather than reconstructed from memory, so it matches what is actually
deployed.

The original sequence is not recoverable and inventing twelve plausible files
would be worse than one honest one. New changes go in numbered files from `0013`
onward.

## Rebuilding from scratch

```bash
psql "$DATABASE_URL" -f supabase/migrations/0000_baseline.sql
psql "$DATABASE_URL" -f supabase/migrations/0013_drop_duplicate_index.sql
```

RLS is enabled on all three tables with **zero policies**, which denies `anon`
and `authenticated` entirely. The service role bypasses RLS and is the only way
in — see `lib/supabase/admin.ts`. There is deliberately no anon-key client in
this repository and no `NEXT_PUBLIC_SUPABASE_*` variable.
