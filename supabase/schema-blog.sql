-- KOJOH: Blog (Admin -> Blog). Run once in the Supabase SQL editor. Safe to run again.
-- Anyone can read published posts (no login). Only admins can write, see drafts or upload images.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 90),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  description text not null default '' check (char_length(description) <= 200),   -- the grey line under the title on Google
  body_md text not null default '',
  cover_url text,
  cover_alt text,
  project_slug text,                       -- the project this post sends readers to (optional)
  tags text[] not null default '{}',
  author text not null default 'KOJOH team',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_pub on public.blog_posts (status, published_at desc);

create or replace function public.blog_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists blog_touch on public.blog_posts;
create trigger blog_touch before insert or update on public.blog_posts for each row execute function public.blog_touch();

alter table public.blog_posts enable row level security;
drop policy if exists "blog public read published" on public.blog_posts;
create policy "blog public read published" on public.blog_posts for select using (status = 'published' or public.is_admin());
drop policy if exists "blog admin write" on public.blog_posts;
create policy "blog admin write" on public.blog_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- public image bucket for covers and pictures inside posts
insert into storage.buckets (id, name, public) values ('blog', 'blog', true)
on conflict (id) do update set public = true;
drop policy if exists "blog images public read" on storage.objects;
create policy "blog images public read" on storage.objects for select using (bucket_id = 'blog');
drop policy if exists "blog images admin write" on storage.objects;
create policy "blog images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'blog' and public.is_admin());
drop policy if exists "blog images admin update" on storage.objects;
create policy "blog images admin update" on storage.objects for update to authenticated using (bucket_id = 'blog' and public.is_admin());
drop policy if exists "blog images admin delete" on storage.objects;
create policy "blog images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'blog' and public.is_admin());
