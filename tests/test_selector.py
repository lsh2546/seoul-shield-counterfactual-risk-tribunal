from seoul_shield.selector import parse_chain, select_debit_vertical


CHAIN = {"snapshots": {
    "SPY260911C00650000": {"latestQuote": {"bp": 2.30, "ap": 2.40}, "greeks": {"delta": .56}},
    "SPY260911C00655000": {"latestQuote": {"bp": 1.55, "ap": 1.65}, "greeks": {"delta": .36}},
    "SPY260911C00660000": {"latestQuote": {"bp": 0, "ap": 1.00}, "greeks": {"delta": .20}},
}}


def test_occ_chain_parsing():
    parsed = parse_chain(CHAIN)
    assert parsed[0].strike == 650
    assert parsed[0].expiration.isoformat() == "2026-09-11"


def test_selects_delta_target_vertical():
    trade = select_debit_vertical(CHAIN, underlying="SPY", bullish=True,
                                  confidence=.7, thesis="momentum")
    assert trade.legs[0].symbol.endswith("650000")
    assert trade.legs[1].symbol.endswith("655000")
    assert trade.net_debit == .85
