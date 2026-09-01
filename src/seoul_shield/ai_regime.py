from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from .models import AIRegime, MarketSnapshot


REGIME_SCHEMA = {
    "type": "object",
    "properties": {
        "regime": {"type": "string", "enum": ["calm", "trending", "volatile", "dislocated"]},
        "volatility_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "liquidity_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "event_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "direction": {"type": "string", "enum": ["bullish", "bearish", "neutral"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "risk_multiplier": {"type": "number", "enum": [0, 0.25, 0.5, 0.75, 1]},
        "reasons": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 4},
    },
    "required": ["regime", "volatility_risk", "liquidity_risk", "event_risk",
                 "direction", "confidence", "risk_multiplier", "reasons"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class ModelEvidence:
    input: dict
    model: str
    response: dict | None
    latency_ms: int
    timed_out: bool
    fallback: str | None
    error_type: str | None


def _extract_output_text(response: dict) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return str(content.get("text", ""))
    raise ValueError("response contains no output text")


def static_fallback(snapshot: MarketSnapshot) -> AIRegime:
    unsafe = snapshot.quote_age_seconds > 30 or snapshot.bid_ask_spread_pct > 0.20
    return AIRegime(
        regime="dislocated" if unsafe else "volatile" if snapshot.volatility_percentile > .8 else "calm",
        volatility_risk="high" if snapshot.volatility_percentile > .8 else "medium",
        liquidity_risk="high" if unsafe else "medium",
        event_risk="medium", direction="neutral", confidence=0,
        risk_multiplier=0 if unsafe else .5,
        reasons=("model unavailable; deterministic fail-closed fallback applied",),
    )


def assess_market(snapshot: MarketSnapshot, *, timeout_seconds: float = 12) -> tuple[AIRegime, ModelEvidence]:
    model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    safe_input = asdict(snapshot)
    key = os.getenv("OPENAI_API_KEY")
    started = time.perf_counter()
    if not key:
        fallback = static_fallback(snapshot)
        return fallback, ModelEvidence(safe_input, model, None, 0, False,
                                       "static_guard", "missing_api_key")
    payload = {
        "model": model,
        "store": False,
        "instructions": "Classify market and execution risk. Never authorize an order. Return only schema data.",
        "input": json.dumps(safe_input, sort_keys=True),
        "text": {"format": {"type": "json_schema", "name": "market_risk",
                            "strict": True, "schema": REGIME_SCHEMA}},
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses", data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read())
        parsed = json.loads(_extract_output_text(raw))
        regime = AIRegime(**{**parsed, "reasons": tuple(parsed["reasons"])})
        evidence = ModelEvidence(safe_input, str(raw.get("model", model)), parsed,
                                 int((time.perf_counter() - started) * 1000), False, None, None)
        return regime, evidence
    except Exception as exc:
        timed_out = isinstance(exc, (TimeoutError, urllib.error.URLError)) and "timed out" in str(exc).lower()
        fallback = static_fallback(snapshot)
        evidence = ModelEvidence(safe_input, model, None,
                                 int((time.perf_counter() - started) * 1000), timed_out,
                                 "static_guard", type(exc).__name__)
        return fallback, evidence
