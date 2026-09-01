from __future__ import annotations

from dataclasses import replace

from .models import (AIRegime, AccountState, MarketSnapshot, PolicyDecision,
                     TradeProposal, Universe)
from .risk import RiskEngine


def _decision(universe: Universe, qty: int, requested: int, reasons: list[str],
              proposal: TradeProposal, snapshot: MarketSnapshot, authority: bool) -> PolicyDecision:
    action = "approve" if qty == requested else "reject" if qty == 0 else "resize"
    return PolicyDecision(universe, action, requested, qty, tuple(reasons),
                          round(proposal.net_debit * 100 * qty, 2), authority,
                          snapshot.snapshot_id)


def evaluate_four_policies(proposal: TradeProposal, snapshot: MarketSnapshot,
                           account: AccountState, regime: AIRegime) -> tuple[PolicyDecision, ...]:
    requested = proposal.quantity
    no_guard = _decision(Universe.NO_GUARD, requested, requested,
                         ["shadow baseline: no risk controls"], proposal, snapshot, False)

    static_risk = RiskEngine().evaluate(proposal, account)
    static_qty = requested if static_risk.approved else 0
    static_reasons = ["fixed 1% trade / 5% portfolio / 2% daily stop"] + list(static_risk.reasons)
    static = _decision(Universe.STATIC_GUARD, static_qty, requested,
                       static_reasons, proposal, snapshot, False)

    adaptive_reasons = [f"AI regime={regime.regime}, multiplier={regime.risk_multiplier}"]
    adaptive_reasons.extend(regime.reasons)
    if snapshot.quote_age_seconds > 30:
        adaptive_reasons.append("quote older than 30 seconds")
    if snapshot.bid_ask_spread_pct > .20:
        adaptive_reasons.append("bid/ask spread above 20%")
    if snapshot.open_interest < 100:
        adaptive_reasons.append("open interest below 100")
    hard_fail = (not static_risk.approved or snapshot.quote_age_seconds > 30 or
                 snapshot.bid_ask_spread_pct > .20 or snapshot.open_interest < 100)
    adaptive_qty = 0 if hard_fail else min(requested, int(requested * regime.risk_multiplier))
    if requested == 1 and not hard_fail and regime.risk_multiplier > 0:
        adaptive_qty = 1
    adjusted = replace(proposal, quantity=adaptive_qty) if adaptive_qty else proposal
    if adaptive_qty and not RiskEngine().evaluate(adjusted, account).approved:
        adaptive_qty = 0
        adaptive_reasons.append("hard risk cap rejected adjusted size")
    adaptive = _decision(Universe.ADAPTIVE_GUARD, adaptive_qty, requested,
                         adaptive_reasons, proposal, snapshot, False)
    live = _decision(Universe.LIVE_EXECUTION, adaptive_qty, requested,
                     adaptive_reasons + ["preview only until explicit human approval"],
                     proposal, snapshot, True)
    return no_guard, static, adaptive, live
