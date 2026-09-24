"""
GreenLedger - Pytest fixtures.
Redirects the Phase 1 transition log to a per-test tmp file so the suite
never pollutes the repo's ml/data/transitions/ log with test cycles.
"""

import pytest


@pytest.fixture(autouse=True)
def _isolate_transition_log(tmp_path, monkeypatch):
    monkeypatch.setenv("GREENLEDGER_TRANSITION_LOG", str(tmp_path / "transitions.jsonl"))
