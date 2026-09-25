"""Joi — Phase 2: owner-gated Telegram bot, Gemini brain, Neon memory.

Runs webhook mode on Render (RENDER_EXTERNAL_URL set) else polling locally.
Self-verifies on boot: logs DB + model status so Render logs prove health.
"""

import asyncio
import logging
import os

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
    get_memory_context,
    get_recent_facts,
    init_db,
    ready as db_ready,
    set_pending_status,
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

HELP = (
    "Hey, I'm *Joi* 💛\n\n"
    "Just talk to me — text or voice notes, Tanglish welcome.\n\n"
    "Commands:\n"
    "/remember <fact> — save something forever (e.g. /remember my DBMS exam is Oct 14)\n"
    "/memory — show what I remember about you\n"
    "/whoami — show your Telegram ID\n\n"
    "For calls, alarms, apps and mail I'll always ask you to tap Yes first. ✅"
)

MODULE_NOT_WIRED = {
    "call": "calling (Phase 3, Android side)",
    "alarm": "alarms (Phase 3, Android side)",
    "open_app": "opening laptop apps (Phase 4, laptop worker)",
    "mail": "sending mail (Phase 4, laptop worker)",
}


def _is_owner(update: Update) -> bool:
    user = update.effective_user
    return bool(user) and OWNER_ID != 0 and user.id == OWNER_ID


async def _safe(coro, default=None):
    try:
        return await coro
    except Exception as exc:
        log.warning("memory op failed: %s", str(exc)[:160])
        return default


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
    if action not in ("none", "call", "alarm", "open_app", "mail"):
        action = "none"
    return reply, action, detail, mem


async def _handle_text_message(user_text: str, user_id: int, reply) -> None:
    """Shared pipeline for typed text and transcribed voice. `reply` sends messages."""
    context = await _safe(get_memory_context(user_id), "(memory offline)") \
        if db_ready() else "(memory offline)"
    prompt = f"MEMORY CONTEXT:\n{context}\n\nHUMAN:\n{user_text}"
    try:
        raw, model = await brain_chat(SYSTEM_PROMPT, prompt)
        log.info("brain answered via %s (%d chars)", model, len(raw))
    except Exception as exc:
        log.warning("brain failed: %s", str(exc)[:200])
        await reply("Aiyo, my brain glitched (Gemini error). Try again in a bit? 🛠️")
        return
    reply_text, action, detail, mem = parse_brain(raw)
    if db_ready():
        await _safe(add_note(user_id, "chat", f"H: {user_text[:500]} / J: {reply_text[:500]}"))
        if mem:
            await _safe(add_note(user_id, "fact", mem))
    if action == "none":
        await reply(reply_text)
        return
    # Real-world action -> pending + Yes/No buttons (safety rails).
    pid = await _safe(add_pending(user_id, action, detail), 0) if db_ready() else 0
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("Yes ✅", callback_data=f"ok:{pid}:{action}"),
        InlineKeyboardButton("No ❌", callback_data=f"no:{pid}:{action}"),
    ]])
    label = {"call": "📞 call", "alarm": "⏰ alarm", "open_app": "💻 open app", "mail": "✉️ mail"}[action]
    await reply(f"{reply_text}\n\nConfirm {label}?\n`{detail}`", buttons=keyboard)


# ---- handlers ----

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_owner(update):
        return
    await update.message.reply_text(HELP, parse_mode="Markdown")


async def cmd_whoami(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Public on purpose: bootstrap step so the owner can discover their ID.
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
    if not facts:
        await update.message.reply_text("Nothing stored yet — tell me things with /remember and I'll keep them. 💛")
        return
    await update.message.reply_text("Here's what I remember about you:\n\n• " + "\n• ".join(facts))


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
    # Approved.
    if pid.isdigit() and int(pid) and db_ready():
        await _safe(set_pending_status(int(pid), "approved"))
        await _safe(add_note(query.from_user.id, "note",
                             f"User APPROVED {action} (module pending): {query.message.text[:300]}"))
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


def main() -> None:
    if not TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN is not set.")
    app = Application.builder().token(TOKEN).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("whoami", cmd_whoami))
    app.add_handler(CommandHandler("remember", cmd_remember))
    app.add_handler(CommandHandler("memory", cmd_memory))
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
