from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from .audit import append_event
from .broker import PaperBroker
from .idempotency import IdempotencyStore
from .models import AccountState, OptionType
from .risk import RiskEngine
from .strategy import propose_vertical_spread


def main() -> None:
    parser = argparse.ArgumentParser(description="Risk-first Alpaca paper-options agent")
    parser.add_argument("--execute", action="store_true", help="submit after all safety checks")
    parser.add_argument("--audit", default="audit/events.jsonl")
    args = parser.parse_args()

    # Safe sample. Replace symbols/quotes with current Alpaca option-chain values.
    proposal = propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655, long_ask=2.40, short_bid=1.55,
        option_type=OptionType.CALL, confidence=0.68,
        thesis="AI regime classifier sees positive momentum with controlled volatility.",
    )
    account = AccountState()
    decision = RiskEngine().evaluate(proposal, account)
    client_order_id = IdempotencyStore().reserve("sample-spy-20260911-650-655")
    result = PaperBroker().submit(proposal, decision,
                                  client_order_id=client_order_id, execute=args.execute)
    event = {"proposal": proposal.to_dict(), "decision": {
        "approved": decision.approved, "reasons": list(decision.reasons),
        "max_loss": decision.max_loss, "risk_fraction": decision.risk_fraction,
    }, "broker": result}
    append_event(Path(args.audit), event)
    print(json.dumps(event, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
