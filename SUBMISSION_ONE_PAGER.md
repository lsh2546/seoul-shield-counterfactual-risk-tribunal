# Seoul Shield — Risk-First AI Options Agent

## Problem and idea

LLMs can explain a market thesis but should not have unchecked authority over a
brokerage account. Seoul Shield separates creative market reasoning from hard
portfolio controls. An AI regime classifier proposes a directional thesis and a
defined-risk debit spread; a deterministic gate independently approves or rejects
the order before it reaches Alpaca Paper Trading.

## AI logic

The research layer classifies momentum and volatility, attaches a confidence
score, and selects a bullish call debit spread or bearish put debit spread from
the current option chain. Its output is structured data—not a broker command.
This makes the proposal inspectable and lets any model be replaced without
weakening execution safety.

## Risk gates

Only two-leg, same-expiration vertical debit spreads are allowed. Maximum loss is
the debit paid × 100 × contracts. Each trade is capped at 1% of equity, aggregate
open risk at 5%, and the daily kill switch activates at a 2% loss. Contracts near
expiration, malformed structures, duplicate legs, credit trades, and oversized
positions are rejected. Every approval and refusal is written to an immutable-style
JSONL audit trail with a timestamp and reason.

## Alpaca implementation

The agent uses Alpaca's dedicated $100,000 competition Paper Trading account and
submits option multi-leg (`mleg`) limit orders to the paper endpoint. Execution is
protected by three controls: risk approval, an explicit CLI `--execute` flag, and
the `ALPACA_ALLOW_SUBMIT=true` environment latch. The default mode only produces
a full order preview. No live-trading endpoint or real capital is used.

## Demo

The demo shows an accepted small spread, an oversized spread rejected by the 1%
gate, and a third proposal blocked by the daily-loss kill switch. The audit log
then proves that both executed intentions and refusals remain explainable.
