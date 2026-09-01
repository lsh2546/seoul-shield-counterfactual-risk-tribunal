from datetime import date

from seoul_shield.models import AccountState, OptionType
from seoul_shield.risk import RiskEngine
from seoul_shield.strategy import propose_vertical_spread


def proposal(debit=0.85, qty=1):
    return propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655,
        long_ask=debit + 1, short_bid=1,
        option_type=OptionType.CALL, confidence=.7, thesis="test", quantity=qty,
    )


def test_safe_debit_spread_is_approved():
    decision = RiskEngine().evaluate(proposal(), AccountState(), today=date(2026, 8, 31))
    assert decision.approved
    assert decision.max_loss == 85


def test_oversized_trade_is_rejected():
    decision = RiskEngine().evaluate(proposal(debit=5, qty=3), AccountState(), today=date(2026, 8, 31))
    assert not decision.approved
    assert "per-trade risk limit exceeded" in decision.reasons


def test_daily_loss_kill_switch():
    state = AccountState(daily_pnl=-2_001)
    decision = RiskEngine().evaluate(proposal(), state, today=date(2026, 8, 31))
    assert not decision.approved
    assert "daily loss kill switch active" in decision.reasons


def test_wrong_call_strike_order_is_rejected():
    bad = propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00660000", short_symbol="SPY260911C00655000",
        long_strike=660, short_strike=655, long_ask=2, short_bid=1,
        option_type=OptionType.CALL, confidence=.7, thesis="bad")
    decision = RiskEngine().evaluate(bad, AccountState(), today=date(2026, 8, 31))
    assert "call debit spread requires long strike below short strike" in decision.reasons
