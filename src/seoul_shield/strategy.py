from __future__ import annotations

from datetime import date

from .models import OptionLeg, OptionType, PositionIntent, Side, TradeProposal


def propose_vertical_spread(
    *, underlying: str, expiration: date, long_symbol: str, short_symbol: str,
    long_strike: float, short_strike: float, long_ask: float, short_bid: float,
    option_type: OptionType, confidence: float, thesis: str, quantity: int = 1,
) -> TradeProposal:
    """Create a defined-risk debit spread from an AI/research thesis.

    Market selection is deliberately separated from execution: an LLM, human, or
    signal model may supply the thesis, while the risk engine remains deterministic.
    """
    net_debit = round(long_ask - short_bid, 2)
    return TradeProposal(
        underlying=underlying.upper(), quantity=quantity,
        legs=(
            OptionLeg(long_symbol, Side.BUY, option_type, long_strike, expiration, long_ask,
                      PositionIntent.BUY_TO_OPEN),
            OptionLeg(short_symbol, Side.SELL, option_type, short_strike, expiration, short_bid,
                      PositionIntent.SELL_TO_OPEN),
        ),
        thesis=thesis, confidence=confidence, net_debit=net_debit,
    )
