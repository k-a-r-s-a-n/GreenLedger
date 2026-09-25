"""Joi — Phase 2+3: owner-gated Telegram bot, Gemini brain, Neon memory,
MacroDroid phone actions (call/alarm) via webhook.

Runs webhook mode on Render (RENDER_EXTERNAL_URL set) else polling locally.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from time import monotonic

import httpx
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from .brain import chat as brain_chat, transcribe as brain_transcribe
from .memory import (
    add_note,
    add_pending,
    get_contacts,
    get_memory_context,
    get_pending,
    get_profile_value,
    get_recent_alarms,
    get_recent_facts,
    init_db,
    ready as db_ready,
    set_pending_status,
    set_profile,
)
from .persona import SYSTEM_PROMPT

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
log = logging.getLogger("joi")

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
OWNER_ID = int(os.environ.get("OWNER_TELEGRAM_ID", "0") or 0)
PORT = int(os.environ.get("PORT", "10000"))
RENDER_URL = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
MACRODROID_CALL_URL = os.environ.get("MACRODROID_CALL_URL", "")
MACRODROID_ALARM_URL = os.environ.get("MACRODROID_ALARM_URL", "")
IST = timedelta(hours=5, minutes=30)
IST_TZ = timezone(IST)

HELP = (
    "Hey, I'm *Joi* 💛\n\n"
    "Just talk to me — text or voice notes, Tanglish welcome.\n\n"
    "Commands:\n"
    "/remember <fact> — save something forever (e.g. /remember my DBMS exam is Oct 14)\n"
    "/contact <name> — teach me a call nickname (e.g. /contact Saju)\n"
    "/memory — show what I remember about you\n"
    "/whoami — show your Telegram ID\n\n"
    "For calls, alarms, apps and mail I'll always ask you to tap Yes first. ✅"
)

MODULE_NOT_WIRED = {
    "open_app": "opening laptop apps (Phase 4, laptop worker)",
    "mail": "sending mail (Phase 4, laptop worker)",
}
ACTION_LABEL = {"call": "📞 call", "alarm": "⏰ alarm",
                "open_app": "💻 open app", "mail": "✉️ mail"}


def _is_owner(update: Update) -> bool:
    user = update.effective_user
    return bool(user) and OWNER_ID != 0 and user.id == OWNER_ID


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception as exc:
        log.warning("memory op failed: %s", str(exc)[:160])
        return default


def _now_ist() -> datetime:
    return datetime.now(IST_TZ)


def parse_brain(raw: str) -> tuple[str, str, str, str]:
    """Split model output into (reply, action, detail, mem). Lenient by design."""
    reply_lines: list[str] = []
    action, detail, mem = "none", "", ""
    section = "reply" if "REPLY:" not in raw else None
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("REPLY:"):
            section = "reply"
            rest = stripped[len("REPLY:"):].strip()
            if rest:
                reply_lines.append(rest)
        elif stripped.startswith("ACTION:"):
            section = None
            action = stripped[len("ACTION:"):].strip().lower() or "none"
        elif stripped.startswith("DETAIL:"):
            section = None
            detail = stripped[len("DETAIL:"):].strip()
        elif stripped.startswith("MEM:"):
            section = None
            mem = stripped[len("MEM:"):].strip()
        elif section == "reply":
            reply_lines.append(line)
    reply = "\n".join(reply_lines).strip() or raw.strip()
    if action not in ("none", "call", "alarm", "open_app", "mail", "list_alarms", "delete_alarm"):
        action = "none"
    return reply, action, detail, mem


def _parse_detail(detail: str) -> dict:
    """'text=call Amma | time=2026-09-26 19:00' -> {text:..., time:...}"""
    out: dict[str, str] = {}
    for part in detail.split("|"):
        if "=" in part:
            key, _, value = part.partition("=")
            out[key.strip().lower()] = value.strip()
    return out


def _alarm_error(detail: str) -> str:
    """Validate alarm DETAIL. Returns '' when OK, else a human-readable problem."""
    d = _parse_detail(detail)
    if not d.get("text"):
        return "what should the alarm say?"
    try:
        when = datetime.strptime(d.get("time", ""), "%Y-%m-%d %H:%M").replace(tzinfo=IST_TZ)
    except ValueError:
        return "what exact date/time? (e.g. today 7pm, tomorrow 6am)"
    if when <= _now_ist():
        return f"that time ({d['time']}) already passed — which day/time did you mean?"
    if (when.date() - _now_ist().date()).days > 1:
        return "I can only set alarms for today or tomorrow right now (phone Clock limit) — pick a time within that?"
    return ""


async def _fire_webhook(url: str, payload: dict) -> bool:
    """POST to a MacroDroid webhook (query params + JSON body, belt & suspenders)."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, params=payload, json=payload)
        log.info("webhook -> %s %s", url.split("/")[2], resp.status_code)
        return 200 <= resp.status_code < 300
    except Exception as exc:
        log.warning("webhook failed: %s", str(exc)[:160])
        return False


