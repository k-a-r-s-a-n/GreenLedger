"""Gemini brain: chat + voice transcription, with model fallback chain."""

import asyncio
import logging
import os

from google import genai
from google.genai import types

log = logging.getLogger("joi.brain")

API_KEY = os.environ.get("GEMINI_API_KEY", "")
PRIMARY = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
MODELS = list(dict.fromkeys([PRIMARY, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]))

_client = None


def _client_ok():
    global _client
    if _client is None:
        if not API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=API_KEY)
    return _client


def _generate_sync(model: str, system: str, user_text: str) -> str:
    resp = _client_ok().models.generate_content(
        model=model,
        contents=user_text,
        config=types.GenerateContentConfig(
            system_instruction=system, temperature=0.7, max_output_tokens=1024
        ),
    )
    return (resp.text or "").strip()


async def chat(system: str, user_text: str) -> tuple[str, str]:
    """Returns (raw_model_output, model_used). Raises RuntimeError if all fail."""
    last_err: Exception | None = None
    for model in MODELS:
        try:
            out = await asyncio.to_thread(_generate_sync, model, system, user_text)
            if out:
                return out, model
        except Exception as exc:  # try next model (429 / 404 / 5xx)
            last_err = exc
            log.warning("model %s failed, trying next: %s", model, str(exc)[:160])
    raise RuntimeError(f"all Gemini models failed ({str(last_err)[:160]})")


def _transcribe_sync(model: str, data: bytes, mime: str) -> str:
    resp = _client_ok().models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=data, mime_type=mime),
            "Transcribe this voice note exactly (Tamil/English/Tanglish allowed). "
            "Reply with the transcription only, no commentary.",
        ],
        config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=512),
    )
    return (resp.text or "").strip()


async def transcribe(data: bytes, mime: str = "audio/ogg") -> str:
    last_err: Exception | None = None
    for model in MODELS:
        try:
            out = await asyncio.to_thread(_transcribe_sync, model, bytes(data), mime)
            if out:
                return out
        except Exception as exc:
            last_err = exc
            log.warning("transcribe via %s failed: %s", model, str(exc)[:160])
    raise RuntimeError(f"transcription failed ({str(last_err)[:160]})")
