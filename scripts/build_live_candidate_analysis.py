from __future__ import annotations

import hashlib
import json
import os
import sys
from time import perf_counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from seoul_shield.ai_regime import _google_request
from seoul_shield.alpaca_client import AlpacaClient

SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA"]
SCHEMA = {
    "type": "object",
    "properties": {
        "candidates": {"type": "array", "minItems": 4, "maxItems": 4, "items": {
            "type": "object", "properties": {
                "symbol": {"type": "string", "enum": SYMBOLS},
                "score": {"type": "integer", "minimum": 0, "maximum": 100},
                "reason": {"type": "string"},
            }, "required": ["symbol", "score", "reason"], "additionalProperties": False}},
        "selected_symbol": {"type": "string", "enum": SYMBOLS},
        "direction": {"type": "string", "enum": ["bullish", "bearish", "neutral"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "selection_reasons": {"type": "array", "minItems": 1, "maxItems": 4, "items": {"type": "string"}},
    },
    "required": ["candidates", "selected_symbol", "direction", "confidence", "selection_reasons"],
    "additionalProperties": False,
}


def load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def digest(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def return_window(bars: list[dict], minutes: int) -> dict:
    end = bars[-1]
    target = parse_time(end["t"]) - timedelta(minutes=minutes)
    eligible = [bar for bar in bars[:-1] if parse_time(bar["t"]) <= target]
    if not eligible:
        raise RuntimeError(f"missing complete {minutes}-minute return window")
    start = eligible[-1]
    value = (float(end["c"]) / float(start["c"]) - 1) * 100
    return {"minutes": minutes, "start_timestamp": start["t"], "start_price": float(start["c"]),
            "end_timestamp": end["t"], "end_price": float(end["c"]),
            "return_pct": round(value, 6), "source": "Alpaca IEX 1Min bars"}


def validate_result(value: object) -> dict:
    if not isinstance(value, dict) or set(value) != set(SCHEMA["required"]):
        raise ValueError("candidate output fields do not match locked schema")
    candidates = value["candidates"]
    if not isinstance(candidates, list) or len(candidates) != len(SYMBOLS):
        raise ValueError("candidate output must contain exactly four entries")
    seen = set()
    for item in candidates:
        if not isinstance(item, dict) or set(item) != {"symbol", "score", "reason"}:
            raise ValueError("candidate fields do not match locked schema")
        if item["symbol"] not in SYMBOLS or item["symbol"] in seen:
            raise ValueError("candidate symbols must be unique and approved")
        if not isinstance(item["score"], int) or not 0 <= item["score"] <= 100 or not isinstance(item["reason"], str):
            raise ValueError("invalid candidate score or reason")
        seen.add(item["symbol"])
    if seen != set(SYMBOLS) or value["selected_symbol"] not in SYMBOLS:
        raise ValueError("candidate universe mismatch")
    if value["direction"] not in {"bullish", "bearish", "neutral"}:
        raise ValueError("invalid direction")
    if not isinstance(value["confidence"], (int, float)) or not 0 <= value["confidence"] <= 1:
        raise ValueError("invalid confidence")
    if not isinstance(value["selection_reasons"], list) or not 1 <= len(value["selection_reasons"]) <= 4:
        raise ValueError("invalid selection reasons")
    return value


def main() -> None:
    load_env()
    if os.getenv("ALPACA_ALLOW_SUBMIT", "false").lower() != "false":
        raise RuntimeError("candidate analysis requires ALPACA_ALLOW_SUBMIT=false")
    now = datetime.now(timezone.utc)
    client = AlpacaClient()
    clock = client.clock()
    snapshots = client._get("https://data.alpaca.markets/v2/stocks/snapshots", {"symbols": ",".join(SYMBOLS), "feed": "iex"})
    market = []
    for symbol in SYMBOLS:
        snap = snapshots.get(symbol) or {}
        trade, quote = snap.get("latestTrade") or {}, snap.get("latestQuote") or {}
        daily, prior = snap.get("dailyBar") or {}, snap.get("prevDailyBar") or {}
        last, prior_close = trade.get("p"), prior.get("c")
        bars_raw = client.stock_bars(symbol, start=(now - timedelta(minutes=25)).isoformat(),
                                     end=now.isoformat())
        bars = sorted(bars_raw.get("bars", []), key=lambda bar: bar["t"])
        five, fifteen = return_window(bars, 5), return_window(bars, 15)
        short_direction = ("bullish" if five["return_pct"] > 0 and fifteen["return_pct"] > 0 else
                           "bearish" if five["return_pct"] < 0 and fifteen["return_pct"] < 0 else "mixed")
        market.append({
            "symbol": symbol, "price": last,
            "change_pct": round((float(last) / float(prior_close) - 1) * 100, 4) if last and prior_close else None,
            "volume": daily.get("v"), "bid": quote.get("bp"), "ask": quote.get("ap"),
            "trade_timestamp": trade.get("t"), "quote_timestamp": quote.get("t"),
            "return_5m": five, "return_15m": fifteen,
            "short_term_direction": short_direction,
            "source": "Alpaca Market Data API · IEX",
        })
    safe_input = {"market_open": bool(clock.get("is_open")), "clock_timestamp": clock.get("timestamp"), "candidates": market}
    input_hash = digest(safe_input)
    try:
        started_at = perf_counter()
        provider, model, response, model_time = _google_request(safe_input, SCHEMA, timeout_seconds=20)
        latency_ms = round((perf_counter() - started_at) * 1000)
        response = validate_result(response)
        ai = {"status": "MODEL RESPONSE VERIFIED", "provider": provider, "model": model,
              "model_time": model_time, "latency_ms": latency_ms,
              "schema_validated": True, "input_sha256": input_hash,
              "output_sha256": digest(response), "result": response}
    except Exception as exc:
        ai = {"status": "PENDING", "provider": "gemini", "model": "auto",
              "model_time": None, "latency_ms": None,
              "schema_validated": False, "input_sha256": input_hash,
              "output_sha256": None, "result": None, "error_type": type(exc).__name__}
    execution_filter = {"status": "PENDING", "eligible_symbols": [], "excluded_symbols": SYMBOLS,
                        "selected_symbol": None, "rule": "bullish requires 5m>0 and 15m>0; bearish requires 5m<0 and 15m<0"}
    if ai["schema_validated"]:
        score_by_symbol = {item["symbol"]: item["score"] for item in ai["result"]["candidates"]}
        wanted = ai["result"]["direction"]
        eligible = [item["symbol"] for item in market if item["short_term_direction"] == wanted]
        selected = max(eligible, key=lambda symbol: score_by_symbol[symbol]) if eligible else None
        execution_filter = {"status": "ELIGIBLE_CANDIDATE_SELECTED" if selected else "NO_ELIGIBLE_CANDIDATE",
                            "gemini_direction": wanted, "eligible_symbols": eligible,
                            "excluded_symbols": [s for s in SYMBOLS if s not in eligible],
                            "selected_symbol": selected,
                            "rule": "bullish requires 5m>0 and 15m>0; bearish requires 5m<0 and 15m<0"}
    bundle = {
        "schema_version": "seoul-shield.live-candidates.v1",
        "status": ("MODEL RESPONSE VERIFIED · SELECTION COMPLETE · NO ORDER SUBMITTED"
                   if ai["schema_validated"] else "MODEL RESPONSE FAILED · SELECTION PENDING"),
        "collected_at": now.isoformat(), "source": "Alpaca Market Data API · IEX", "market": safe_input,
        "ai": ai, "execution_filter": execution_filter,
        "execution": {"paper_trading": True, "allow_submit": False, "order_submitted": False},
    }
    out = ROOT / "evidence" / "market" / f"{now.strftime('%Y-%m-%dT%H%M%SZ')}-live-candidates.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"evidence_file": str(out.relative_to(ROOT)), "market": market, "ai": bundle["ai"], "order_submitted": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
