from seoul_shield.ai_regime import assess_market
from seoul_shield.models import MarketSnapshot


def test_missing_model_key_uses_fail_closed_fallback(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    snapshot = MarketSnapshot("s1", "2026-08-31T00:00:00Z", "SPY", .9,
                              .25, 50, 40, -1)
    regime, evidence = assess_market(snapshot)
    assert regime.risk_multiplier == 0
    assert evidence.fallback == "static_guard"
    assert evidence.error_type == "missing_api_key"
