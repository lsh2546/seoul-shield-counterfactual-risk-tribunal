from datetime import date

from seoul_shield.models import AIRegime, AccountState, MarketSnapshot, OptionType, Universe
from seoul_shield.policies import evaluate_four_policies
from seoul_shield.strategy import propose_vertical_spread


def trade(qty=2):
    return propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655, long_ask=2.4, short_bid=1.55,
        option_type=OptionType.CALL, confidence=.7, thesis="fixture", quantity=qty)


def snapshot(**overrides):
    values = dict(snapshot_id="snap-1", observed_at="2026-08-31T12:00:00Z",
                  underlying="SPY", volatility_percentile=.5,
                  bid_ask_spread_pct=.08, open_interest=500,
                  quote_age_seconds=2, recent_return_pct=.4)
    values.update(overrides)
    return MarketSnapshot(**values)


def regime(multiplier=.5):
    return AIRegime("calm", "low", "low", "low", "bullish", .8,
                    multiplier, ("structured model assessment",))


def test_all_policies_share_snapshot_and_only_live_has_authority():
    decisions = evaluate_four_policies(trade(), snapshot(), AccountState(), regime())
    assert {d.snapshot_id for d in decisions} == {"snap-1"}
    assert [d.actual_order_authority for d in decisions] == [False, False, False, True]
    assert decisions[2].action == "resize"


def test_adaptive_never_bypasses_hard_gate():
    decisions = evaluate_four_policies(trade(qty=20), snapshot(), AccountState(), regime(1))
    assert decisions[1].action == "reject"
    assert decisions[2].action == "reject"
    assert decisions[3].action == "reject"


def test_stale_quote_fail_closed():
    decisions = evaluate_four_policies(trade(), snapshot(quote_age_seconds=31),
                                       AccountState(), regime(1))
    assert decisions[2].approved_quantity == 0
    assert decisions[3].approved_quantity == 0
