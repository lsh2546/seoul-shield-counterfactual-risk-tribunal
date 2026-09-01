from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from seoul_shield.ai_regime import static_fallback
from seoul_shield.alpaca_client import AlpacaClient
from seoul_shield.broker import build_order_payload
from seoul_shield.models import AccountState, MarketSnapshot, OptionType
from seoul_shield.policies import evaluate_four_policies
from seoul_shield.risk import RiskEngine
from seoul_shield.strategy import propose_vertical_spread


def load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> None:
    load_env()
    if os.getenv("ALPACA_ALLOW_SUBMIT", "false").lower() != "false":
        raise RuntimeError("Preview generation requires ALPACA_ALLOW_SUBMIT=false")

    client = AlpacaClient()
    expiration = date(2026, 9, 4)
    account_raw = client.account()
    clock = client.clock()
    positions = client.positions()
    orders = client.orders()
    trade = client.latest_stock_trade("SPY")
    chain_raw = client.option_chain("SPY", expiration=expiration, option_type="call")
    contracts_raw = client.option_contracts("SPY", expiration=expiration)

    meta = {item["symbol"]: item for item in contracts_raw.get("option_contracts", [])}
    points: list[dict] = []
    for symbol, snap in chain_raw.get("snapshots", {}).items():
        quote = snap.get("latestQuote") or {}
        details = meta.get(symbol, {})
        bid, ask = quote.get("bp"), quote.get("ap")
        if bid is None or ask is None or float(ask) <= 0 or float(ask) < float(bid):
            continue
        midpoint = (float(bid) + float(ask)) / 2
        spread_pct = (float(ask) - float(bid)) / midpoint if midpoint else 1
        strike = float(details.get("strike_price") or int(symbol[-8:]) / 1000)
        oi = int(float(details.get("open_interest") or 0))
        iv = snap.get("impliedVolatility")
        greeks = snap.get("greeks") or {}
        observed = quote.get("t") or snap.get("latestTrade", {}).get("t")
        age = (datetime.now(timezone.utc) - iso(observed)).total_seconds() if observed else None
        points.append({
            "symbol": symbol, "expiration": expiration.isoformat(), "strike": strike,
            "bid": float(bid), "ask": float(ask), "midpoint": round(midpoint, 4),
            "spread_pct": round(spread_pct, 6), "open_interest": oi,
            "volume": int((snap.get("dailyBar") or {}).get("v") or 0),
            "iv": float(iv) if iv is not None else None,
            "delta": greeks.get("delta"), "gamma": greeks.get("gamma"),
            "theta": greeks.get("theta"), "vega": greeks.get("vega"),
            "bid_size": int(quote.get("bs") or 0), "ask_size": int(quote.get("as") or 0),
            "tradable": bool(details.get("tradable", False)), "observed_at": observed,
            "quote_age_seconds": round(age, 1) if age is not None else None,
        })

    points.sort(key=lambda p: p["strike"])
    if len(points) < 2:
        raise RuntimeError("Alpaca returned fewer than two usable call contracts")

    def nearest(strike: float) -> dict:
        return min(points, key=lambda p: abs(p["strike"] - strike))

    long_leg, short_leg = nearest(765), nearest(770)
    if long_leg["strike"] >= short_leg["strike"]:
        raise RuntimeError("Selected call spread has invalid strike ordering")
    quote_time = max(filter(None, [long_leg["observed_at"], short_leg["observed_at"]]))
    combined_spread = max(long_leg["spread_pct"], short_leg["spread_pct"])
    combined_oi = min(long_leg["open_interest"], short_leg["open_interest"])
    quote_age = max(long_leg["quote_age_seconds"] or 999999, short_leg["quote_age_seconds"] or 999999)
    snapshot_id = f"spy-{quote_time.replace(':', '').replace('-', '')}"
    snapshot = MarketSnapshot(
        snapshot_id=snapshot_id, observed_at=quote_time, underlying="SPY",
        volatility_percentile=0.5, bid_ask_spread_pct=combined_spread,
        open_interest=combined_oi, quote_age_seconds=quote_age, recent_return_pct=0,
    )
    regime = static_fallback(snapshot)
    proposal = propose_vertical_spread(
        underlying="SPY", expiration=expiration,
        long_symbol=long_leg["symbol"], short_symbol=short_leg["symbol"],
        long_strike=long_leg["strike"], short_strike=short_leg["strike"],
        long_ask=long_leg["ask"], short_bid=short_leg["bid"],
        option_type=OptionType.CALL, confidence=regime.confidence,
        thesis="Deterministic fail-closed classification; live OpenAI call not authorized.",
        quantity=4,
    )
    equity = float(account_raw.get("equity") or 0)
    last_equity = float(account_raw.get("last_equity") or equity)
    account = AccountState(
        equity=equity,
        daily_pnl=equity - last_equity,
        open_risk=sum(abs(float(p.get("market_value") or 0)) for p in positions),
    )
    policies = evaluate_four_policies(proposal, snapshot, account, regime)
    client_order_id = f"sst-preview-{snapshot_id[-20:]}"
    payload = build_order_payload(proposal, client_order_id=client_order_id)
    risk = RiskEngine().evaluate(proposal, account)
    for point in points:
        if point["symbol"] in {long_leg["symbol"], short_leg["symbol"]}:
            point["selected"] = "long" if point["symbol"] == long_leg["symbol"] else "short"
        else:
            point["selected"] = None
        # Candidate quality is visualized independently from the snapshot-wide
        # freshness gate. A stale snapshot still blocks every live action below.
        if not point["tradable"] or point["spread_pct"] > 0.20 or point["open_interest"] < 10:
            point["classification"] = "RISK BLOCKED"
        elif point["spread_pct"] <= 0.03 and point["open_interest"] >= 100:
            point["classification"] = "OPPORTUNITY"
        else:
            point["classification"] = "UNCERTAIN"

    bundle = {
        "schema_version": "1.0", "generated_at": datetime.now(timezone.utc).isoformat(),
        "evidence_status": "LIVE DATA · PAPER PREVIEW · NOT SUBMITTED",
        "ai_status": "FALLBACK / NOT LIVE AI", "source": "Alpaca Trading + Market Data APIs",
        "account": {
            "environment": "paper", "account_masked": f"***{str(account_raw.get('account_number', ''))[-4:]}",
            "status": account_raw.get("status"), "cash": float(account_raw.get("cash") or 0),
            "equity": equity, "buying_power": float(account_raw.get("buying_power") or 0),
            "options_level": int(account_raw.get("options_trading_level") or account_raw.get("options_approved_level") or 0),
            "positions": len(positions), "open_orders": len(orders), "daily_pnl": round(account.daily_pnl, 2),
            "starting_balance_verified": abs(last_equity - 100000) < 0.01,
        },
        "market": {
            "symbol": "SPY", "underlying_price": float(trade["trade"]["p"]),
            "underlying_timestamp": trade["trade"]["t"], "market_open": bool(clock.get("is_open")),
            "clock_timestamp": clock.get("timestamp"), "expiration": expiration.isoformat(),
        },
        "terrain": points,
        "selection": {
            "strategy": "bull call debit spread", "long": long_leg, "short": short_leg,
            "net_debit": proposal.net_debit, "width": short_leg["strike"] - long_leg["strike"],
            "requested_contracts": proposal.quantity, "max_loss": risk.max_loss,
            "max_profit": round(((short_leg["strike"] - long_leg["strike"]) - proposal.net_debit) * 100 * proposal.quantity, 2),
            "quote_age_seconds": quote_age, "reason": "Target 765/770 defined-risk vertical; quote and liquidity are independently gated.",
        },
        "ai": {**asdict(regime), "status": "FALLBACK / NOT LIVE AI", "model_called": False},
        "risk": {
            "hard_gate": "PASS" if risk.approved else "BLOCKED", "reasons": list(risk.reasons),
            "trade_risk_limit": equity * 0.01, "portfolio_risk_limit": equity * 0.05,
            "daily_loss_stop": equity * 0.02, "current_open_risk": account.open_risk,
        },
        "policies": [
            {"name": p.universe.value, "action": "PREVIEW" if p.universe.value == "live_execution" and p.approved_quantity else p.action.upper(),
             "requested": p.requested_quantity, "approved": p.approved_quantity,
             "max_loss": p.max_loss, "reasons": list(p.reasons),
             "actual_order_authority": p.actual_order_authority}
            for p in policies
        ],
        "preview": {"status": "NOT SUBMITTED", "allow_submit": False, "payload": payload},
        "security": {"contains_credentials": False, "contains_full_account_number": False},
    }
    out = ROOT / "evidence" / "previews" / "2026-09-01-live-preview.json"
    public = ROOT / "app" / "public" / "data" / "preview.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(bundle, indent=2, ensure_ascii=False)
    out.write_text(text + "\n", encoding="utf-8")
    public.write_text(text + "\n", encoding="utf-8")
    print(json.dumps({"generated": True, "contracts": len(points),
                      "selected": [long_leg["symbol"], short_leg["symbol"]],
                      "quote_age_seconds": quote_age, "hard_gate": bundle["risk"]["hard_gate"],
                      "orders_submitted": False}, separators=(",", ":")))


if __name__ == "__main__":
    main()
