from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path


GENESIS_HASH = "0" * 64


def _canonical(value: dict) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), default=str).encode("utf-8")


def _last_record(path: Path) -> dict | None:
    if not path.exists():
        return None
    last = None
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            if line.strip():
                last = json.loads(line)
    return last


def append_event(path: Path, event: dict) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    previous = _last_record(path)
    core = {
        "sequence": (int(previous["sequence"]) + 1) if previous else 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "previous_hash": previous["event_hash"] if previous else GENESIS_HASH,
        **event,
    }
    record = {**core, "event_hash": hashlib.sha256(_canonical(core)).hexdigest()}
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    return record


def verify_chain(path: Path) -> tuple[bool, str]:
    previous_hash = GENESIS_HASH
    expected_sequence = 1
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            record = json.loads(line)
            event_hash = record.pop("event_hash", "")
            if record.get("sequence") != expected_sequence:
                return False, f"sequence mismatch at {expected_sequence}"
            if record.get("previous_hash") != previous_hash:
                return False, f"previous hash mismatch at {expected_sequence}"
            if hashlib.sha256(_canonical(record)).hexdigest() != event_hash:
                return False, f"event hash mismatch at {expected_sequence}"
            previous_hash = event_hash
            expected_sequence += 1
    return True, f"verified {expected_sequence - 1} events"
