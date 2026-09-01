# Policy Trust Score — Frozen Specification

Version: `trust-v1-2026-08-31`

This specification was fixed before any live or paper-trading outcome was
observed. Changing weights requires a new version and must never rewrite the
score of an earlier evidence bundle.

| Component | Weight | Normalization |
|---|---:|---|
| Loss protection | 0.30 | `clamp(loss_avoided / abs(no_guard_losses), 0, 1)` |
| Drawdown control | 0.20 | `clamp(drawdown_prevented / abs(no_guard_max_drawdown), 0, 1)` |
| Opportunity efficiency | 0.20 | `1 - clamp(profit_sacrificed / no_guard_positive_profit, 0, 1)` |
| Gate precision | 0.15 | `loss-making blocked trades / all blocked trades` |
| Hard-limit compliance | 0.10 | `compliant decisions / all decisions` |
| Evidence completeness | 0.05 | `present required evidence fields / all required fields` |

All component values are clamped to `[0, 1]`. The UI must expose the raw value,
weight, weighted value, specification version, and final score. Undefined
denominators score zero rather than being silently excluded.

`Loss Avoided = max(0, Guard PnL - NoGuard PnL)` only when `NoGuard PnL < 0`.
Each trade separately attributes the improvement to full rejection, quantity
reduction, and fill-price difference before aggregation.