async def _handle_text_message(user_text: str, user_id: int, reply) -> None:
    """Shared pipeline for typed text and transcribed voice. `reply` sends messages."""
    t0 = monotonic()
    context = await _safe(get_memory_context(user_id), "(memory offline)") \
        if db_ready() else "(memory offline)"
    ctx_s = monotonic() - t0
    prompt = (f"CURRENT TIME (Asia/Kolkata): {_now_ist():%Y-%m-%d %H:%M}\n"
              f"MEMORY CONTEXT:\n{context}\n\nHUMAN:\n{user_text}")
    try:
        raw, model = await brain_chat(SYSTEM_PROMPT, prompt)
        log.info("pipeline: ctx=%.1fs brain=%.1fs via %s (%d chars)",
                 ctx_s, monotonic() - t0 - ctx_s, model, len(raw))
    except Exception as exc:
        log.warning("brain failed: %s", str(exc)[:200])
        await reply("Aiyo, my brain glitched (Gemini error). Try again in a bit? 🛠️")
        return
    reply_text, action, detail, mem = parse_brain(raw)
    if action in ("list_alarms", "delete_alarm"):
        await _handle_alarm_query(user_id, action, detail, reply)
        if db_ready():
            asyncio.create_task(_safe(add_note(user_id, "chat", f"H: {user_text[:500]} / J: (alarm query)")))
        return
    if action == "alarm":
        err = _alarm_error(detail)
        if err:
            await reply(f"{reply_text}\n\n⏰ {err}")
            return
    if action == "none":
        await reply(reply_text)
        if db_ready():  # save AFTER replying so memory never slows the answer
            asyncio.create_task(_safe(add_note(
                user_id, "chat", f"H: {user_text[:500]} / J: {reply_text[:500]}")))
            if mem:
                asyncio.create_task(_safe(add_note(user_id, "fact", mem)))
        return
    pid = await _safe(add_pending(user_id, action, detail), 0) if db_ready() else 0
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("Yes ✅", callback_data=f"ok:{pid}:{action}"),
        InlineKeyboardButton("No ❌", callback_data=f"no:{pid}:{action}"),
    ]])
    await reply(f"{reply_text}\n\nConfirm {ACTION_LABEL[action]}?\n`{detail}`", buttons=keyboard)
    if db_ready():
        asyncio.create_task(_safe(add_note(
            user_id, "chat", f"H: {user_text[:500]} / J: {reply_text[:500]}")))
        if mem:
            asyncio.create_task(_safe(add_note(user_id, "fact", mem)))


