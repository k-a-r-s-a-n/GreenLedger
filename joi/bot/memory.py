"""Neon Postgres memory: dated notes, profile facts, pending confirmations."""

import asyncio
import logging
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

log = logging.getLogger("joi.memory")

DDL = """
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
"""

_pool: asyncpg.Pool | None = None


def _dsn() -> str:
    raw = os.environ.get("DATABASE_URL", "")
    parts = urlsplit(raw)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() != "channel_binding"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def init_db() -> bool:
    """Connect + ensure tables. Returns True when memory is online."""
    global _pool
    if _pool is not None:
        return True
    if not os.environ.get("DATABASE_URL"):
        log.warning("DATABASE_URL not set — running without memory")
        return False
    _pool = await asyncpg.create_pool(_dsn(), min_size=1, max_size=3)
    async with _pool.acquire() as conn:
        await conn.execute(DDL)
    log.info("Neon memory online, tables ensured")
    return True


def ready() -> bool:
    return _pool is not None


async def add_note(user_id: int, kind: str, body: str) -> None:
    async with _pool.acquire() as conn:
        await conn.execute(
            "insert into joi_notes(user_id, kind, body) values($1, $2, $3)",
            user_id, kind, body[:2000],
        )


async def get_memory_context(user_id: int, facts: int = 25, chats: int = 12) -> str:
    """Builds the MEMORY CONTEXT block injected into the brain prompt."""
    async def _q(sql, *args):
        async with _pool.acquire() as conn:
            return await conn.fetch(sql, *args)

    prof, fact_rows, chat_rows = await asyncio.gather(
        _q("select key, value from joi_profile order by key"),
        _q("select body, created_at from joi_notes where user_id=$1 and kind='fact'"
           " order by created_at desc limit $2", user_id, facts),
        _q("select body, created_at from joi_notes where user_id=$1 and kind='chat'"
           " order by created_at desc limit $2", user_id, chats))
    lines = []
    if prof:
        lines.append("PROFILE: " + "; ".join(f"{r['key']}={r['value']}" for r in prof))
    for r in reversed(fact_rows):
        lines.append(f"FACT [{r['created_at']:%Y-%m-%d}]: {r['body']}")
    for r in reversed(chat_rows):
        lines.append(f"CHAT [{r['created_at']:%Y-%m-%d %H:%M}]: {r['body']}")
    return "\n".join(lines) if lines else "(no memories yet)"


async def get_recent_facts(user_id: int, limit: int = 10) -> list[str]:
    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            "select body from joi_notes where user_id=$1 and kind='fact'"
            " order by created_at desc limit $2", user_id, limit)
    return [r["body"] for r in rows]


async def add_pending(user_id: int, action: str, detail: str) -> int:
    async with _pool.acquire() as conn:
        pid = await conn.fetchval(
            "insert into joi_pending(user_id, action, payload) values($1, $2, $3) returning id",
            user_id, action, {"detail": detail})
    return int(pid)


async def set_pending_status(pid: int, status: str) -> None:
    async with _pool.acquire() as conn:
        await conn.execute("update joi_pending set status=$1 where id=$2", status, pid)


async def get_pending(pid: int) -> dict:
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            "select action, payload, status from joi_pending where id=$1", pid)
    if not row:
        return {}
    payload = row["payload"] or {}
    if isinstance(payload, str):
        import json
        payload = json.loads(payload)
    return {"action": row["action"], "detail": payload.get("detail", ""),
            "status": row["status"]}
