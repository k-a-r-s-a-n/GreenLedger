# Joi — personal AI buddy (Telegram + Gemini + free cloud)

> Status: **Phase 2 built, awaiting deploy.** Bot code complete; needs Render deploy + OWNER id.

## Locked spec (from user, Sept 2026)
- Devices: Windows laptop (16 GB, no GPU) + Android phone. Nothing heavy runs locally.
- Chat: Telegram bot (text in class, voice notes otherwise). Tap-to-talk via chat widget.
- Voice: deep male TTS (closest free Ultron-ish voice, user picks samples in Phase 5).
- Language: Tanglish. Persona: friendly buddy named **Joi**. Reactive-only (never starts
  conversations, except user-requested alarms/reminders which fire as real phone alarms).
- Brain: Gemini API free tier (2.5-flash primary, fallback chain in `bot/brain.py`).
- Home: Render free (webhook, wakes on message) + Neon free Postgres for memory.
- Memory: full-life (profile, goals, subjects/deadlines, people nicknames, dated notes).
- Jobs: open laptop apps, draft mails, real alarms, auto-dial by nickname, study + random doubts.
- Contacts: nicknames only in chat; real numbers live ONLY in on-phone MacroDroid variables.
  On multiple matches, bot must ask "which one?" before dialing.
- Safety: small stuff auto; inline Yes/No confirm in Telegram before mail-send / call / delete.
- Offline: alarms must fire without internet (real Android alarms via MacroDroid).
- Budget: strict $0. Setup: no-code (guided taps only).

## Layout
```
joi/
├── bot/            # Telegram bot (python-telegram-bot; webhook on Render, polling local)
│   ├── main.py     # entry: owner gate, handlers, confirm rails
│   ├── brain.py    # Gemini chat + voice transcription w/ fallback
│   ├── memory.py   # Neon helpers (notes/profile/pending)
│   └── persona.py  # system prompt + reply protocol
├── laptop/         # Phase 4: tiny Windows worker (open apps, Gmail compose links)
├── android/        # Phase 3: MacroDroid macro specs (dial-by-nickname, offline alarms)
├── memory/         # schema.sql (auto-applied on boot; manual fallback)
└── voice/          # Phase 5: TTS voice samples (Edge-TTS / Gemini TTS)
```

## Deploy (Render, manual Web Service — no-code)
1. Push this branch to GitHub. Render dashboard -> New -> Web Service -> select
   `GreenLedger` repo, branch `arena/01a0d90d-greenledger`.
2. Settings: Root Directory `joi`, Build `pip install -r requirements.txt`,
   Start `python -m bot.main`, instance Free.
3. Environment variables (paste values, never commit them):
   `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `DATABASE_URL` (paste as-is, pooler URL ok),
   `OWNER_TELEGRAM_ID` (`0` first — see step 5), `GEMINI_MODEL=gemini-2.5-flash`.
4. Deploy. Watch Logs for `boot check: database=ONLINE`. If `Invalid token` appears,
   the bot token is wrong — re-copy from BotFather.
5. On Telegram, send the bot `/whoami` -> paste the returned number into Render's
   `OWNER_TELEGRAM_ID` -> Save (auto-redeploys) -> send `/start`. Joi is locked to you.

## Rules
- Never commit real keys (root `.gitignore` covers `.env`). Ever.
- Bot must ignore any chat whose user id != OWNER_TELEGRAM_ID (`/whoami` exempt).
- No destructive action (send mail, place call, delete) without explicit Yes-tap.
- Real phone numbers must never appear in Telegram chat or cloud logs — nicknames only.
