import json

from seoul_shield.ai_regime import _validate_regime, assess_market
from seoul_shield.models import MarketSnapshot


def test_missing_model_key_uses_fail_closed_fallback(monkeypatch):
    monkeypatch.delenv("FEATHERLESS_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    snapshot = MarketSnapshot("s1", "2026-08-31T00:00:00Z", "SPY", .9,
                              .25, 50, 40, -1)
    regime, evidence = assess_market(snapshot)
    assert regime.risk_multiplier == 0
    assert evidence.fallback == "static_guard"
    assert evidence.error_type == "missing_api_key"


def test_locked_local_schema_accepts_valid_structured_result():
    value = {
        "regime": "calm", "volatility_risk": "low", "liquidity_risk": "low",
        "event_risk": "medium", "direction": "neutral", "confidence": 0.7,
        "risk_multiplier": 0.5, "reasons": ["liquid market"],
    }
    assert _validate_regime(value) == value


def test_featherless_response_is_locally_validated(monkeypatch):
    monkeypatch.setenv("FEATHERLESS_API_KEY", "test-only")
    result = {
        "regime": "calm", "volatility_risk": "low", "liquidity_risk": "low",
        "event_risk": "medium", "direction": "neutral", "confidence": 0.7,
        "risk_multiplier": 0.5, "reasons": ["narrow spread"],
    }

    class Response:
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def read(self):
            return json.dumps({"model": "test/model", "choices": [{"message": {"content": json.dumps(result)}}]}).encode()

    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: Response())
    snapshot = MarketSnapshot("s2", "2026-09-03T00:00:00Z", "SPY", .5, .01, 1000, 1, 0)
    regime, evidence = assess_market(snapshot)
    assert regime.risk_multiplier == .5
    assert evidence.provider == "featherless"
    assert evidence.model == "test/model"
    assert len(evidence.input_sha256) == 64
    assert evidence.fallback is None
