-- Diary for Language — Supabase schema
-- Run this once in the Supabase SQL editor (or via the CLI) for a new project.

create extension if not exists pgcrypto;

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  content text not null default '',
  stamp_kind text not null default 'keyword' check (stamp_kind in ('photo', 'keyword')),
  stamp_key text,
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'failed')),
  overall_comment text,
  suggestions jsonb not null default '[]'::jsonb,
  readings jsonb not null default '[]'::jsonb,
  paragraphs jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- Safe to re-run against an existing table created before these columns
-- existed (e.g. an already-deployed project) — these lines alone are
-- enough, no need to drop/recreate the table.
alter table public.diary_entries add column if not exists readings jsonb not null default '[]'::jsonb;
-- Each paragraph as its own timestamped entry — {text, comment,
-- suggestions, readings, savedAt} — so a day's entry can be reopened and
-- added to later while still showing how it grew across sittings. An
-- entry saved before this column existed just has an empty array; the
-- review screen falls back to showing its `content` as one untimed block.
alter table public.diary_entries add column if not exists paragraphs jsonb not null default '[]'::jsonb;

create index if not exists diary_entries_user_month_idx
  on public.diary_entries (user_id, entry_date);

alter table public.diary_entries enable row level security;

drop policy if exists "select own entries" on public.diary_entries;
create policy "select own entries" on public.diary_entries
  for select using (auth.uid() = user_id);

drop policy if exists "insert own entries" on public.diary_entries;
create policy "insert own entries" on public.diary_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own entries" on public.diary_entries;
create policy "update own entries" on public.diary_entries
  for update using (auth.uid() = user_id);

drop policy if exists "delete own entries" on public.diary_entries;
create policy "delete own entries" on public.diary_entries
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_diary_entries_updated_at on public.diary_entries;
create trigger trg_diary_entries_updated_at
  before update on public.diary_entries
  for each row execute procedure public.set_updated_at();

-- Storage bucket for the cropped photo stamps (public read; write is
-- restricted to the owner's own folder, keyed by user id).
insert into storage.buckets (id, name, public)
values ('diary-photos', 'diary-photos', true)
on conflict (id) do nothing;

drop policy if exists "diary photos public read" on storage.objects;
create policy "diary photos public read" on storage.objects
  for select using (bucket_id = 'diary-photos');

drop policy if exists "diary photos own write" on storage.objects;
create policy "diary photos own write" on storage.objects
  for insert with check (
    bucket_id = 'diary-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "diary photos own update" on storage.objects;
create policy "diary photos own update" on storage.objects
  for update using (
    bucket_id = 'diary-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "diary photos own delete" on storage.objects;
create policy "diary photos own delete" on storage.objects
  for delete using (
    bucket_id = 'diary-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage bucket for custom keyword-stamp icon overrides (public read).
-- Upload a file named "<stamp id>.<png|jpg|jpeg|webp>" (e.g. "rain.png")
-- to swap that keyword's built-in line-art icon for your own image — no
-- code change needed, see src/components/stamps/KeywordIcon.tsx.
insert into storage.buckets (id, name, public)
values ('stamp-icons', 'stamp-icons', true)
on conflict (id) do nothing;

drop policy if exists "stamp icons public read" on storage.objects;
create policy "stamp icons public read" on storage.objects
  for select using (bucket_id = 'stamp-icons');

drop policy if exists "stamp icons authenticated write" on storage.objects;
create policy "stamp icons authenticated write" on storage.objects
  for insert with check (bucket_id = 'stamp-icons' and auth.role() = 'authenticated');

drop policy if exists "stamp icons authenticated update" on storage.objects;
create policy "stamp icons authenticated update" on storage.objects
  for update using (bucket_id = 'stamp-icons' and auth.role() = 'authenticated');

drop policy if exists "stamp icons authenticated delete" on storage.objects;
create policy "stamp icons authenticated delete" on storage.objects
  for delete using (bucket_id = 'stamp-icons' and auth.role() = 'authenticated');

-- Optional: enable Realtime updates on this table (Database → Replication)
-- if you want instant hanko-stamp toasts instead of the client's polling
-- fallback. Uncomment if your project doesn't already publish it:
-- alter publication supabase_realtime add table public.diary_entries;
