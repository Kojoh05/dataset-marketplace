-- ============================================================
-- KOJOH — Supabase backend schema
-- Paste this into the Supabase SQL Editor (Project → SQL Editor → New query)
-- and run it once your project is created.
-- ============================================================

-- Extensions needed for fuzzy/typo-tolerant search
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ============================================================
-- 1. PROFILES (extends Supabase's built-in auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text check (gender in ('male','female','other')),
  country text not null,
  auth_provider text not null default 'email' check (auth_provider in ('email','google')),
  created_at timestamptz not null default now()
);

-- username format: 3-20 chars, must contain at least one letter and one number
alter table public.profiles
  add constraint username_format check (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
    and username ~ '[a-zA-Z]'
    and username ~ '[0-9]'
  );

create index profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Username lookup for "login with username" — returns the email for a given
-- username so the frontend can then call signInWithPassword(email, password).
-- SECURITY DEFINER so it can read profiles.email even though profiles select
-- is normally locked to the owner. Callable by anyone (needed pre-login).
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

-- Live "is this username taken?" check during signup — no email exposed.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ============================================================
-- 2. ONTOLOGY — job titles, aliases, categories, tags
--    (this is the "semantic layer" the search box uses)
-- ============================================================
create table public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null              -- canonical name, e.g. "Data Analyst"
);

create table public.job_title_aliases (
  id uuid primary key default gen_random_uuid(),
  job_title_id uuid not null references public.job_titles(id) on delete cascade,
  alias text not null                    -- e.g. "Business Analyst"
);
create index job_title_aliases_trgm_idx on public.job_title_aliases using gin (alias gin_trgm_ops);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  parent_id uuid references public.categories(id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  tag_type text not null check (tag_type in ('tool','domain','skill'))
);
create index tags_trgm_idx on public.tags using gin (name gin_trgm_ops);

-- Seed the four job-tracks + four practice-tracks already on the site
insert into public.job_titles (name) values
  ('Data Analyst'), ('Data Engineer'), ('Product Analyst'), ('Quality Analyst');

insert into public.job_title_aliases (job_title_id, alias)
  select id, alias from public.job_titles, (values
    ('Data Analyst', 'Business Analyst'),
    ('Data Analyst', 'Analytics Analyst'),
    ('Data Engineer', 'ETL Developer'),
    ('Data Engineer', 'Analytics Engineer'),
    ('Product Analyst', 'Product Data Analyst'),
    ('Quality Analyst', 'QA Analyst')
  ) as a(job_title, alias)
  where job_titles.name = a.job_title;

insert into public.tags (name, tag_type) values
  ('Python', 'tool'), ('SQL', 'tool'), ('Excel', 'tool'), ('Power BI', 'tool'),
  ('Logistics', 'domain'), ('Sales', 'domain'), ('Service', 'domain'),
  ('E-commerce', 'domain'), ('HR', 'domain'), ('Product', 'domain');

-- ============================================================
-- 3. FOLDERS + DATASETS
-- ============================================================
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  color_key text not null,               -- maps to existing .folder-analyst etc CSS classes
  view_type text not null check (view_type in ('job','practice')),
  sort_order int not null default 0
);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  slug text unique not null,
  title text not null,
  short_description text,
  long_description text,
  price numeric(10,2) not null default 0,
  is_free boolean not null default false,
  difficulty text check (difficulty in ('beginner','intermediate','hard')),
  storage_path text,                     -- path in Supabase Storage bucket
  created_at timestamptz not null default now(),
  search_vector tsvector
);

-- Each dataset's OWN column schema — this is what keeps datasets independent
-- of each other instead of forcing them into one shared table.
create table public.dataset_schema (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  column_name text not null,
  column_type text not null,
  description text,
  sort_order int not null default 0
);