async def _execute_phone_action(query, pid: int, action: str) -> None:
    """Approved call/alarm -> fire MacroDroid webhook on the user's phone."""
    pend = await _safe(get_pending(pid), None) if db_ready() else None
    detail = (pend or {}).get("detail", "") if isinstance(pend, dict) else ""
    if pend and pend.get("status") != "pending":
        await query.edit_message_text("Already handled this one. 👍")
        return
    d = _parse_detail(detail)
    if action == "call":
        nick = d.get("nickname") or d.get("name") or "?"
        if db_ready() and nick != "?":  # canonical spelling from /contact (case-proof)
            canon = await _safe(get_profile_value(f"contact:{nick.lower()}"), None)
            if canon:
                nick = canon
        if not MACRODROID_CALL_URL:
            await query.edit_message_text(
                "📞 MacroDroid call macro isn't linked yet — finish Phase 3 Android setup first. 🔧")
            return
        ok = await _fire_webhook(MACRODROID_CALL_URL, {"nickname": nick})
        if db_ready():
            await _safe(set_pending_status(pid, "approved"))
            await _safe(add_note(query.from_user.id, "call", f"CALL {nick}: {'sent' if ok else 'FAILED'}"))
        await query.edit_message_text(
            f"📞 Calling *{nick}* now — your phone is dialing."
            if ok else "📞 Aiyo, couldn't reach your phone. Is MacroDroid running with internet? Try again.",
            parse_mode="Markdown")
    elif action == "alarm":
        text = d.get("text", "Alarm")
        try:
            when = datetime.strptime(d.get("time", ""), "%Y-%m-%d %H:%M").replace(tzinfo=IST_TZ)
        except ValueError:
            await query.edit_message_text("⏰ That time didn't parse — tell me again (e.g. tomorrow 6am)?")
            return
        if not MACRODROID_ALARM_URL:
            await query.edit_message_text(
                "⏰ MacroDroid alarm macro isn't linked yet — finish Phase 3 Android setup first. 🔧")
            return
        ok = await _fire_webhook(MACRODROID_ALARM_URL, {
            "text": text, "time": d["time"],
            "hour": when.hour, "minute": when.minute,
            "day": when.day, "month": when.month, "year": when.year})
        if db_ready():
            await _safe(set_pending_status(pid, "approved"))
            if ok:
                await _safe(add_note(query.from_user.id, "alarm", f"{d['time']} | {text}"))
            else:
                await _safe(add_note(query.from_user.id, "note",
                                     f"ALARM FAILED '{text}' @ {d['time']}"))
        await query.edit_message_text(
            f"⏰ Alarm set for *{when:%b %d, %I:%M %p}* — it's a real phone alarm, fires even offline. 🔔"
            if ok else "⏰ Aiyo, couldn't reach your phone. Is MacroDroid running with internet? Try again.",
            parse_mode="Markdown")


async def _handle_alarm_query(user_id: int, action: str, detail: str, reply) -> None:
    """Read-only alarm list + delete guidance (Android blocks app-side deletion)."""
    if not db_ready():
        await reply("My memory is offline — can't pull your alarm list right now. 🧠💤")
        return
    alarms = await _safe(get_recent_alarms(user_id, 10), []) or []
    if action == "list_alarms":
        if not alarms:
            await reply("I haven't set any alarms yet. Say 'wake me up at 6am' and I'll set one. ⏰")
            return
        await reply("Alarms I've set:\n\n• " + "\n• ".join(alarms) +
                    "\n\nSay 'delete my 6am alarm' to remove one (I'll guide you — Android makes that a Clock-app job).")
        return
    d = _parse_detail(detail)
    needle = (d.get("text") or "").lower().strip()
    matches = alarms if not needle else [a for a in alarms if needle in a.lower()]
    if not matches:
        await reply("Couldn't find an alarm matching that. Here's what I have:\n\n• " +
                    ("\n• ".join(alarms) if alarms else "none yet") +
                    "\n\nTell me which one (e.g. 'delete the 6am one').")
        return
    await reply("Found:\n\n• " + "\n• ".join(matches[:3]) +
                "\n\nHonest bit: Android lets no app delete Clock alarms, so I can't remove it myself. "
                "Open your **Clock app → Alarms** and toggle it off (2 taps). Want a replacement? ⏰")


# ---- handlers ----

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return
    await update.message.reply_text(HELP, parse_mode="Markdown")


