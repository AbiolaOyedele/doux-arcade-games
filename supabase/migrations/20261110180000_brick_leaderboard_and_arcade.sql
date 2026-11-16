-- Brick Breaker (Doux browser game): public leaderboard, plus the Doux Arcade board that combines both games.
-- Same shape and rules as coinrun_scores: players do not sign in, and the browser can add a score and read, nothing else.

create table public.brick_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null
    check (char_length(player_name) between 2 and 16 and player_name ~ '^[A-Za-z0-9 _-]+$'),
  score integer not null check (score between 1 and 1000000),
  level integer not null check (level between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brick_scores is
  'Brick Breaker game (Doux): one row per finished game. Insert-only from the public game page; no updates or deletes from the browser.';
comment on column public.brick_scores.player_name is 'Name the player typed in. Not an account; not unique.';

create index brick_scores_score_idx on public.brick_scores (score desc);

alter table public.brick_scores enable row level security;

create policy "brick_scores_public_read" on public.brick_scores
  for select to anon, authenticated using (true);

create policy "brick_scores_public_insert" on public.brick_scores
  for insert to anon, authenticated with check (true);

revoke all on public.brick_scores from anon, authenticated;
grant select, insert on public.brick_scores to anon, authenticated;

-- Each player's best game only, highest first.
create view public.brick_leaderboard with (security_invoker = true) as
  select player_name, score, level
  from (
    select distinct on (lower(player_name)) player_name, score, level
    from public.brick_scores
    order by lower(player_name), score desc
  ) best_per_player
  order by score desc
  limit 100;

comment on view public.brick_leaderboard is 'Brick Breaker game (Doux): best score per player name, top 100.';

grant select on public.brick_leaderboard to anon, authenticated;

-- Doux Arcade: a player's best in each game added together. Players are matched by name, ignoring case.
create view public.arcade_leaderboard with (security_invoker = true) as
  with coin as (
    select lower(player_name) as name_key, max(player_name) as player_name, max(score) as best
    from public.coinrun_scores group by 1
  ), brick as (
    select lower(player_name) as name_key, max(player_name) as player_name, max(score) as best
    from public.brick_scores group by 1
  )
  select coalesce(coin.player_name, brick.player_name) as player_name,
         coalesce(coin.best, 0) as coin_run,
         coalesce(brick.best, 0) as brick_breaker,
         coalesce(coin.best, 0) + coalesce(brick.best, 0) as total
  from coin full join brick on coin.name_key = brick.name_key
  order by total desc
  limit 100;

comment on view public.arcade_leaderboard is 'Doux Arcade: Coin Run best plus Brick Breaker best per player name, top 100.';

grant select on public.arcade_leaderboard to anon, authenticated;