-- Junctions: which job titles / categories / tags a dataset is relevant to
create table public.dataset_job_titles (
  dataset_id uuid references public.datasets(id) on delete cascade,
  job_title_id uuid references public.job_titles(id) on delete cascade,
  primary key (dataset_id, job_title_id)
);
create table public.dataset_categories (
  dataset_id uuid references public.datasets(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (dataset_id, category_id)
);
create table public.dataset_tags (
  dataset_id uuid references public.datasets(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (dataset_id, tag_id)
);

-- Same junction shape reused for a user's interested professions (multi-select at signup)
create table public.profile_job_titles (
  profile_id uuid references public.profiles(id) on delete cascade,
  job_title_id uuid references public.job_titles(id) on delete cascade,
  primary key (profile_id, job_title_id)
);

alter table public.folders enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_schema enable row level security;
alter table public.dataset_job_titles enable row level security;
alter table public.dataset_categories enable row level security;
alter table public.dataset_tags enable row level security;
alter table public.job_titles enable row level security;
alter table public.job_title_aliases enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.profile_job_titles enable row level security;

-- Public read on everything browsable; writes are service-role only (no policy = blocked for anon/authenticated)
create policy "Public read folders" on public.folders for select using (true);
create policy "Public read datasets" on public.datasets for select using (true);
create policy "Public read dataset_schema" on public.dataset_schema for select using (true);
create policy "Public read dataset_job_titles" on public.dataset_job_titles for select using (true);
create policy "Public read dataset_categories" on public.dataset_categories for select using (true);
create policy "Public read dataset_tags" on public.dataset_tags for select using (true);
create policy "Public read job_titles" on public.job_titles for select using (true);
create policy "Public read job_title_aliases" on public.job_title_aliases for select using (true);
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read tags" on public.tags for select using (true);

create policy "Users manage own interested professions"
  on public.profile_job_titles for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ============================================================
-- 4. PURCHASES (access/entitlement tracking — payment gateway plugs in later)
-- ============================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  price_paid numeric(10,2) not null,
  payment_ref text,
  purchased_at timestamptz not null default now(),
  unique (user_id, dataset_id)
);
alter table public.purchases enable row level security;

create policy "Users read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);
-- No insert policy for authenticated/anon — purchases are written by a
-- server-side function (service role) once payment is confirmed, so users
-- can never grant themselves free access by calling insert directly.

-- ============================================================
-- 5. SEARCH — full text + ontology, no AI/LLM involved
-- ============================================================

-- Keep each dataset's search_vector up to date automatically
create or replace function public.datasets_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.short_description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.long_description,'')), 'C');
  return new;
end
$$;

create trigger datasets_search_vector_trigger
  before insert or update on public.datasets
  for each row execute function public.datasets_search_vector_update();

create index datasets_search_vector_idx on public.datasets using gin (search_vector);

-- Main search function — call from the frontend via
--   supabase.rpc('search_datasets', { query: userInput })
create or replace function public.search_datasets(query text)
returns table (
  dataset_id uuid,
  title text,
  short_description text,
  slug text,
  score real
)
language sql stable as $$
  with matched_job_titles as (
    select distinct jt.id
    from public.job_titles jt
    left join public.job_title_aliases a on a.job_title_id = jt.id
    where similarity(jt.name, query) > 0.3
       or similarity(coalesce(a.alias,''), query) > 0.3
       or jt.name ilike '%' || query || '%'
       or a.alias ilike '%' || query || '%'
  ),
  matched_tags as (
    select id from public.tags
    where similarity(name, query) > 0.3 or name ilike '%' || query || '%'
  ),
  ontology_matches as (
    select d.id as dataset_id, 2.0 as boost
    from public.datasets d
    join public.dataset_job_titles djt on djt.dataset_id = d.id
    where djt.job_title_id in (select id from matched_job_titles)
    union
    select d.id as dataset_id, 1.5 as boost
    from public.datasets d
    join public.dataset_tags dtag on dtag.dataset_id = d.id
    where dtag.tag_id in (select id from matched_tags)
  ),
  text_matches as (
    select d.id as dataset_id, ts_rank(d.search_vector, plainto_tsquery('english', query)) as rank
    from public.datasets d
    where d.search_vector @@ plainto_tsquery('english', query)
  )
  select
    d.id, d.title, d.short_description, d.slug,
    (coalesce(max(om.boost), 0) + coalesce(max(tm.rank), 0))::real as score
  from public.datasets d
  left join ontology_matches om on om.dataset_id = d.id
  left join text_matches tm on tm.dataset_id = d.id
  where om.dataset_id is not null or tm.dataset_id is not null
  group by d.id, d.title, d.short_description, d.slug
  order by score desc
  limit 30;
$$;

-- ============================================================
-- Done. Next: Storage bucket "datasets" (create in Supabase dashboard,
-- Storage → New bucket → private) for the actual per-dataset data files,
-- gated by a signed-URL function that checks the purchases table.
-- ============================================================
