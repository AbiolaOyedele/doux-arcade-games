-- Coin Run (Doux browser game): public leaderboard.
-- Everything here is prefixed coinrun_ so it is easy to tell apart from other tables in a shared project.
-- Players do not sign in. The browser can add a score and read the board, nothing else.

create table public.coinrun_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null
    check (char_length(player_name) between 2 and 16 and player_name ~ '^[A-Za-z0-9 _-]+$'),
  score integer not null check (score between 1 and 500000),
  level integer not null check (level between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.coinrun_scores is
  'Coin Run game (Doux): one row per finished run. Insert-only from the public game page; no updates or deletes from the browser.';
comment on column public.coinrun_scores.player_name is 'Name the player typed in. Not an account; not unique.';

create index coinrun_scores_score_idx on public.coinrun_scores (score desc);

alter table public.coinrun_scores enable row level security;

-- Default is deny all. Open exactly two things to the public game page: read, and add a row.
-- The column checks above are what keep bad rows out; there is no update or delete policy, so rows cannot be changed.
create policy "coinrun_scores_public_read" on public.coinrun_scores
  for select to anon, authenticated using (true);

create policy "coinrun_scores_public_insert" on public.coinrun_scores
  for insert to anon, authenticated with check (true);

revoke all on public.coinrun_scores from anon, authenticated;
grant select, insert on public.coinrun_scores to anon, authenticated;

-- Each player's best run only, highest first. security_invoker makes the view obey the table's policies.
create view public.coinrun_leaderboard with (security_invoker = true) as
  select player_name, score, level
  from (
    select distinct on (lower(player_name)) player_name, score, level
    from public.coinrun_scores
    order by lower(player_name), score desc
  ) best_per_player
  order by score desc
  limit 100;

comment on view public.coinrun_leaderboard is 'Coin Run game (Doux): best score per player name, top 100.';

grant select on public.coinrun_leaderboard to anon, authenticated;
