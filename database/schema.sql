-- Cicada2137 backend schema.
-- Applied to the linked Supabase project on 2026-11-05.
create table if not exists public.cicada_puzzles (
  id integer primary key check (id between 1 and 3),
  title text not null,
  riddle_html text not null,
  passcode_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cicada_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 50),
  unlocked_through integer not null default 1 check (unlocked_through between 1 and 4),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.cicada_completions (
  participant_id uuid not null references public.cicada_participants(id) on delete cascade,
  puzzle_id integer not null references public.cicada_puzzles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (participant_id, puzzle_id)
);

create index if not exists cicada_participants_created_at_idx
  on public.cicada_participants (created_at desc);
create index if not exists cicada_completions_puzzle_id_idx
  on public.cicada_completions (puzzle_id, completed_at desc);

insert into public.cicada_puzzles (id, title, riddle_html)
values
  (1, 'Find The Number', '<p>Out of the right corner of my <strong>EYE</strong>, i saw a number not too <strong>HIGH</strong></p><p>When through my checque, i bought a single <strong>CHOCOPIE</strong>, there i saw it, painted in red, i won''t <strong>LIE</strong></p>'),
  (2, 'Enter What You Found Upon Searching Through The Something Described Below', '<p>When it''s the first school of the <strong>DAY</strong>, something right outside the world of wisdom points to something, they <strong>SAY</strong>; All i can say is let your <strong>WAY</strong> be guided by the <strong>SUNRAY</strong>.</p>'),
  (3, 'Enter What You Found Upon Searching Through The Something Described Below', '<p>After 22 years of <strong>GLOOM</strong>, its about to go <strong>BOOM</strong>, But the two similar things that used to be the cause of <strong>DOOM</strong>, now lay still near some bright stairs, after all the danger they once used to <strong>LOOM</strong>.</p>')
on conflict (id) do nothing;

alter table public.cicada_puzzles enable row level security;
alter table public.cicada_participants enable row level security;
alter table public.cicada_completions enable row level security;

revoke all on table public.cicada_puzzles from anon, authenticated;
revoke all on table public.cicada_participants from anon, authenticated;
revoke all on table public.cicada_completions from anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.cicada_puzzles to service_role;
grant all on table public.cicada_participants to service_role;
grant all on table public.cicada_completions to service_role;
