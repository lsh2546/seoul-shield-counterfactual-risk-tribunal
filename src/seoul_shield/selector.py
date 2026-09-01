from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from .models import OptionType
from .strategy import propose_vertical_spread


OCC_PATTERN = re.compile(r"^([A-Z]+)(\d{6})([CP])(\d{8})$")


@dataclass(frozen=True)
class ChainContract:
    symbol: str
    expiration: date
    option_type: OptionType
    strike: float
    bid: float
    ask: float
    delta: float


def parse_chain(raw: dict) -> list[ChainContract]:
    contracts: list[ChainContract] = []
    for symbol, snap in raw.get("snapshots", {}).items():
        match = OCC_PATTERN.match(symbol)
        quote = snap.get("latestQuote") or snap.get("latest_quote") or {}
        greeks = snap.get("greeks") or {}
        if not match or quote.get("bp") is None or quote.get("ap") is None:
            continue
        _, yymmdd, kind, strike_code = match.groups()
        expiry = date(2000 + int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:]))
        bid, ask = float(quote["bp"]), float(quote["ap"])
        if bid < 0 or ask <= 0 or ask < bid:
            continue
        contracts.append(ChainContract(
            symbol=symbol, expiration=expiry,
            option_type=OptionType.CALL if kind == "C" else OptionType.PUT,
            strike=int(strike_code) / 1000,
            bid=bid, ask=ask, delta=float(greeks.get("delta") or 0),
        ))
    return contracts


def select_debit_vertical(raw: dict, *, underlying: str, bullish: bool,
                          confidence: float, thesis: str):
    """Select a liquid-looking vertical using delta proximity and valid quotes."""
    wanted = OptionType.CALL if bullish else OptionType.PUT
    chain = [c for c in parse_chain(raw) if c.option_type == wanted]
    if len(chain) < 2:
        raise ValueError("not enough quoted contracts to construct a vertical")
    long_target = 0.55 if bullish else -0.55
    long_leg = min(chain, key=lambda c: abs(c.delta - long_target))
    candidates = [c for c in chain if c.expiration == long_leg.expiration and (
        (bullish and c.strike > long_leg.strike) or
        (not bullish and c.strike < long_leg.strike)
    ) and 1 <= abs(c.strike - long_leg.strike) <= 10]
    if not candidates:
        raise ValueError("no compatible short leg within the configured width")
    short_target = 0.35 if bullish else -0.35
    short_leg = min(candidates, key=lambda c: abs(c.delta - short_target))
    return propose_vertical_spread(
        underlying=underlying, expiration=long_leg.expiration,
        long_symbol=long_leg.symbol, short_symbol=short_leg.symbol,
        long_strike=long_leg.strike, short_strike=short_leg.strike,
        long_ask=long_leg.ask, short_bid=short_leg.bid,
        option_type=wanted, confidence=confidence, thesis=thesis,
    )
