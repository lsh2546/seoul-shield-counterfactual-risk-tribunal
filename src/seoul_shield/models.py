from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from enum import Enum


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class PositionIntent(str, Enum):
    BUY_TO_OPEN = "buy_to_open"
    SELL_TO_OPEN = "sell_to_open"
    BUY_TO_CLOSE = "buy_to_close"
    SELL_TO_CLOSE = "sell_to_close"


class Universe(str, Enum):
    NO_GUARD = "no_guard"
    STATIC_GUARD = "static_guard"
    ADAPTIVE_GUARD = "adaptive_guard"
    LIVE_EXECUTION = "live_execution"


@dataclass(frozen=True)
class OptionLeg:
    symbol: str
    side: Side
    option_type: OptionType
    strike: float
    expiration: date
    premium: float
    position_intent: PositionIntent | None = None


@dataclass(frozen=True)
class TradeProposal:
    underlying: str
    quantity: int
    legs: tuple[OptionLeg, ...]
    thesis: str
    confidence: float
    net_debit: float

    def to_dict(self) -> dict:
        data = asdict(self)
        data["legs"] = [
            {**asdict(leg), "side": leg.side.value, "option_type": leg.option_type.value,
             "expiration": leg.expiration.isoformat()}
            for leg in self.legs
        ]
        return data


@dataclass(frozen=True)
class AccountState:
    equity: float = 100_000.0
    daily_pnl: float = 0.0
    open_risk: float = 0.0


@dataclass(frozen=True)
class RiskDecision:
    approved: bool
    reasons: tuple[str, ...]
    max_loss: float
    risk_fraction: float


@dataclass(frozen=True)
class MarketSnapshot:
    snapshot_id: str
    observed_at: str
    underlying: str
    volatility_percentile: float | None
    bid_ask_spread_pct: float
    open_interest: int
    quote_age_seconds: float
    recent_return_pct: float


@dataclass(frozen=True)
class AIRegime:
    regime: str
    volatility_risk: str
    liquidity_risk: str
    event_risk: str
    direction: str
    confidence: float
    risk_multiplier: float
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class PolicyDecision:
    universe: Universe
    action: str
    requested_quantity: int
    approved_quantity: int
    reasons: tuple[str, ...]
    max_loss: float
    actual_order_authority: bool
    snapshot_id: str
