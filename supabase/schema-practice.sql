-- KOJOH Practice: passes, progress, pass payments and Storage for practice packs.
-- Run once in the Supabase SQL editor (safe to run again). Run schema-rewards.sql too if you have not yet.

create table if not exists public.practice_passes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.practice_passes enable row level security;
drop policy if exists "Own pass read" on public.practice_passes;
create policy "Own pass read" on public.practice_passes for select using (auth.uid() = user_id);
drop policy if exists "Admins manage passes" on public.practice_passes;
create policy "Admins manage passes" on public.practice_passes for all
  using (public.is_admin()) with check (public.is_admin());

-- One row per user. The page reads it once and writes it only when a task is solved.
create table if not exists public.practice_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  solved jsonb not null default '{}'::jsonb,
  points int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.practice_progress enable row level security;
drop policy if exists "Own progress" on public.practice_progress;
create policy "Own progress" on public.practice_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins read progress" on public.practice_progress;
create policy "Admins read progress" on public.practice_progress for select using (public.is_admin());

-- Pass purchases go through the same payments table.
alter table public.payments alter column dataset_id drop not null;
alter table public.payments
  add column if not exists kind text not null default 'dataset',
  add column if not exists pass_days int;

-- Storage: 'practice' is public (manifest, free packs, data CSVs, served from the CDN).
-- 'practice-pro' is private (full packs for pass holders, editor source for the admin).
insert into storage.buckets (id, name, public) values ('practice', 'practice', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('practice-pro', 'practice-pro', false)
  on conflict (id) do update set public = false;

drop policy if exists "Admins manage practice files" on storage.objects;
create policy "Admins manage practice files" on storage.objects for all to authenticated
  using (bucket_id in ('practice', 'practice-pro') and public.is_admin())
  with check (bucket_id in ('practice', 'practice-pro') and public.is_admin());

drop policy if exists "Pass holders read pro packs" on storage.objects;
create policy "Pass holders read pro packs" on storage.objects for select to authenticated
  using (bucket_id = 'practice-pro' and name like 'pro/%'
         and exists (select 1 from public.practice_passes p where p.user_id = auth.uid() and p.expires_at > now()));
