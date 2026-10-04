-- ThereYouAreJesus member accounts. Run once in Supabase: SQL Editor > New query > paste > Run.

-- Membership level for each email address, kept up to date by Memberful (via /api/memberful/webhook).
create table if not exists public.memberships (
  email text primary key,
  tier text not null default 'free' check (tier in ('free', 'passion', 'devout')),
  updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
-- Signed-in people can see their own level, nothing else. Only the server (service key) can change it.
create policy "read own membership" on public.memberships
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Bible study: highlights, notes and saved verses. One row per person per verse.
create table if not exists public.bible_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  verse_key text not null,          -- book.chapter.verse, e.g. 42.3.16 (book is 0-based: 42 = John)
  label text not null,              -- e.g. John 3:16
  verse_text text not null default '',
  note text not null default '',
  highlight text not null default '' check (highlight in ('', 'gold', 'blue', 'green', 'rose')),
  saved boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, verse_key)
);
alter table public.bible_notes enable row level security;

create or replace function public.is_study_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where lower(email) = lower(auth.jwt() ->> 'email') and tier in ('passion', 'devout')
  );
$$;

create policy "read own notes" on public.bible_notes for select using (user_id = auth.uid());
create policy "members add notes" on public.bible_notes for insert with check (user_id = auth.uid() and public.is_study_member());
create policy "members edit notes" on public.bible_notes for update using (user_id = auth.uid() and public.is_study_member());
create policy "delete own notes" on public.bible_notes for delete using (user_id = auth.uid());
