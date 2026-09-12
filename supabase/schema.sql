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
  stamps jsonb not null default '[]'::jsonb,
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
-- One stamp per writing session — {session, stampKind, stampKey,
-- photoPath, createdAt} — instead of one stamp for the whole day. Each
-- paragraph in `paragraphs` above also carries its own `session` number
-- (missing = 0) tying it to one of these. An entry saved before this
-- column existed just has an empty array; the calendar and review screen
-- both fall back to synthesizing a single stamp from
-- stamp_kind/stamp_key/photo_path in that case.
alter table public.diary_entries add column if not exists stamps jsonb not null default '[]'::jsonb;

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

-- Storage bucket for custom overrides of the app's own UI icons (public
-- read) — the settings gear, the camera icon, etc. Upload a file named
-- "<icon name>.<png|jpg|jpeg|webp|svg>" (e.g. "settings.png") to swap
-- that icon everywhere it's used — no code change needed, see
-- src/components/icons/UiIcon.tsx and src/lib/icons/useStorageImageOverride.ts.
insert into storage.buckets (id, name, public)
values ('ui-icons', 'ui-icons', true)
on conflict (id) do nothing;

drop policy if exists "ui icons public read" on storage.objects;
create policy "ui icons public read" on storage.objects
  for select using (bucket_id = 'ui-icons');

drop policy if exists "ui icons authenticated write" on storage.objects;
create policy "ui icons authenticated write" on storage.objects
  for insert with check (bucket_id = 'ui-icons' and auth.role() = 'authenticated');

drop policy if exists "ui icons authenticated update" on storage.objects;
create policy "ui icons authenticated update" on storage.objects
  for update using (bucket_id = 'ui-icons' and auth.role() = 'authenticated');

drop policy if exists "ui icons authenticated delete" on storage.objects;
create policy "ui icons authenticated delete" on storage.objects
  for delete using (bucket_id = 'ui-icons' and auth.role() = 'authenticated');

-- Vocabulary review ("단어장"): tracks whether the learner has marked a
-- reading (a kanji compound or katakana word, same shape as an entry's
-- `readings` column) as memorized, independent of which day(s) it
-- appeared on — the same word can resurface across many entries and
-- should share one memorized/not state rather than one per occurrence.
-- Keyed on `readings` rather than `suggestions`: a reading is always
-- exactly one word/term, where a suggestion can occasionally be a whole
-- corrected sentence — not what a vocabulary list should be built from.
create table if not exists public.word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  reading text not null,
  kind text not null check (kind in ('kanji', 'katakana')),
  memorized boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, text, reading)
);

-- Safe to re-run against an existing table (see the diary_entries columns
-- above for the same pattern) — how many times this word has been
-- correctly matched in 단어 테스트 (WordQuiz), cumulative across every
-- round ever played, not a consecutive streak. Once it crosses the
-- app's memorize threshold the client also sets `memorized` — this
-- column just needs to keep counting from there, never reset by a miss
-- or by `memorized` already being true.
alter table public.word_progress add column if not exists quiz_correct_count integer not null default 0;

create index if not exists word_progress_user_idx
  on public.word_progress (user_id);

alter table public.word_progress enable row level security;

drop policy if exists "select own word progress" on public.word_progress;
create policy "select own word progress" on public.word_progress
  for select using (auth.uid() = user_id);

drop policy if exists "insert own word progress" on public.word_progress;
create policy "insert own word progress" on public.word_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own word progress" on public.word_progress;
create policy "update own word progress" on public.word_progress
  for update using (auth.uid() = user_id);

drop policy if exists "delete own word progress" on public.word_progress;
create policy "delete own word progress" on public.word_progress
  for delete using (auth.uid() = user_id);

-- Reuses the same set_updated_at() trigger function diary_entries defines
-- above — already created by the time this table is (re-)created.
drop trigger if exists trg_word_progress_updated_at on public.word_progress;
create trigger trg_word_progress_updated_at
  before update on public.word_progress
  for each row execute procedure public.set_updated_at();

-- Optional: enable Realtime updates on this table (Database → Replication)
-- if you want instant hanko-stamp toasts instead of the client's polling
-- fallback. Uncomment if your project doesn't already publish it:
-- alter publication supabase_realtime add table public.diary_entries;
