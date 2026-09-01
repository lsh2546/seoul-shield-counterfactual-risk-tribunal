# Seoul Shield - Counterfactual Risk Tribunal

**Other agents prove they can trade. Seoul Shield proves which safety policy deserves the right to trade.**

## The problem

An AI can produce a persuasive options thesis, but persuasion is not permission to move capital. Most agent demos show one decision and one outcome; they do not reveal whether a safer policy would have prevented excessive exposure or whether the model can bypass its guardrails.

## The system

Seoul Shield sends one market signal and one immutable snapshot into four simultaneous policy paths. **No Guard** preserves the unprotected proposal as a shadow baseline. **Static Guard** applies fixed limits. **Adaptive Guard** considers regime, liquidity, quote age, exposure, and recent loss. **Live Execution** is the only path capable of reaching Alpaca Paper Trading, and only after deterministic gates, idempotency checks, and explicit human approval.

The AI layer returns structured market-state and risk factors, but never broker authority. Timeout, invalid JSON, or an unavailable model triggers a fail-closed fallback. Hard limits cannot be weakened by model output: maximum loss per trade is 1% of equity, aggregate portfolio risk is 5%, and the daily-loss stop is 2%.

## Verified Alpaca replay

Sanitized evidence confirms an active Alpaca Paper account with **$100,000 cash/equity**, **$400,000 buying power**, **Options Level 3**, and no positions or open orders. Seoul Shield inspected **245 SPY calls** expiring September 4, 2026 and classified them as **21 Opportunity, 80 Uncertain, and 144 Risk Blocked**.

Candidate gates reduced 21 opportunities to a bull call debit spread: **buy SPY 765C at the $5.06 ask and sell SPY 770C at the $2.32 bid**. At a **$2.74 net debit** and **four contracts**, maximum loss is **$1,096**. The deterministic limit is **$1,000**, so the capital gate closes at **$96 over limit**.

The No Guard shadow path exposes the full $1,096. Static Guard rejects the 1% breach. Adaptive Guard also fails closed because the replay quote is stale and the AI is **FALLBACK / NOT LIVE AI**. Live Execution remains **PAPER PREVIEW - HUMAN APPROVAL REQUIRED - NOT SUBMITTED**. No fill, return, or realized P&L is claimed.

## Alpaca and implementation evidence

- Alpaca Trading and Market Data APIs for Paper account, underlying, option-chain, quote, position, and order-state workflows
- Alpaca MCP read-only evidence in the sanitized evidence package
- MLEG Paper payload with `buy_to_open` / `sell_to_open` position intent
- Unique `client_order_id`, duplicate prevention, order status, and cancellation paths
- Hash-chain audit linking snapshot, AI/fallback result, policy decisions, gate reasons, and preview
- Python risk core with 20 passing tests; read-only Three.js tribunal plus 2D fallback

## Why it is different

The public experience is an evidence room, not an execution console. Sanitized Alpaca replay data flows through the Capital Decision Engine, converges on a spread, and splits into four counterfactual futures. Judges can see exactly why a trade advances, resizes, or stops - and which safety policy has earned the right to trade.

**Evidence:** VERIFIED ALPACA REPLAY · PAPER PREVIEW · NOT SUBMITTED  
**Safety latch:** `ALPACA_ALLOW_SUBMIT=false`
