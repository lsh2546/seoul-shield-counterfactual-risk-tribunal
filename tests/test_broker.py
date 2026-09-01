from datetime import date

from seoul_shield.broker import build_order_payload
from seoul_shield.models import OptionType
from seoul_shield.strategy import propose_vertical_spread


def test_multileg_payload_has_position_intents_and_unique_id():
    trade = propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655, long_ask=2.4, short_bid=1.55,
        option_type=OptionType.CALL, confidence=.7, thesis="fixture")
    payload = build_order_payload(trade, client_order_id="sst-unique")
    assert payload["client_order_id"] == "sst-unique"
    assert [leg["position_intent"] for leg in payload["legs"]] == [
        "buy_to_open", "sell_to_open"]
