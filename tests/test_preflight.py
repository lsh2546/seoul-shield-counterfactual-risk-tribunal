from datetime import date, datetime, timezone

from seoul_shield.broker import build_order_payload
from seoul_shield.models import AccountState, OptionType
from seoul_shield.preflight import validate_preflight
from seoul_shield.strategy import propose_vertical_spread


def test_complete_paper_preflight_is_ready():
    proposal = propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655, long_ask=2.4, short_bid=1.55,
        option_type=OptionType.CALL, confidence=.7, thesis="fixture")
    payload = build_order_payload(proposal, client_order_id="sst-unique")
    statuses = {leg.symbol: {"tradable": True} for leg in proposal.legs}
    evidence = validate_preflight(
        proposal=proposal, account=AccountState(),
        account_status={"environment": "paper", "starting_balance_evidence": 100_000,
                        "options_level": 3}, contract_statuses=statuses,
        quote_observed_at=datetime.now(timezone.utc).isoformat(), spread_pct=.08,
        open_interest=500, client_order_id_unique=True, preview_payload=payload)
    assert evidence.ready_for_human_approval


def test_stale_quote_blocks_preflight():
    proposal = propose_vertical_spread(
        underlying="SPY", expiration=date(2026, 9, 11),
        long_symbol="SPY260911C00650000", short_symbol="SPY260911C00655000",
        long_strike=650, short_strike=655, long_ask=2.4, short_bid=1.55,
        option_type=OptionType.CALL, confidence=.7, thesis="fixture")
    evidence = validate_preflight(
        proposal=proposal, account=AccountState(),
        account_status={"environment": "paper", "starting_balance_evidence": 100_000,
                        "options_level": 3},
        contract_statuses={leg.symbol: {"tradable": True} for leg in proposal.legs},
        quote_observed_at="2026-08-31T00:00:00Z", spread_pct=.08,
        open_interest=500, client_order_id_unique=True,
        preview_payload=build_order_payload(proposal, client_order_id="sst-unique"))
    assert not evidence.ready_for_human_approval
    assert "quote is stale" in evidence.blockers
