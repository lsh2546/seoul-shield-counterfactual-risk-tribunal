from __future__ import annotations

from datetime import date

from .models import AccountState, OptionType, PositionIntent, RiskDecision, Side, TradeProposal


class RiskEngine:
    def __init__(self, *, max_trade_risk_pct: float = 0.01,
                 max_portfolio_risk_pct: float = 0.05,
                 daily_stop_pct: float = 0.02, min_days_to_expiry: int = 2):
        self.max_trade_risk_pct = max_trade_risk_pct
        self.max_portfolio_risk_pct = max_portfolio_risk_pct
        self.daily_stop_pct = daily_stop_pct
        self.min_days_to_expiry = min_days_to_expiry

    def evaluate(self, proposal: TradeProposal, account: AccountState,
                 *, today: date | None = None) -> RiskDecision:
        today = today or date.today()
        reasons: list[str] = []
        if len(proposal.legs) != 2:
            reasons.append("only two-leg defined-risk verticals are permitted")
        if proposal.quantity < 1:
            reasons.append("quantity must be positive")
        if not 0 <= proposal.confidence <= 1:
            reasons.append("confidence must be between 0 and 1")
        if proposal.net_debit <= 0:
            reasons.append("credit or zero-cost structures are disabled")

        if len(proposal.legs) == 2:
            a, b = proposal.legs
            if a.expiration != b.expiration or a.option_type != b.option_type:
                reasons.append("legs must share expiration and option type")
            if {a.side, b.side} != {Side.BUY, Side.SELL}:
                reasons.append("vertical must contain one buy and one sell leg")
            if len({a.symbol, b.symbol}) != 2:
                reasons.append("leg symbols must be unique")
            long_leg = a if a.side == Side.BUY else b
            short_leg = b if a.side == Side.BUY else a
            if long_leg.option_type == OptionType.CALL and long_leg.strike >= short_leg.strike:
                reasons.append("call debit spread requires long strike below short strike")
            if long_leg.option_type == OptionType.PUT and long_leg.strike <= short_leg.strike:
                reasons.append("put debit spread requires long strike above short strike")
            if long_leg.position_intent != PositionIntent.BUY_TO_OPEN:
                reasons.append("long leg must be buy_to_open")
            if short_leg.position_intent != PositionIntent.SELL_TO_OPEN:
                reasons.append("short leg must be sell_to_open")
            if (a.expiration - today).days < self.min_days_to_expiry:
                reasons.append("expiration is too close")

        # A debit spread cannot lose more than the debit paid (100 shares/contract).
        max_loss = max(0.0, proposal.net_debit * 100 * proposal.quantity)
        risk_fraction = max_loss / account.equity if account.equity > 0 else 1.0
        if risk_fraction > self.max_trade_risk_pct:
            reasons.append("per-trade risk limit exceeded")
        if account.open_risk + max_loss > account.equity * self.max_portfolio_risk_pct:
            reasons.append("portfolio risk limit exceeded")
        if account.daily_pnl <= -account.equity * self.daily_stop_pct:
            reasons.append("daily loss kill switch active")

        return RiskDecision(not reasons, tuple(reasons), round(max_loss, 2), risk_fraction)
