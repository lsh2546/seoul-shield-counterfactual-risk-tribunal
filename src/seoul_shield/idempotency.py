from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class IdempotencyStore:
    def __init__(self, path: Path = Path("state/orders.sqlite3")):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path)
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS order_ids (client_order_id TEXT PRIMARY KEY, "
            "signal_id TEXT UNIQUE NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)"
        )
        self.connection.commit()

    def reserve(self, signal_id: str) -> str:
        existing = self.connection.execute(
            "SELECT client_order_id FROM order_ids WHERE signal_id = ?", (signal_id,)
        ).fetchone()
        if existing:
            return str(existing[0])
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        client_id = f"sst-{stamp}-{secrets.token_hex(5)}"
        self.connection.execute(
            "INSERT INTO order_ids VALUES (?, ?, 'preview', ?)",
            (client_id, signal_id, datetime.now(timezone.utc).isoformat()),
        )
        self.connection.commit()
        return client_id

    def mark(self, client_order_id: str, status: str) -> None:
        self.connection.execute(
            "UPDATE order_ids SET status = ? WHERE client_order_id = ?",
            (status, client_order_id),
        )
        self.connection.commit()
