from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict

from .models import RiskDecision, TradeProposal


PAPER_ORDERS_URL = "https://paper-api.alpaca.markets/v2/orders"


def build_order_payload(proposal: TradeProposal, *, client_order_id: str) -> dict:
    return {
        "qty": str(proposal.quantity),
        "order_class": "mleg",
        "type": "limit",
        "time_in_force": "day",
        "limit_price": str(proposal.net_debit),
        "legs": [
            {"symbol": leg.symbol, "ratio_qty": "1", "side": leg.side.value,
             "position_intent": leg.position_intent.value if leg.position_intent else None}
            for leg in proposal.legs
        ],
        "client_order_id": client_order_id,
    }


class PaperBroker:
    """Paper-only adapter with a two-key safety latch."""

    def submit(self, proposal: TradeProposal, decision: RiskDecision,
               *, client_order_id: str, execute: bool = False) -> dict:
        payload = build_order_payload(proposal, client_order_id=client_order_id)
        if not decision.approved:
            return {"status": "rejected_by_risk", "reasons": list(decision.reasons),
                    "preview": payload}
        if not execute:
            return {"status": "preview", "preview": payload,
                    "risk": asdict(decision)}
        if os.getenv("ALPACA_ALLOW_SUBMIT", "false").lower() != "true":
            raise RuntimeError("ALPACA_ALLOW_SUBMIT must be true to submit a paper order")
        key, secret = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_SECRET_KEY")
        if not key or not secret:
            raise RuntimeError("Alpaca paper API credentials are missing")
        request = urllib.request.Request(
            PAPER_ORDERS_URL, data=json.dumps(payload).encode(), method="POST",
            headers={"Content-Type": "application/json", "APCA-API-KEY-ID": key,
                     "APCA-API-SECRET-KEY": secret},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise RuntimeError(f"Alpaca rejected order ({exc.code}): {detail}") from exc
