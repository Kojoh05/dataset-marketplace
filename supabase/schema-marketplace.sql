-- ============================================================
-- KOJOH — Marketplace schema additions (v0.4)
-- Run this in Supabase SQL Editor AFTER schema.sql (and schema-additions.sql
-- if you've run that too — this file doesn't depend on it either way).
--
-- Adds:
--   1. dataset_licenses  — the 100-per-dataset personalized challenge packs
--   2. purchase_dataset() — the one function the "Buy Now" button calls
--   3. Storage RLS policy — gates the private "datasets" bucket by purchase
--   4. Seed data for the first real dataset: Tata Delhi Sales FY25-26
--
-- After this file, run seed_licenses.sql (100 INSERT statements — kept
-- separate because it's large) to populate the actual 100 license packs.
-- ============================================================

-- ============================================================
-- 1. DATASET LICENSES
-- ============================================================
create table public.dataset_licenses (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  license_code text not null unique,
  tier text not null default 'standard' check (tier in ('standard', 'premium')),
  task_pack jsonb not null,          -- { phases: [...], premium: [...] } — see seed_licenses.sql
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index dataset_licenses_unclaimed_idx
  on public.dataset_licenses (dataset_id, tier)
  where claimed_by is null;

alter table public.dataset_licenses enable row level security;

-- A buyer can only ever read the license row they themselves claimed.
-- No insert/update/delete policy for anon/authenticated — the ONLY way a
-- row gets claimed is through purchase_dataset() below, which runs as
-- SECURITY DEFINER and therefore bypasses RLS deliberately, in exactly one
-- controlled way (claim one row, never edit an already-claimed one).
create policy "Users read own claimed license"
  on public.dataset_licenses for select
  using (auth.uid() = claimed_by);

-- ============================================================
-- 2. purchase_dataset() — what the "Buy Now" button calls
-- ============================================================
-- Beta note: this currently does NOT collect any payment — it's the same
-- "manual/free while testing the full loop" approach you chose. price_paid
-- is recorded as 0 with payment_ref='beta-free-buynow' so real Razorpay
-- purchases (later) are easy to tell apart in the purchases table. When you
-- wire up real payments, keep this function's shape (validate → claim →
-- insert) and just call it after payment confirms instead of on click.
create or replace function public.purchase_dataset(p_dataset_id uuid, p_tier text default 'standard')
returns public.dataset_licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.dataset_licenses;
  v_license public.dataset_licenses;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_tier not in ('standard', 'premium') then
    raise exception 'invalid tier';
  end if;

  -- Already own this dataset? Return their existing license instead of
  -- erroring — makes the Buy button safe to click twice (double-click, a
  -- retried request, revisiting the page).
  select dl.* into v_existing
    from public.dataset_licenses dl
    join public.purchases pu on pu.user_id = v_user and pu.dataset_id = p_dataset_id
    where dl.dataset_id = p_dataset_id and dl.claimed_by = v_user
    limit 1;
  if found then
    return v_existing;
  end if;

  -- Claim one unclaimed license of the requested tier. FOR UPDATE SKIP
  -- LOCKED means two simultaneous buyers can never claim the same row —
  -- whoever's transaction gets there first wins it, the other just gets
  -- the next free row instead of blocking or erroring.
  select * into v_license
    from public.dataset_licenses
    where dataset_id = p_dataset_id and tier = p_tier and claimed_by is null
    order by created_at
    limit 1
    for update skip locked;

  if not found then
    raise exception 'sold out: no unclaimed % license left for this dataset', p_tier;
  end if;

  update public.dataset_licenses
    set claimed_by = v_user, claimed_at = now()
    where id = v_license.id
    returning * into v_license;

  insert into public.purchases (user_id, dataset_id, price_paid, payment_ref)
    values (v_user, p_dataset_id, 0, 'beta-free-buynow');

  return v_license;
end;
$$;

revoke all on function public.purchase_dataset(uuid, text) from public;
grant execute on function public.purchase_dataset(uuid, text) to authenticated;

-- ============================================================
-- 3. STORAGE — private "datasets" bucket
-- ============================================================
-- Create the bucket itself in the dashboard first:
--   Storage → New bucket → name "datasets" → Public: OFF
-- Then run this policy (it's SQL, not a dashboard setting, so it belongs
-- here). It lets a signed-in user read any file whose PATH's first folder
-- segment matches the slug of a dataset they've purchased — e.g. a file at
-- "tata-delhi-sales-fy2526/data-dictionary.md" is readable by anyone with a
-- purchases row for the dataset whose slug is "tata-delhi-sales-fy2526".
create policy "Buyers can read their purchased dataset files"
  on storage.objects for select
  using (
    bucket_id = 'datasets'
    and exists (
      select 1
      from public.purchases pu
      join public.datasets d on d.id = pu.dataset_id
      where pu.user_id = auth.uid()
        and (storage.foldername(name))[1] = d.slug
    )
  );

-- ============================================================
-- 4. SEED — Tata Delhi Sales FY25-26 (the first real dataset)
-- ============================================================
insert into public.folders (slug, title, description, color_key, view_type, sort_order)
values ('data-analyst', 'Data analyst',
        'The highest-demand track for job-seekers — real business problems, not random CSVs.',
        'f-analyst', 'job', 1)
on conflict (slug) do nothing;

insert into public.datasets (folder_id, slug, title, short_description, long_description,
                              price, is_free, difficulty, storage_path)
select
  f.id,
  'tata-delhi-sales-fy2526',
  'The ₹176 Lakh Question — Tata Dealership Sales, Delhi',
  'A year of hand-typed ERP entries from an 8-branch Tata dealer group in Delhi. Clean it, then settle the argument management can''t: who really performed, what December''s record month actually cost, and why the customers who refused last year''s stock were the most profitable buyers of the year.',
  'Sanchay Motors is an authorised Tata Motors dealer group with eight showrooms across Delhi NCT. Fifty-six salespeople sell the full Tata range between them, and every deal gets typed by hand into the dealership ERP. At financial year-end, management is deadlocked over who deserves the "Salesperson of the Year" bonus: the person who sold the most cars, or the person who actually made the company the most money. This is a full four-phase analyst project (Python cleaning, SQL, a two-page dashboard, and a written recommendation) built on 14,735 real-structured rows across 41 columns, using the real Tata Motors India model line-up, variants, colours, and safety ratings. It ships with a 100-license personalized challenge system: every buyer works the identical task set in their own shuffled order.',
  99.00, false, 'hard',
  'tata-delhi-sales-fy2526'
from public.folders f
where f.slug = 'data-analyst'
on conflict (slug) do nothing;

-- link to the Data Analyst job title (for search_datasets ontology matching)
insert into public.dataset_job_titles (dataset_id, job_title_id)
select d.id, jt.id
from public.datasets d, public.job_titles jt
where d.slug = 'tata-delhi-sales-fy2526' and jt.name = 'Data Analyst'
on conflict do nothing;

-- link relevant tags
insert into public.dataset_tags (dataset_id, tag_id)
select d.id, t.id
from public.datasets d, public.tags t
where d.slug = 'tata-delhi-sales-fy2526' and t.name in ('Python', 'SQL', 'Sales')
on conflict do nothing;

-- the dataset's own column schema (41 columns)
insert into public.dataset_schema (dataset_id, column_name, column_type, description, sort_order)
select d.id, col.column_name, col.column_type, col.description, col.sort_order
from public.datasets d
cross join (values
  ('Deal ID', 'text', 'ERP reference, e.g. SM505116. Not unique — ~190 duplicate entries.', 1),
  ('Enquiry Date', 'text (mixed date formats)', 'When the customer first enquired.', 2),
  ('Booking Date', 'text (mixed date formats)', 'When the deal was booked; defines the sales month.', 3),
  ('Sales Person', 'text (free-text, ~8 spellings per person)', 'Salesperson who logged the deal.', 4),
  ('Emp Code', 'text', 'Employee code — ~5% blank, some typo''d.', 5),
  ('Branch', 'text', 'One of 8 Delhi NCT showrooms.', 6),
  ('Branch Code', 'text', 'Short branch code, e.g. SM-ROH.', 7),
  ('Month', 'text', 'Sales month label — ~40% blank, derive from Booking Date instead.', 8),
  ('Model', 'text', 'Tata model (15 in range, incl. 6 electric).', 9),
  ('Variant', 'text', 'Trim level.', 10),
  ('Variant Tier', 'text', 'Base / Mid / Top.', 11),
  ('Fuel', 'text (mixed casing)', 'Petrol / Diesel / CNG / Electric.', 12),
  ('Transmission', 'text (mixed casing)', 'Manual / AMT / Automatic / DCT.', 13),
  ('Colour', 'text', 'Exterior colour as ordered.', 14),
  ('Model Year', 'text', 'MY2025 or MY2026.', 15),
  ('Seating Capacity', 'integer', '5, 6 or 7.', 16),
  ('Safety Rating', 'text', 'NCAP star rating, e.g. "5 Star".', 17),
  ('Ex-Showroom Price', 'text (mixed currency formats)', 'Tata list price.', 18),
  ('Floor Price', 'text (mixed currency formats)', 'Lowest price the branch may accept.', 19),
  ('Quoted Price', 'text (mixed currency formats)', 'Opening quote.', 20),
  ('Discount Given', 'text (mixed currency formats)', 'Total benefit passed to the customer.', 21),
  ('Scheme Applied', 'text', 'Which offer was used.', 22),
  ('Final Sale Price', 'text (mixed currency formats)', 'What the customer actually paid. Blank unless Closed.', 23),
  ('Accessories Interest', 'text (Y/N variants)', 'Did the customer show interest?', 24),
  ('Accessories Value', 'text (mixed currency formats)', 'Accessories bought at purchase.', 25),
  ('Post Delivery Accessory Value', 'text (mixed currency formats)', 'Accessories bought after delivery.', 26),
  ('Payment Mode', 'text', 'Cash or Finance.', 27),
  ('Down Payment', 'text (mixed currency formats)', 'Upfront amount.', 28),
  ('Finance Amount', 'text (mixed currency formats)', 'Amount financed.', 29),
  ('Finance Bank', 'text', 'One of 15 banks/NBFCs.', 30),
  ('Loan Tenure', 'text', 'Months, "X months", or "X years".', 31),
  ('Interest Rate', 'text', 'As a number, "%", or decimal form.', 32),
  ('Customer Name', 'text', 'Buyer name.', 33),
  ('Contact', 'text', 'Phone number, ~18% blank.', 34),
  ('Family Size', 'text', 'Number, "N members", or spelled out.', 35),
  ('Customer Type', 'text', 'First Time Buyer / Repeat / Corporate / Fleet-Taxi.', 36),
  ('Status', 'text (~20 raw values)', 'Collapses to Closed / Open / Lost.', 37),
  ('Scheduled Delivery Date', 'text (mixed date formats)', 'Promised delivery date.', 38),
  ('Actual Delivery Date', 'text (mixed date formats)', 'Actual delivery date, blank if undelivered.', 39),
  ('Customer Feedback', 'text', 'What the customer said they liked, face to face.', 40),
  ('Remarks', 'text', 'Free-text note, often blank.', 41)
) as col(column_name, column_type, description, sort_order)
where d.slug = 'tata-delhi-sales-fy2526'
  -- dataset_schema has no unique constraint to key an ON CONFLICT off, so
  -- guard idempotency explicitly: skip entirely if this dataset already has
  -- schema rows (i.e. this script already ran once).
  and not exists (
    select 1 from public.dataset_schema ds2 where ds2.dataset_id = d.id
  );

-- ============================================================
-- Done. Next steps:
--   1. Create the "datasets" Storage bucket (private) in the dashboard.
--   2. Upload these 5 files into a "tata-delhi-sales-fy2526/" folder inside it:
--        tata_delhi_sales_fy25_26_raw.csv
--        tata_delhi_sales_fy25_26_raw.xlsx
--        data-dictionary.md
--        scenario-story.md
--        challenge-tasks.md
--   3. Run seed_licenses.sql to populate the 100 dataset_licenses rows.
-- ============================================================
