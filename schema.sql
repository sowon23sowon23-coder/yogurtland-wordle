-- Yogurtland Daily Word — Supabase schema
-- Run in the Supabase SQL editor. Safe to re-run: everything is IF NOT EXISTS / OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. Words: one row per play date. The answer never leaves the server.
-- ---------------------------------------------------------------------------
create table if not exists words (
  id            uuid primary key default gen_random_uuid(),
  word          text        not null check (word ~ '^[A-Z]{5}$'),
  play_date     date        not null unique,
  pairing_note  text,
  status        text        not null default 'scheduled'
                            check (status in ('draft', 'scheduled', 'live', 'closed')),
  created_at    timestamptz not null default now()
);

-- Stops the same answer being scheduled twice — repeat words get solved in one try.
create unique index if not exists words_word_unique on words (word);

-- ---------------------------------------------------------------------------
-- 2. Sessions: anonymous players. No personal data, ever.
--    The id is set as an httpOnly cookie on first visit.
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  streak        int         not null default 0,
  plays         int         not null default 0,
  wins          int         not null default 0,
  -- Phase 2: when Real Rewards linking lands, store the member id here.
  loyalty_member_id text
);

-- ---------------------------------------------------------------------------
-- 3. Games: one row per session per day. The unique index is what enforces
--    "one play per day" — do not rely on the client for this.
-- ---------------------------------------------------------------------------
create table if not exists games (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions (id) on delete cascade,
  word_id      uuid not null references words (id),
  play_date    date not null,
  guesses      jsonb not null default '[]'::jsonb,
  attempts     int  not null default 0,
  result       text not null default 'in_progress'
                    check (result in ('in_progress', 'win', 'loss')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  unique (session_id, play_date)
);

create index if not exists games_play_date_idx on games (play_date);
create index if not exists games_result_idx    on games (result);

-- ---------------------------------------------------------------------------
-- 4. Reward codes: the pool uploaded from the loyalty system.
--    Phase 1 hands these out. Phase 2 swaps this table for a Real Rewards API
--    call — nothing else in the app needs to change.
-- ---------------------------------------------------------------------------
create table if not exists reward_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  tier             text not null check (tier in ('free_topping', 'ten_percent')),
  status           text not null default 'available'
                        check (status in ('available', 'assigned', 'expired')),
  assigned_game_id uuid references games (id),
  assigned_at      timestamptz,
  expires_at       timestamptz,
  -- Filled in when the loyalty system reports the code as used. Phase 1 this
  -- arrives as a periodic CSV import; phase 2 it comes back from the API.
  redeemed_at      timestamptz,
  uploaded_at      timestamptz not null default now(),
  batch_label      text
);

-- Partial index: the claim query only ever scans available rows.
create index if not exists reward_codes_available_idx
  on reward_codes (tier) where status = 'available';

-- ---------------------------------------------------------------------------
-- 5. Claiming a code. SKIP LOCKED means two simultaneous winners can never be
--    handed the same code, and neither request waits on the other.
-- ---------------------------------------------------------------------------
create or replace function claim_reward_code(p_game_id uuid, p_tier text)
returns table (code text, expires_at timestamptz)
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- Already claimed for this game? Return the same code, don't burn another.
  select rc.id into v_id
  from reward_codes rc
  where rc.assigned_game_id = p_game_id
  limit 1;

  if v_id is null then
    select rc.id into v_id
    from reward_codes rc
    where rc.status = 'available'
      and rc.tier = p_tier
      and (rc.expires_at is null or rc.expires_at > now())
    order by rc.uploaded_at
    for update skip locked
    limit 1;
  end if;

  if v_id is null then
    -- Pool is empty. The caller shows the "rewards are gone for today" screen.
    return;
  end if;

  update reward_codes rc
     set status           = 'assigned',
         assigned_game_id = p_game_id,
         assigned_at      = now()
   where rc.id = v_id;

  return query
    select rc.code, rc.expires_at from reward_codes rc where rc.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dashboard views.
-- ---------------------------------------------------------------------------
create or replace view v_daily_stats as
select
  g.play_date,
  w.word,
  count(*)                                          as plays,
  count(*) filter (where g.result = 'win')          as wins,
  round(100.0 * count(*) filter (where g.result = 'win')
        / nullif(count(*) filter (where g.result <> 'in_progress'), 0), 1) as win_rate,
  round(avg(g.attempts) filter (where g.result = 'win'), 1) as avg_tries
from games g
join words w on w.id = g.word_id
group by g.play_date, w.word
order by g.play_date desc;

-- The number the marketing report is actually about.
create or replace view v_funnel as
select
  g.play_date,
  count(*)                                                   as opened,
  count(*) filter (where g.result <> 'in_progress')           as finished,
  count(rc.id)                                                as codes_issued,
  count(rc.id) filter (where rc.status = 'assigned'
                         and rc.redeemed_at is not null)      as redeemed
from games g
left join reward_codes rc on rc.assigned_game_id = g.id
group by g.play_date
order by g.play_date desc;

-- ---------------------------------------------------------------------------
-- 7. Lock everything down.
--    The browser never talks to these tables. Next.js route handlers use the
--    service role key server-side; the anon key gets nothing. This is what
--    keeps today's answer off the client.
-- ---------------------------------------------------------------------------
alter table words        enable row level security;
alter table sessions     enable row level security;
alter table games        enable row level security;
alter table reward_codes enable row level security;
-- No policies are created on purpose: with RLS on and no policy, anon and
-- authenticated roles are denied everything. Add admin policies only if you
-- later point the admin UI straight at Supabase instead of your API routes.
