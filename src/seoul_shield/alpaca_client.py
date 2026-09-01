from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
import urllib.error
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class PaperAccountCheck:
    account_number: str
    status: str
    equity: float
    buying_power: float
    options_level: int
    trading_blocked: bool
    competition_balance_ok: bool


class AlpacaClient:
    """Small read-mostly client pinned to Alpaca paper and market-data hosts."""

    def __init__(self, key: str | None = None, secret: str | None = None):
        self.key = key or os.getenv("ALPACA_API_KEY")
        self.secret = secret or os.getenv("ALPACA_SECRET_KEY")
        if not self.key or not self.secret:
            raise RuntimeError("Set Alpaca paper credentials in environment variables")

    @property
    def headers(self) -> dict[str, str]:
        return {"APCA-API-KEY-ID": self.key, "APCA-API-SECRET-KEY": self.secret}

    def _get(self, url: str, params: dict | None = None) -> dict:
        if params:
            url += "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers=self.headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read())

    def _delete(self, url: str) -> dict:
        request = urllib.request.Request(url, headers=self.headers, method="DELETE")
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read()
                return json.loads(body) if body else {"status": "cancel_requested"}
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Alpaca cancel failed ({exc.code})") from exc

    def check_competition_account(self) -> PaperAccountCheck:
        raw = self._get("https://paper-api.alpaca.markets/v2/account")
        initial = float(raw.get("last_equity") or raw.get("equity") or 0)
        level = int(raw.get("options_trading_level") or raw.get("options_approved_level") or 0)
        return PaperAccountCheck(
            account_number=str(raw.get("account_number", "")),
            status=str(raw.get("status", "unknown")),
            equity=float(raw.get("equity", 0)),
            buying_power=float(raw.get("buying_power", 0)),
            options_level=level,
            trading_blocked=bool(raw.get("trading_blocked", False)),
            competition_balance_ok=abs(initial - 100_000) < 0.01,
        )

    def account(self) -> dict:
        return self._get("https://paper-api.alpaca.markets/v2/account")

    def clock(self) -> dict:
        return self._get("https://paper-api.alpaca.markets/v2/clock")

    def orders(self) -> list[dict]:
        result = self._get("https://paper-api.alpaca.markets/v2/orders", {"status": "open"})
        return result if isinstance(result, list) else []

    def latest_stock_trade(self, symbol: str, *, feed: str = "iex") -> dict:
        return self._get(
            f"https://data.alpaca.markets/v2/stocks/{symbol.upper()}/trades/latest",
            {"feed": feed},
        )

    def option_contracts(self, underlying: str, *, expiration: date,
                         option_type: str = "call") -> dict:
        return self._get(
            "https://paper-api.alpaca.markets/v2/options/contracts",
            {"underlying_symbols": underlying.upper(),
             "expiration_date": expiration.isoformat(), "type": option_type,
             "status": "active", "limit": 10000},
        )

    def option_chain(self, underlying: str, *, expiration: date,
                     option_type: str, feed: str = "indicative") -> dict:
        return self._get(
            f"https://data.alpaca.markets/v1beta1/options/snapshots/{underlying.upper()}",
            {"expiration_date": expiration.isoformat(), "type": option_type,
             "feed": feed, "limit": 1000},
        )

    def get_order(self, order_id: str) -> dict:
        return self._get(f"https://paper-api.alpaca.markets/v2/orders/{order_id}",
                         {"nested": "true"})

    def get_order_by_client_id(self, client_order_id: str) -> dict:
        return self._get("https://paper-api.alpaca.markets/v2/orders:by_client_order_id",
                         {"client_order_id": client_order_id})

    def cancel_order(self, order_id: str) -> dict:
        return self._delete(f"https://paper-api.alpaca.markets/v2/orders/{order_id}")

    def positions(self) -> list[dict]:
        result = self._get("https://paper-api.alpaca.markets/v2/positions")
        return result if isinstance(result, list) else []
