-- Doux Arcade: one player name across every game, and no two players can share it (ignoring case).
-- There is no sign-in. Each browser makes a random secret key, kept in a cookie that every *.whstd.com game can read.
-- The database stores only a hash of that key, and links the name to it. Whoever holds the key owns the name.
-- The browser can no longer write to the score tables directly: it goes through arcade_submit_score, which looks the
-- player up by key, so nobody can post scores under someone else's name.

create table public.arcade_players (
  id uuid primary key default gen_random_uuid(),
  player_name text not null
    check (char_length(player_name) between 2 and 16 and player_name ~ '^[A-Za-z0-9 _-]+$'),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.arcade_players is
  'Doux Arcade: one row per player name. token_hash is a SHA-256 of the secret key in the player''s browser; it is never readable from the browser.';

create unique index arcade_players_name_key on public.arcade_players (lower(player_name));

alter table public.arcade_players enable row level security;

-- The page may read names (for the leaderboards) but never token_hash: the column grant below leaves it out.
create policy "arcade_players_public_read" on public.arcade_players
  for select to anon, authenticated using (true);

revoke all on public.arcade_players from anon, authenticated;
grant select (id, player_name) on public.arcade_players to anon, authenticated;

-- Scores now belong to a player. Names already on the board become players with no key ("legacy:" in place of a
-- hash); the first browser to claim one of those names takes it over, scores included.
drop view public.arcade_leaderboard;
drop view public.coinrun_leaderboard;
drop view public.brick_leaderboard;

insert into public.arcade_players (player_name, token_hash)
select distinct on (lower(player_name)) player_name, 'legacy:' || gen_random_uuid()
from (
  select player_name, created_at from public.coinrun_scores
  union all
  select player_name, created_at from public.brick_scores
) earlier
order by lower(player_name), created_at desc;

alter table public.coinrun_scores
  add column player_id uuid references public.arcade_players (id) on delete cascade;
alter table public.brick_scores
  add column player_id uuid references public.arcade_players (id) on delete cascade;
update public.coinrun_scores s set player_id = p.id from public.arcade_players p where lower(p.player_name) = lower(s.player_name);
update public.brick_scores s set player_id = p.id from public.arcade_players p where lower(p.player_name) = lower(s.player_name);
alter table public.coinrun_scores alter column player_id set not null;
alter table public.brick_scores alter column player_id set not null;
create index coinrun_scores_player_idx on public.coinrun_scores (player_id);
create index brick_scores_player_idx on public.brick_scores (player_id);

comment on column public.coinrun_scores.player_name is 'The player''s name when the score was posted. The leaderboards show the current name from arcade_players.';
comment on column public.brick_scores.player_name is 'The player''s name when the score was posted. The leaderboards show the current name from arcade_players.';

drop policy "coinrun_scores_public_insert" on public.coinrun_scores;
drop policy "brick_scores_public_insert" on public.brick_scores;
revoke insert on public.coinrun_scores from anon, authenticated;
revoke insert on public.brick_scores from anon, authenticated;

-- Each player's best run only, highest first, under their current name.
create view public.coinrun_leaderboard with (security_invoker = true) as
  select p.player_name, best.score, best.level
  from (
    select distinct on (player_id) player_id, score, level
    from public.coinrun_scores
    order by player_id, score desc
  ) best
  join public.arcade_players p on p.id = best.player_id
  order by best.score desc
  limit 100;

create view public.brick_leaderboard with (security_invoker = true) as
  select p.player_name, best.score, best.level
  from (
    select distinct on (player_id) player_id, score, level
    from public.brick_scores
    order by player_id, score desc
  ) best
  join public.arcade_players p on p.id = best.player_id
  order by best.score desc
  limit 100;

create view public.arcade_leaderboard with (security_invoker = true) as
  with coin as (
    select player_id, max(score) as best from public.coinrun_scores group by player_id
  ), brick as (
    select player_id, max(score) as best from public.brick_scores group by player_id
  )
  select p.player_name,
         coalesce(coin.best, 0) as coin_run,
         coalesce(brick.best, 0) as brick_breaker,
         coalesce(coin.best, 0) + coalesce(brick.best, 0) as total
  from public.arcade_players p
  left join coin on coin.player_id = p.id
  left join brick on brick.player_id = p.id
  where coin.best is not null or brick.best is not null
  order by total desc
  limit 100;

comment on view public.coinrun_leaderboard is 'Coin Run game (Doux): best score per player, top 100.';
comment on view public.brick_leaderboard is 'Brick Breaker game (Doux): best score per player, top 100.';
comment on view public.arcade_leaderboard is 'Doux Arcade: Coin Run best plus Brick Breaker best per player, top 100.';

grant select on public.coinrun_leaderboard, public.brick_leaderboard, public.arcade_leaderboard to anon, authenticated;

-- The name that belongs to this browser's key, or null if it has not claimed one.
create function public.arcade_whoami(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select player_name from public.arcade_players
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Claim a name for this browser's key, or rename it. Returns ok, taken, bad_name or bad_token.
-- A name left over from before arcade names ("legacy:" key) goes to the first browser without a name that claims it.
create function public.arcade_claim_name(p_token text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_hash text;
  v_me uuid;
  v_owner uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    return 'bad_token';
  end if;
  if char_length(v_name) not between 2 and 16 or v_name !~ '^[A-Za-z0-9 _-]+$' then
    return 'bad_name';
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select id into v_me from public.arcade_players where token_hash = v_hash;
  select id into v_owner from public.arcade_players where lower(player_name) = lower(v_name);
  if v_owner is not null and v_me is null
     and (select token_hash from public.arcade_players where id = v_owner) like 'legacy:%' then
    update public.arcade_players set player_name = v_name, token_hash = v_hash, updated_at = now() where id = v_owner;
    return 'ok';
  end if;
  if v_owner is not null and v_owner is distinct from v_me then
    return 'taken';
  end if;
  if v_me is null then
    insert into public.arcade_players (player_name, token_hash) values (v_name, v_hash);
  else
    update public.arcade_players set player_name = v_name, updated_at = now() where id = v_me;
  end if;
  return 'ok';
exception
  when unique_violation then
    return 'taken';   -- someone claimed it a moment earlier
end;
$$;

-- Post a finished game's score under this browser's name. Returns ok, no_player, bad_game or bad_score.
create function public.arcade_submit_score(p_token text, p_game text, p_score integer, p_level integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  select id, player_name into v_id, v_name from public.arcade_players
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if v_id is null then
    return 'no_player';
  end if;
  if p_game = 'coin_run' then
    insert into public.coinrun_scores (player_id, player_name, score, level) values (v_id, v_name, p_score, p_level);
  elsif p_game = 'brick_breaker' then
    insert into public.brick_scores (player_id, player_name, score, level) values (v_id, v_name, p_score, p_level);
  else
    return 'bad_game';
  end if;
  return 'ok';
exception
  when check_violation or not_null_violation then
    return 'bad_score';
end;
$$;

revoke all on function public.arcade_whoami(text) from public;
revoke all on function public.arcade_claim_name(text, text) from public;
revoke all on function public.arcade_submit_score(text, text, integer, integer) from public;
grant execute on function public.arcade_whoami(text) to anon, authenticated;
grant execute on function public.arcade_claim_name(text, text) to anon, authenticated;
grant execute on function public.arcade_submit_score(text, text, integer, integer) to anon, authenticated;
