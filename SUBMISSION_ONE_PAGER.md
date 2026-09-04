# Seoul Shield - Autonomous Control Layer for AI Trading

**Most AI agents try to predict the market. Seoul Shield controls whether their decisions are still safe enough to reach it.**

## The problem

AI trading can fail after a valid forecast because an oversized or stale decision reaches the market after conditions change. A model proposal is therefore not permission to move capital.

## The system

Seoul Shield separates proposal from authority. Alpaca market evidence feeds Gemini structured analysis; an independent deterministic engine then revalidates direction, liquidity, quote freshness, position size, and maximum loss. Only a still-valid path can reach the human-controlled Paper gateway.

Gemini never receives broker authority. Invalid model output, stale evidence, direction disagreement, or a hard-limit failure closes the gate. Every transition remains traceable to its preserved source snapshot and SHA-256 evidence.

## Verified Alpaca replay

Sanitized evidence confirms an active Alpaca Paper account with **$100,000 cash/equity**, **$400,000 buying power**, **Options Level 3**, and no positions or open orders. A preserved four-symbol scan covered **SPY, QQQ, AAPL, and NVDA**. Gemini returned schema-valid candidate results and selected AAPL with **85% bullish confidence**.

The preserved AAPL option preflight recorded AAPL spot at **$330.30**. The 330 Call showed Bid **$5.63**, Ask **$5.86**, IV **28.03%**, OI **5,994**, and volume **1,576**. The 335 Call showed Bid **$3.48**, Ask **$3.52**, IV **27.67%**, OI **4,223**, and volume **1,601**. The resulting Limit Debit was **$2.38**.

The proposed four-contract AAPL 330/335 Bull Call carried **$952 maximum loss**, exceeding the conservative **$500** cap by **$452**. The engine generated a two-contract, **$476** Preview alternative. Before execution, measured 5- and 15-minute direction turned bearish, so the bullish Preview was invalidated. The final result is **NO TRADE - NOT SUBMITTED**. No fill, return, or realized P&L is claimed.

## Alpaca and implementation evidence

- Alpaca Trading and Market Data APIs for Paper account, underlying, option-chain, quote, position, and order-state workflows
- Structured Gemini proposal without broker credentials or order authority
- Deterministic risk calculation and conservative `IV_HISTORY_UNAVAILABLE` policy
- Paper Preview with `buy_to_open` / `sell_to_open` position intent
- Hash-chain audit linking candidate input, model response, preflight, reversal, and NO TRADE result
- Read-only product UI; no public order-submission endpoint

## Why it is different

The public experience demonstrates a reusable safety and audit layer for asset managers, brokers, fintech trading applications, and trading teams. It does not promise perfect predictions. It prevents stale, oversized, or directionally invalid AI decisions from moving capital.

**Evidence:** VERIFIED ALPACA REPLAY · PAPER PREVIEW · NOT SUBMITTED  
**Safety latch:** `ALPACA_ALLOW_SUBMIT=false`

**Main video:** `Seoul-Shield-Autonomous-Control-Layer-4m20s-V3-SUBTITLE-SAFEZONE-CANDIDATE.mp4`

**SHA-256:** `4E2AD210B280964EE3F7E327F86ADB0A1155110B5D90E9C4540E164819DAF0C2`

**YouTube:** https://youtu.be/cwlbxvQxEEM
