from __future__ import annotations

from dataclasses import dataclass


TRUST_SPEC_VERSION = "trust-v1-2026-08-31"
TRUST_WEIGHTS = {
    "loss_protection": .30,
    "drawdown_control": .20,
    "opportunity_efficiency": .20,
    "gate_precision": .15,
    "hard_limit_compliance": .10,
    "evidence_completeness": .05,
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass(frozen=True)
class TradeComparison:
    no_guard_pnl: float
    guard_pnl: float
    no_guard_qty: int
    guard_qty: int
    pnl_per_contract: float
    fill_price_effect: float = 0.0


def loss_avoided(item: TradeComparison) -> dict:
    if item.no_guard_pnl >= 0:
        return {"total": 0.0, "rejection": 0.0, "resize": 0.0, "fill_price": 0.0,
                "eligible": False, "formula": "No Guard was not a loss"}
    total = max(0.0, item.guard_pnl - item.no_guard_pnl)
    rejection = total if item.guard_qty == 0 else 0.0
    resize = 0.0
    if 0 < item.guard_qty < item.no_guard_qty:
        resize = max(0.0, (item.no_guard_qty - item.guard_qty) * -item.pnl_per_contract)
    fill = max(0.0, min(total - rejection - resize, item.fill_price_effect))
    return {"total": round(total, 2), "rejection": round(rejection, 2),
            "resize": round(resize, 2), "fill_price": round(fill, 2),
            "eligible": True,
            "formula": "max(0, Guard PnL - NoGuard PnL), only when NoGuard PnL < 0"}


def trust_score(*, loss_protection: float, drawdown_control: float,
                opportunity_efficiency: float, gate_precision: float,
                hard_limit_compliance: float, evidence_completeness: float) -> dict:
    raw = {name: clamp(value) for name, value in locals().items()}
    weighted = {name: round(raw[name] * weight, 6) for name, weight in TRUST_WEIGHTS.items()}
    return {"spec_version": TRUST_SPEC_VERSION, "raw": raw,
            "weights": TRUST_WEIGHTS, "weighted": weighted,
            "score": round(sum(weighted.values()) * 100, 2)}
