from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from .models import AccountState, OptionType, PositionIntent, Side, TradeProposal
from .risk import RiskEngine


@dataclass(frozen=True)
class PreflightEvidence:
    paper_account: bool
    starting_balance_verified: bool
    options_level_3: bool
    contracts_valid: bool
    quote_fresh: bool
    spread_acceptable: bool
    liquidity_acceptable: bool
    strike_ordering_valid: bool
    position_intents_valid: bool
    client_order_id_unique: bool
    hard_risk_approved: bool
    status_route_ready: bool
    cancel_route_ready: bool
    preview_payload: dict
    blockers: tuple[str, ...]

    @property
    def ready_for_human_approval(self) -> bool:
        values = asdict(self)
        return not self.blockers and all(
            values[name] for name in (
                "paper_account", "starting_balance_verified", "options_level_3",
                "contracts_valid", "quote_fresh", "spread_acceptable",
                "liquidity_acceptable", "strike_ordering_valid",
                "position_intents_valid", "client_order_id_unique",
                "hard_risk_approved", "status_route_ready", "cancel_route_ready",
            )
        )


def validate_preflight(*, proposal: TradeProposal, account: AccountState,
                       account_status: dict, contract_statuses: dict[str, dict],
                       quote_observed_at: str, spread_pct: float, open_interest: int,
                       client_order_id_unique: bool, preview_payload: dict) -> PreflightEvidence:
    blockers: list[str] = []
    paper = account_status.get("environment") == "paper"
    start_ok = account_status.get("starting_balance_evidence") == 100_000
    level_ok = int(account_status.get("options_level", 0)) >= 3
    contracts_ok = all(contract_statuses.get(leg.symbol, {}).get("tradable") is True
                       for leg in proposal.legs)
    observed = datetime.fromisoformat(quote_observed_at.replace("Z", "+00:00"))
    quote_age = (datetime.now(timezone.utc) - observed).total_seconds()
    fresh = 0 <= quote_age <= 30
    spread_ok = 0 <= spread_pct <= .20
    liquidity_ok = open_interest >= 100
    long_leg = next((leg for leg in proposal.legs if leg.side == Side.BUY), None)
    short_leg = next((leg for leg in proposal.legs if leg.side == Side.SELL), None)
    ordering = bool(long_leg and short_leg and (
        (long_leg.option_type == OptionType.CALL and long_leg.strike < short_leg.strike) or
        (long_leg.option_type == OptionType.PUT and long_leg.strike > short_leg.strike)
    ))
    intents = bool(long_leg and short_leg and
                   long_leg.position_intent == PositionIntent.BUY_TO_OPEN and
                   short_leg.position_intent == PositionIntent.SELL_TO_OPEN)
    risk_ok = RiskEngine().evaluate(proposal, account).approved
    checks = {
        "paper account not proven": paper,
        "$100,000 starting balance not proven": start_ok,
        "options level 3 not proven": level_ok,
        "option contract invalid or not tradable": contracts_ok,
        "quote is stale": fresh,
        "bid/ask spread exceeds 20%": spread_ok,
        "open interest below 100": liquidity_ok,
        "invalid debit spread strike ordering": ordering,
        "invalid position intent": intents,
        "client_order_id is not unique": client_order_id_unique,
        "hard risk gate rejected order": risk_ok,
    }
    blockers.extend(message for message, passed in checks.items() if not passed)
    return PreflightEvidence(
        paper, start_ok, level_ok, contracts_ok, fresh, spread_ok, liquidity_ok,
        ordering, intents, client_order_id_unique, risk_ok, True, True,
        preview_payload, tuple(blockers),
    )
