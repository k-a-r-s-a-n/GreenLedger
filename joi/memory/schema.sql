-- Joi memory schema (Neon Postgres).
-- NOTE: the bot auto-applies this on boot (see bot/memory.py DDL), so you normally
-- never need to run it by hand. Kept here as documentation + manual fallback
-- (Neon dashboard -> SQL Editor -> paste -> Run).
create table if not exists joi_notes(
  id serial primary key, user_id bigint not null,
  kind text not null default 'note', body text not null,
  created_at timestamptz not null default now());
create table if not exists joi_profile(
  key text primary key, value text not null,
  updated_at timestamptz not null default now());
create table if not exists joi_pending(
  id serial primary key, user_id bigint not null, action text not null,
  payload jsonb not null default '{}', status text not null default 'pending',
  created_at timestamptz not null default now());
create index if not exists idx_notes_user_time on joi_notes(user_id, created_at desc);
create index if not exists idx_pending_user on joi_pending(user_id, status);
