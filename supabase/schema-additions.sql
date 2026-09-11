-- ============================================================
-- KOJOH — Schema additions for v0.3
-- Run this in Supabase SQL Editor AFTER the initial schema.sql.
-- Adds: bookmarks, suggestions, app_feedback + a public summary view.
-- ============================================================

-- --------------- BOOKMARKS ---------------
create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dataset_id)
);
alter table public.bookmarks enable row level security;

drop policy if exists "Users manage own bookmarks" on public.bookmarks;
create policy "Users manage own bookmarks" on public.bookmarks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --------------- SUGGESTIONS ---------------
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.suggestions enable row level security;

drop policy if exists "Users insert own suggestions" on public.suggestions;
create policy "Users insert own suggestions" on public.suggestions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users read own suggestions" on public.suggestions;
create policy "Users read own suggestions" on public.suggestions
  for select
  using (auth.uid() = user_id);

-- --------------- APP FEEDBACK (like / dislike) ---------------
create table if not exists public.app_feedback (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vote text not null check (vote in ('like','dislike')),
  updated_at timestamptz not null default now()
);
alter table public.app_feedback enable row level security;

drop policy if exists "Users manage own vote" on public.app_feedback;
create policy "Users manage own vote" on public.app_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Aggregate view — no PII, safe for anon read.
create or replace view public.app_feedback_summary as
  select
    count(*) filter (where vote = 'like')    as likes,
    count(*) filter (where vote = 'dislike') as dislikes
  from public.app_feedback;
grant select on public.app_feedback_summary to anon, authenticated;