async def cmd_whoami(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id if update.effective_user else 0
    locked = "locked to you ✅" if uid == OWNER_ID and OWNER_ID else \
        "not locked yet — paste this number as OWNER_TELEGRAM_ID on Render 🔧"
    await update.message.reply_text(f"Your Telegram ID is `{uid}` — {locked}", parse_mode="Markdown")


async def cmd_remember(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return
    fact = " ".join(context.args).strip()
    if not fact:
        await update.message.reply_text("Usage: /remember <fact> — e.g. /remember my DBMS exam is Oct 14")
        return
    if not db_ready():
        await update.message.reply_text("My memory is offline right now — try again later? 🧠💤")
        return
    await _safe(add_note(update.effective_user.id, "fact", fact))
    await update.message.reply_text("Locked in, I won't forget. 💛")


async def cmd_memory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return
    if not db_ready():
        await update.message.reply_text("My memory is offline right now — try again later? 🧠💤")
        return
    facts = await _safe(get_recent_facts(update.effective_user.id), []) or []
    contacts = await _safe(get_contacts(), []) or []
    if facts:
        msg = "Here's what I remember about you:\n\n• " + "\n• ".join(facts)
    else:
        msg = "Nothing stored yet — tell me things with /remember and I'll keep them. 💛"
    if contacts:
        msg += "\n\n📞 Call contacts: " + ", ".join(contacts)
    await update.message.reply_text(msg)


async def cmd_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return
    name = " ".join(context.args).strip()
    if not name:
        await update.message.reply_text("Usage: /contact <nickname> — e.g. /contact Saju\n"
                                        "Run once per person after adding them in the MacroDroid call macro.")
        return
    if not db_ready():
        await update.message.reply_text("My memory is offline right now — try again later? 🧠💤")
        return
    await _safe(set_profile(f"contact:{name.lower()}", name))
    await update.message.reply_text(
        f"Got it — *{name}* is now a known contact. 💛\n"
        f"Make sure your MacroDroid `Joi Call` branch uses this exact spelling, then just say 'call {name}'.",
        parse_mode="Markdown")


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return

    async def reply(text: str, buttons=None) -> None:
        await update.message.reply_text(text, reply_markup=buttons, parse_mode="Markdown")

    await _handle_text_message(update.message.text or "", update.effective_user.id, reply)


async def on_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return

    async def reply(text: str, buttons=None) -> None:
        await update.message.reply_text(text, reply_markup=buttons, parse_mode="Markdown")

    try:
        tg_file = await update.message.voice.get_file()
        data = bytes(await tg_file.download_as_bytearray())
        heard = await brain_transcribe(data, "audio/ogg")
    except Exception as exc:
        log.warning("voice transcribe failed: %s", str(exc)[:160])
        await update.message.reply_text("Couldn't hear that clearly — try again? 🎙️")
        return
    await update.message.reply_text(f"🎧 Heard: _{heard}_", parse_mode="Markdown")
    await _handle_text_message(heard, update.effective_user.id, reply)


async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not _is_owner(update):
        if query:
            await query.answer()
        return
    await query.answer()
    _, pid, action = (query.data.split(":") + ["", ""])[:3]
    if query.data.startswith("no:"):
        if pid.isdigit() and int(pid) and db_ready():
            await _safe(set_pending_status(int(pid), "denied"))
        await query.edit_message_text("Cancelled, no problem. 👍")
        return
    if action in ("call", "alarm"):
        # Phone actions mark themselves approved AFTER executing (see _execute_phone_action)
        await _execute_phone_action(query, int(pid) if pid.isdigit() else 0, action)
        return
    if pid.isdigit() and int(pid) and db_ready():
        await _safe(set_pending_status(int(pid), "approved"))
    module = MODULE_NOT_WIRED.get(action, "that module")
    await query.edit_message_text(
        f"✅ Confirmed and logged! Honest heads-up: {module} gets wired in the next "
        f"phase, so nothing happened in the real world *yet*. I'm keeping the list. 💛",
        parse_mode="Markdown",
    )


async def _post_init(app: Application) -> None:
    try:
        ok = await init_db()
        log.info("boot check: database=%s", "ONLINE" if ok else "OFFLINE")
    except Exception as exc:
        log.warning("boot check: database=FAILED (%s)", str(exc)[:200])
    log.info("boot check: owner=%s", OWNER_ID if OWNER_ID else "NOT SET (only /whoami works)")
    log.info("boot check: phone actions: call=%s alarm=%s",
             "LINKED" if MACRODROID_CALL_URL else "not linked",
             "LINKED" if MACRODROID_ALARM_URL else "not linked")


def main() -> None:
    if not TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set.")
    app = Application.builder().token(TOKEN).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("whoami", cmd_whoami))
    app.add_handler(CommandHandler("remember", cmd_remember))
    app.add_handler(CommandHandler("memory", cmd_memory))
    app.add_handler(CommandHandler("contact", cmd_contact))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    app.add_handler(MessageHandler(filters.VOICE, on_voice))
    if RENDER_URL:
        log.info("starting in WEBHOOK mode on port %s", PORT)
        app.run_webhook(listen="0.0.0.0", port=PORT, url_path=TOKEN,
                        webhook_url=f"{RENDER_URL}/{TOKEN}")
    else:
        log.info("starting in POLLING mode (local dev)")
        app.run_polling()


if __name__ == "__main__":
    main()
