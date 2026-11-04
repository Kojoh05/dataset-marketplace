-- KOJOH: Practice passes + one-time reward codes. Run once in the Supabase SQL editor.

create table if not exists public.practice_passes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_payment_id uuid,
  percent int not null default 10,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_payment_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists discount_codes_user_idx on public.discount_codes(user_id);

alter table public.practice_passes enable row level security;
alter table public.discount_codes enable row level security;

drop policy if exists "Own pass read" on public.practice_passes;
create policy "Own pass read" on public.practice_passes for select using (auth.uid() = user_id);
drop policy if exists "Admins manage passes" on public.practice_passes;
create policy "Admins manage passes" on public.practice_passes for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Own codes read" on public.discount_codes;
create policy "Own codes read" on public.discount_codes for select using (auth.uid() = user_id);
drop policy if exists "Admins read codes" on public.discount_codes;
create policy "Admins read codes" on public.discount_codes for select using (public.is_admin());
-- No insert/update policy for normal users: only the Edge Functions (service role) write codes.

alter table public.payments
  add column if not exists discount_code_id uuid,
  add column if not exists discount_amount numeric not null default 0;

-- To give someone a Practice pass by hand (30 days) until the Practice plan checkout exists:
-- insert into public.practice_passes (user_id, expires_at)
--   select id, now() + interval '30 days' from auth.users where email = 'someone@example.com'
--   on conflict (user_id) do update set expires_at = excluded.expires_at;
