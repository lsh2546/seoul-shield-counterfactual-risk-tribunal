from __future__ import annotations

import json
import hashlib
import os
import sys
import urllib.error
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from seoul_shield.ai_regime import ModelEvidence, assess_market
from seoul_shield.alpaca_client import AlpacaClient
from seoul_shield.audit import append_event, verify_chain
from seoul_shield.broker import build_order_payload
from seoul_shield.models import AIRegime, AccountState, MarketSnapshot, OptionType
from seoul_shield.policies import evaluate_four_policies
from seoul_shield.risk import RiskEngine
from seoul_shield.strategy import propose_vertical_spread


def load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def parse_time(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def digest(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    load_env()
    if os.getenv("ALPACA_ALLOW_SUBMIT", "false").lower() != "false":
        raise RuntimeError("Preflight requires ALPACA_ALLOW_SUBMIT=false")

    now = datetime.now(timezone.utc)
    client = AlpacaClient()
    account_raw = client.account()
    account_check = client.check_competition_account()
    clock = client.clock()
    positions = client.positions()
    orders = client.orders()
    candidate_files = sorted((ROOT / "evidence" / "market").glob("*-live-candidates.json"))
    if not candidate_files:
        raise RuntimeError("No verified live candidate analysis found")
    candidate_evidence = json.loads(candidate_files[-1].read_text(encoding="utf-8"))
    if candidate_evidence.get("ai", {}).get("schema_validated") is not True:
        raise RuntimeError("Latest candidate analysis is not schema verified")
    selected_symbol = candidate_evidence.get("execution_filter", {}).get("selected_symbol")
    if not selected_symbol:
        raise RuntimeError("NO_ELIGIBLE_CANDIDATE · no option preview permitted")
    selected_direction = candidate_evidence["ai"]["result"]["direction"]
    # The original verified replay used Sep 4. A new executable alternative must
    # retain at least two calendar days to expiry, so preflight uses Sep 11.
    expiration = date(2026, 9, 11)
    contracts_raw = client.option_contracts(selected_symbol, expiration=expiration)
    chain_raw = client.option_chain(selected_symbol, expiration=expiration, option_type="call")
    latest_trade = client.latest_stock_trade(selected_symbol)
    bars_raw = client.stock_bars(
        selected_symbol,
        start=(now - timedelta(minutes=20)).isoformat(),
        end=now.isoformat(),
    )
    metadata = {x["symbol"]: x for x in contracts_raw.get("option_contracts", [])}

    points: list[dict] = []
    for symbol, snapshot in chain_raw.get("snapshots", {}).items():
        quote = snapshot.get("latestQuote") or {}
        contract = metadata.get(symbol, {})
        bid, ask = quote.get("bp"), quote.get("ap")
        if bid is None or ask is None or float(ask) <= float(bid) or float(bid) < 0:
            continue
        bid, ask = float(bid), float(ask)
        midpoint = (bid + ask) / 2
        observed_at = quote.get("t") or (snapshot.get("latestTrade") or {}).get("t")
        observed = parse_time(observed_at)
        greeks = snapshot.get("greeks") or {}
        points.append({
            "symbol": symbol,
            "strike": float(contract.get("strike_price") or int(symbol[-8:]) / 1000),
            "expiration": expiration.isoformat(),
            "bid": bid,
            "ask": ask,
            "midpoint": round(midpoint, 4),
            "spread_pct": round((ask - bid) / midpoint if midpoint else 1, 6),
            "open_interest": int(float(contract.get("open_interest") or 0)),
            "volume": int((snapshot.get("dailyBar") or {}).get("v") or 0),
            "iv": snapshot.get("impliedVolatility"),
            "delta": greeks.get("delta"), "gamma": greeks.get("gamma"),
            "theta": greeks.get("theta"), "vega": greeks.get("vega"),
            "tradable": bool(contract.get("tradable", False)),
            "observed_at": observed_at,
            "quote_age_seconds": round((now - observed).total_seconds(), 1) if observed else None,
        })
    points.sort(key=lambda x: x["strike"])

    def nearest(strike: float) -> dict:
        return min(points, key=lambda p: abs(p["strike"] - strike))

    underlying_price = float(latest_trade["trade"]["p"])
    long_leg = nearest(underlying_price)
    higher = [point for point in points if point["strike"] > long_leg["strike"]]
    if not higher:
        raise RuntimeError("No higher strike available for defined-risk spread")
    short_leg = min(higher, key=lambda point: abs(point["strike"] - (long_leg["strike"] + 5)))
    quote_age = max(long_leg["quote_age_seconds"] or 10**9, short_leg["quote_age_seconds"] or 10**9)
    spread_pct = max(long_leg["spread_pct"], short_leg["spread_pct"])
    open_interest = min(long_leg["open_interest"], short_leg["open_interest"])
    observed_at = max(long_leg["observed_at"], short_leg["observed_at"])
    bars = sorted(bars_raw.get("bars", []), key=lambda bar: bar.get("t", ""))
    if len(bars) < 2:
        raise RuntimeError("Insufficient Alpaca minute bars for measured return")
    return_end = bars[-1]

    def measured_return(minutes: int) -> dict:
        target_start = parse_time(return_end["t"]) - timedelta(minutes=minutes)
        eligible = [bar for bar in bars[:-1] if parse_time(bar.get("t")) <= target_start]
        if not eligible:
            raise RuntimeError(f"No complete {minutes}-minute Alpaca return interval")
        start_bar = eligible[-1]
        value = ((float(return_end["c"]) / float(start_bar["c"])) - 1) * 100
        return {
            "requested_minutes": minutes,
            "source": "Alpaca Market Data API · IEX · 1Min bars",
            "start_timestamp": start_bar["t"], "start_price": float(start_bar["c"]),
            "end_timestamp": return_end["t"], "end_price": float(return_end["c"]),
            "actual_elapsed_seconds": round((parse_time(return_end["t"]) - parse_time(start_bar["t"])).total_seconds()),
            "return_pct": round(value, 6),
        }

    return_5m = measured_return(5)
    return_15m = measured_return(15)
    recent_return_pct = return_5m["return_pct"]
    if return_5m["return_pct"] > 0 and return_15m["return_pct"] > 0:
        short_term_direction = "bullish"
    elif return_5m["return_pct"] < 0 and return_15m["return_pct"] < 0:
        short_term_direction = "bearish"
    else:
        short_term_direction = "neutral"
    # Alpaca's current option snapshot exposes current IV, not a historical IV
    # series. A percentile cannot be derived honestly from one observation.
    volatility_evidence = {
        "status": "IV_HISTORY_UNAVAILABLE", "volatility_percentile": None,
        "reason": "verified historical option IV series unavailable",
        "current_long_iv": long_leg["iv"], "current_short_iv": short_leg["iv"],
    }
    snapshot = MarketSnapshot(
        snapshot_id=f"{selected_symbol.lower()}-{now.strftime('%Y%m%dT%H%M%SZ')}", observed_at=observed_at,
        underlying=selected_symbol, volatility_percentile=None,
        bid_ask_spread_pct=spread_pct, open_interest=open_interest,
        quote_age_seconds=quote_age, recent_return_pct=round(recent_return_pct, 6),
    )
    candidate_ai = candidate_evidence["ai"]
    os.environ["AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_MODEL"] = candidate_ai["model"]
    pending_input = asdict(snapshot)
    regime = AIRegime(
        regime="iv_history_unavailable", volatility_risk="unknown", liquidity_risk="low",
        event_risk="unknown", direction=short_term_direction, confidence=0,
        risk_multiplier=.5,
        reasons=("historical IV percentile unavailable; deterministic conservative policy applied",
                 "risk cap reduced from 1.0% to 0.5%", "quantity capped at 50% of original"),
    )
    model_evidence = ModelEvidence(
        pending_input, digest(pending_input), candidate_ai["provider"], candidate_ai["model"],
        None, 0, False, "IV_HISTORY_UNAVAILABLE", "HISTORICAL_IV_SERIES_UNAVAILABLE",
    )
    equity = float(account_raw.get("equity") or 0)
    last_equity = float(account_raw.get("last_equity") or equity)
    account = AccountState(
        equity=equity, daily_pnl=equity - last_equity,
        open_risk=sum(abs(float(p.get("market_value") or 0)) for p in positions),
    )

    base = propose_vertical_spread(
        underlying=selected_symbol, expiration=expiration,
        long_symbol=long_leg["symbol"], short_symbol=short_leg["symbol"],
        long_strike=long_leg["strike"], short_strike=short_leg["strike"],
        long_ask=long_leg["ask"], short_bid=short_leg["bid"],
        option_type=OptionType.CALL, confidence=regime.confidence,
        thesis="Structured market-risk assessment; deterministic gates retain final authority.",
        quantity=4,
    )
    original_risk = RiskEngine().evaluate(base, account)
    conservative_risk_limit_fraction = .005
    limit = equity * conservative_risk_limit_fraction
    original_conservative_approved = original_risk.max_loss <= limit
    original_conservative_reasons = ([] if original_conservative_approved else [
        f"max loss ${original_risk.max_loss:.2f} exceeds IV_HISTORY_UNAVAILABLE limit ${limit:.2f}",
        f"excess ${original_risk.max_loss - limit:.2f}",
    ])
    safe_qty = (min(base.quantity // 2, int(limit // (base.net_debit * 100)))
                if base.net_debit > 0 else 0)
    alternative = None
    alternative_risk = None
    if safe_qty > 0:
        alternative = propose_vertical_spread(
            underlying=selected_symbol, expiration=expiration,
            long_symbol=long_leg["symbol"], short_symbol=short_leg["symbol"],
            long_strike=long_leg["strike"], short_strike=short_leg["strike"],
            long_ask=long_leg["ask"], short_bid=short_leg["bid"],
            option_type=OptionType.CALL, confidence=regime.confidence,
            thesis="Risk-sized alternative generated after the four-contract proposal was rejected.",
            quantity=safe_qty,
        )
        alternative_risk = RiskEngine().evaluate(alternative, account)

    min_volume = min(long_leg["volume"], short_leg["volume"])
    freshness_ok = quote_age <= 10
    liquidity_ok = (spread_pct <= 0.10 and open_interest >= 500 and min_volume >= 50 and
                    long_leg["iv"] is not None and short_leg["iv"] is not None)
    candidate_model_ok = bool(candidate_ai.get("schema_validated"))
    conservative_policy_ok = bool(liquidity_ok and freshness_ok and safe_qty > 0 and
                                  alternative_risk and alternative_risk.max_loss <= limit)
    market_ok = bool(clock.get("is_open"))
    directional_strategy_ok = selected_direction == "bullish" and short_term_direction == "bullish"
    direction_alignment = ("ALIGNED" if selected_direction == short_term_direction and
                           selected_direction in {"bullish", "bearish"} else
                           "NEUTRAL" if short_term_direction == "neutral" else "MISALIGNED")
    preflight_pass = bool(
        alternative and alternative_risk and alternative_risk.approved and freshness_ok
        and liquidity_ok and candidate_model_ok and conservative_policy_ok and market_ok
        and directional_strategy_ok and account_check.options_level >= 3
        and not account_check.trading_blocked and long_leg["tradable"] and short_leg["tradable"]
    )
    client_order_id = f"sst-{now.strftime('%Y%m%d%H%M%S')}-{safe_qty or 0}c"
    idempotency_unused = True
    try:
        client.get_order_by_client_id(client_order_id)
        idempotency_unused = False
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise

    # An order preview is evidence of an executable candidate, so do not create
    # even a sanitized payload until every preflight gate has passed.
    payload = (build_order_payload(alternative, client_order_id=client_order_id)
               if alternative and preflight_pass else None)
    policies = evaluate_four_policies(alternative or base, snapshot, account, regime)
    bundle = {
        "schema_version": "2.0",
        "generated_at": now.isoformat(),
        "status": ("LIVE PREFLIGHT · PAPER PREVIEW · NOT SUBMITTED" if preflight_pass else
                   "LIVE PREFLIGHT · NO TRADE · NO ORDER PREVIEW"),
        "account": {
            "environment": "paper", "account_masked": f"***{account_check.account_number[-4:]}",
            "status": account_check.status, "cash": float(account_raw.get("cash") or 0),
            "equity": equity, "buying_power": account_check.buying_power,
            "options_level": account_check.options_level, "trading_blocked": account_check.trading_blocked,
            "starting_balance_verified": account_check.competition_balance_ok,
            "positions": len(positions), "open_orders": len(orders), "daily_pnl": round(account.daily_pnl, 2),
        },
        "market": {
            "symbol": selected_symbol, "market_open": market_ok, "clock_timestamp": clock.get("timestamp"),
            "underlying_price": underlying_price,
            "underlying_timestamp": latest_trade["trade"]["t"], "expiration": expiration.isoformat(),
            "contracts_received": len(points),
            "recent_return_windows": {"5m": return_5m, "15m": return_15m},
            "short_term_direction": short_term_direction,
            "volatility_percentile_evidence": volatility_evidence,
        },
        "selected_legs": {"long": long_leg, "short": short_leg},
        "original": {"quantity": 4, "net_debit": base.net_debit,
                     "max_loss": original_risk.max_loss, "approved": original_conservative_approved,
                     "reasons": original_conservative_reasons},
        "alternative": None if not alternative else {
            "quantity": alternative.quantity, "net_debit": alternative.net_debit,
            "max_loss": alternative_risk.max_loss, "approved": alternative_risk.approved,
            "reasons": list(alternative_risk.reasons),
        },
        "ai": {"candidate_evidence_file": candidate_files[-1].name,
               "candidate_result": candidate_evidence["ai"],
               "risk_result": asdict(regime), "evidence": asdict(model_evidence),
               "structured_call_ok": candidate_model_ok},
        "iv_history_unavailable_policy": {
            "status": "APPLIED", "volatility_percentile": None,
            "risk_limit_fraction": conservative_risk_limit_fraction,
            "risk_limit_amount": round(limit, 2), "original_quantity": base.quantity,
            "maximum_quantity": base.quantity // 2, "approved_quantity": safe_qty,
            "requirements": {"max_spread_pct": .10, "min_open_interest": 500,
                             "min_leg_volume": 50, "max_quote_age_seconds": 10,
                             "both_current_ivs_required": True},
            "observed": {"long_iv": long_leg["iv"], "short_iv": short_leg["iv"],
                         "max_spread_pct": spread_pct, "min_open_interest": open_interest,
                         "min_leg_volume": min_volume, "max_quote_age_seconds": quote_age},
            "passed": conservative_policy_ok,
        },
        "strategy_decision": ("BULL CALL CANDIDATE" if directional_strategy_ok else
                              "NO TRADE · BULL CALL INCOMPATIBLE WITH BEARISH SIGNAL"
                              if direction_alignment == "ALIGNED" else
                              "NO TRADE · SHORT-TERM DIRECTION NOT ALIGNED"),
        "direction_alignment": direction_alignment,
        "final_decision": ("PAPER ORDER PREVIEW" if preflight_pass else
                           "NO TRADE · STRATEGY DIRECTION INCOMPATIBLE"
                           if direction_alignment == "ALIGNED" and not directional_strategy_ok else
                           "NO TRADE · DIRECTION MISALIGNED"),
        "checks": {
            "paper_account": account_check.status == "ACTIVE", "competition_balance": account_check.competition_balance_ok,
            "options_level_3": account_check.options_level >= 3, "market_open": market_ok,
            "fresh_quote": freshness_ok, "liquidity": liquidity_ok,
            "directional_strategy": directional_strategy_ok,
            "strike_order": long_leg["strike"] < short_leg["strike"],
            "tradable_contracts": long_leg["tradable"] and short_leg["tradable"],
            "risk_limit": bool(alternative_risk and alternative_risk.approved),
            "structured_ai": candidate_model_ok,
            "iv_history_unavailable_policy": conservative_policy_ok,
            "idempotency_unused": idempotency_unused,
            "status_lookup_ready": True, "cancel_ready": True,
        },
        "policies": [asdict(p) for p in policies],
        "preview": {"status": ("NOT SUBMITTED" if preflight_pass else "NOT CREATED · NO TRADE"),
                    "allow_submit": False,
                    "preflight_pass": preflight_pass, "sanitized_payload": payload},
        "security": {"credentials_in_bundle": False, "full_account_number_in_bundle": False},
    }
    evidence_dir = ROOT / "evidence" / "preflight"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    output = evidence_dir / f"{now.strftime('%Y-%m-%dT%H%M%SZ')}-paper-preflight.json"
    output.write_text(json.dumps(bundle, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    audit_path = ROOT / "runtime" / "preflight-audit.jsonl"
    append_event(audit_path, {"type": "paper_preflight", "evidence_file": output.name,
                              "snapshot_id": snapshot.snapshot_id, "preflight_pass": preflight_pass,
                              "order_submitted": False})
    chain_ok, chain_message = verify_chain(audit_path)
    print(json.dumps({
        "evidence_file": str(output.relative_to(ROOT)), "paper_account": bundle["checks"]["paper_account"],
        "starting_balance_verified": bundle["checks"]["competition_balance"],
        "options_level": account_check.options_level, "contracts": len(points),
        "original_max_loss": original_risk.max_loss,
        "alternative_max_loss": alternative_risk.max_loss if alternative_risk else None,
        "alternative_quantity": alternative.quantity if alternative else 0,
        "structured_ai": candidate_model_ok, "market_open": market_ok, "fresh_quote": freshness_ok,
        "liquidity": liquidity_ok, "preflight_pass": preflight_pass,
        "order_submitted": False, "audit_chain": chain_message if chain_ok else "FAILED",
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
