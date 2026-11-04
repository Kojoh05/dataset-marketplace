-- KOJOH Practice levels: written answers, certificates, paid level skips, private level data.
-- Run once in the Supabase SQL editor after schema-practice.sql (safe to run again).

-- Extra per-user state (wrong attempts, hints, solutions viewed) used for scoring.
alter table public.practice_progress add column if not exists state jsonb not null default '{}'::jsonb;

-- Written case answers. The learner submits; the admin marks them.
create table if not exists public.practice_written (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  level text not null,
  task_id text not null,
  question text,
  answer text not null,
  words int not null default 0,
  max_marks int not null default 10,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  marks int,
  feedback text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (user_id, task_id)
);
alter table public.practice_written enable row level security;
drop policy if exists "Own written read" on public.practice_written;
create policy "Own written read" on public.practice_written for select using (auth.uid() = user_id);
drop policy if exists "Own written submit" on public.practice_written;
create policy "Own written submit" on public.practice_written for insert
  with check (auth.uid() = user_id and status = 'submitted' and marks is null);
drop policy if exists "Own written resubmit" on public.practice_written;
create policy "Own written resubmit" on public.practice_written for update
  using (auth.uid() = user_id and status = 'submitted')
  with check (auth.uid() = user_id and status = 'submitted' and marks is null);
drop policy if exists "Admins manage written" on public.practice_written;
create policy "Admins manage written" on public.practice_written for all
  using (public.is_admin()) with check (public.is_admin());

-- Certificates. Learners request one when a level is complete; the admin issues it.
-- Skipped levels are issued automatically by verify-payment, with no score.
create table if not exists public.practice_certificates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  role_title text,
  level text not null,
  status text not null default 'requested' check (status in ('requested', 'issued', 'rejected')),
  skipped boolean not null default false,
  auto_points int,
  auto_max int,
  score int,
  note text,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (user_id, role, level)
);
alter table public.practice_certificates enable row level security;
drop policy if exists "Own certificates read" on public.practice_certificates;
create policy "Own certificates read" on public.practice_certificates for select using (auth.uid() = user_id);
drop policy if exists "Anyone verifies issued certificates" on public.practice_certificates;
create policy "Anyone verifies issued certificates" on public.practice_certificates for select using (status = 'issued');
drop policy if exists "Own certificate request" on public.practice_certificates;
create policy "Own certificate request" on public.practice_certificates for insert
  with check (auth.uid() = user_id and status = 'requested' and skipped = false and score is null);
drop policy if exists "Admins manage certificates" on public.practice_certificates;
create policy "Admins manage certificates" on public.practice_certificates for all
  using (public.is_admin()) with check (public.is_admin());

-- Levels unlocked by paying the skip fee (written only by verify-payment).
create table if not exists public.practice_level_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  level text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role, level)
);
alter table public.practice_level_unlocks enable row level security;
drop policy if exists "Own unlocks read" on public.practice_level_unlocks;
create policy "Own unlocks read" on public.practice_level_unlocks for select using (auth.uid() = user_id);
drop policy if exists "Admins manage unlocks" on public.practice_level_unlocks;
create policy "Admins manage unlocks" on public.practice_level_unlocks for all
  using (public.is_admin()) with check (public.is_admin());

-- Skip payments carry which level they unlock.
alter table public.payments add column if not exists meta jsonb;

-- Intermediate and Hard data files live in the private bucket; pass holders can read them.
drop policy if exists "Pass holders read pro packs" on storage.objects;
create policy "Pass holders read pro packs" on storage.objects for select to authenticated
  using (bucket_id = 'practice-pro' and (name like 'pro/%' or name like 'data/%')
         and exists (select 1 from public.practice_passes p where p.user_id = auth.uid() and p.expires_at > now()));
