-- ============================================================
-- KOJOH, hype counter and the AI prompt field
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Hypes. One per account per dataset, toggled by clicking.
-- ------------------------------------------------------------
create table if not exists public.hypes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dataset_id)
);

create index if not exists hypes_dataset_idx on public.hypes(dataset_id);

alter table public.hypes enable row level security;

-- Anyone may read the counts, that is the point of a public number.
drop policy if exists "Hype counts are public" on public.hypes;
create policy "Hype counts are public"
  on public.hypes for select using (true);

-- You may only add or remove your own hype.
drop policy if exists "Users add own hype" on public.hypes;
create policy "Users add own hype"
  on public.hypes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users remove own hype" on public.hypes;
create policy "Users remove own hype"
  on public.hypes for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. The prompt a buyer copies into their own AI.
--    Left null, the dataset page builds one from the story,
--    the columns and the challenge phases.
-- ------------------------------------------------------------
alter table public.datasets
  add column if not exists ai_prompt text;
