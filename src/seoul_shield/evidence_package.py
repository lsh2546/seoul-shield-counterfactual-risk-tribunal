from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone


PUBLIC_REQUIRED = {
    "ai", "market", "blocked_order", "safe_alternative", "human_approval",
    "paper_order", "order_timeline", "execution", "position", "paper_pnl",
    "audit_chain", "tests", "reproduction",
}
SECRET_KEYS = {
    "account_number", "account_id", "api_key", "secret_key", "token",
    "authorization", "apca-api-key-id", "apca-api-secret-key",
}


def canonical_sha256(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def sanitize(value: object) -> object:
    if isinstance(value, dict):
        return {key: sanitize(item) for key, item in value.items() if key.lower() not in SECRET_KEYS}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def build_public_evidence(payload: dict) -> dict:
    missing = sorted(PUBLIC_REQUIRED - set(payload))
    if missing:
        raise ValueError("missing final evidence: " + ", ".join(missing))
    ai = payload["ai"]
    if ai.get("status") != "AI VERIFIED" or not ai.get("local_schema_validated"):
        raise ValueError("AI evidence is not verified")
    approval = payload["human_approval"]
    if approval.get("decision") != "APPROVED" or not approval.get("timestamp_utc"):
        raise ValueError("human approval evidence is incomplete")
    order = payload["paper_order"]
    if not order.get("id") or order.get("environment") != "PAPER TRADING":
        raise ValueError("paper order evidence is incomplete")
    statuses = [item.get("status") for item in payload["order_timeline"]]
    if "submitted" not in statuses or "accepted" not in statuses:
        raise ValueError("order timeline lacks submitted or accepted")
    if not ({"filled", "cancelled"} & set(statuses)):
        raise ValueError("order timeline lacks a terminal status")
    execution = payload["execution"]
    if statuses[-1] == "filled" and (not execution.get("filled_qty") or execution.get("avg_fill_price") is None):
        raise ValueError("filled order lacks actual fill evidence")
    chain = payload["audit_chain"]
    if chain.get("verified") is not True or not chain.get("head_hash"):
        raise ValueError("audit chain is not verified")

    public = sanitize(payload)
    public["schema_version"] = "seoul-shield.final-public-evidence.v1"
    public["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    public["paper_trading_only"] = True
    public["credentials_present"] = False
    public["evidence_sha256"] = canonical_sha256(public)
    return public
