# Seoul Shield - Autonomous Control Layer for AI Trading

## 2026 Final Verified Safety Result

**NOT EXECUTED - SAFETY GATE BLOCKED. Orders 0, positions 0, capital moved $0.**

Using live Alpaca Paper data, Gemini selected AAPL with a schema-verified bullish assessment. The proposed four-contract AAPL 330/335 bull call debit spread carried **$952 maximum loss** and failed the conservative **$500** risk cap. Seoul Shield resized it to two contracts with **$476 maximum loss** and created a Paper Preview only. Before execution, AAPL's measured 5- and 15-minute direction turned bearish. The system invalidated the bullish strategy, kept `ALPACA_ALLOW_SUBMIT=false`, and submitted no order.

The evidence package does not claim a fill, position, profit, loss, or P&L. Historical IV percentile data was unavailable, so the system disclosed `IV_HISTORY_UNAVAILABLE` and used actual current IV, spread, OI, volume, quote age, and measured returns under a stricter deterministic policy.

> Most AI agents try to predict the market. Seoul Shield controls whether their decisions are still safe enough to reach it.

Seoul Shield is an autonomous control layer that continuously revalidates AI trading decisions before capital moves. Gemini may propose a trade, but it cannot authorize capital movement. Independent deterministic gates validate direction, liquidity, quote freshness, position size, and maximum loss immediately before the Paper gateway.

## Links

- **Verified Safety Demo:** https://lsh2546.github.io/seoul-shield-counterfactual-risk-tribunal/
- **Main submission video source:** `Seoul-Shield-Autonomous-Control-Layer-4m20s-V3-SUBTITLE-SAFEZONE-CANDIDATE.mp4`
- **Main video SHA-256:** `4E2AD210B280964EE3F7E327F86ADB0A1155110B5D90E9C4540E164819DAF0C2`
- **Public main-video URL:** https://youtu.be/cwlbxvQxEEM
- **90-second supporting demo:** [Seoul-Shield-FINAL-SAFETY-EVIDENCE-90s.mp4](submission/assets/Seoul-Shield-FINAL-SAFETY-EVIDENCE-90s.mp4)
- **One-page PDF:** [Seoul-Shield-Verified-Safety-Evidence-One-Page.pdf](output/pdf/Seoul-Shield-Verified-Safety-Evidence-One-Page.pdf)
- **Source Repository:** https://github.com/lsh2546/seoul-shield-counterfactual-risk-tribunal

## Verified replay at a glance

| Evidence | Verified value |
| --- | --- |
| Environment | Alpaca Paper Trading |
| Cash / equity | $100,000 / $100,000 |
| Buying power | $400,000 |
| Options approval | Level 3 |
| Positions / open orders | 0 / 0 |
| Candidate scan | SPY / QQQ / AAPL / NVDA |
| Selected proposal | AAPL bullish, confidence 85% |
| Proposed spread | Buy AAPL 330C / sell AAPL 335C |
| Limit debit | $2.38 |
| Original quantity / maximum loss | 4 contracts / $952 |
| Controlled quantity / maximum loss | 2 contracts / $476 |
| Conservative policy limit | $500 |
| Final verdict | Bullish Preview invalidated after bearish 5- and 15-minute reversal; NO TRADE |

The public app is a sanitized, read-only replay. Its visible status is **VERIFIED ALPACA REPLAY · PAPER PREVIEW · NOT SUBMITTED**. Evidence remains traceable to preserved candidate, preflight, and reversal snapshots. No fill, return, or realized P&L is claimed.

## Architecture

```text
Preserved Alpaca candidate snapshot
             |
Gemini structured proposal (advisory only)
             |
Preserved AAPL option preflight snapshot
             |
Deterministic direction, liquidity, freshness, and loss gates
             |
4 contracts / $952 blocked -> 2 contracts / $476 Preview
             |
AAPL signal reversal -> Preview invalidated
             |
No Trade + SHA-256 audit evidence
```

### Policy authority

- **No Guard** is a shadow baseline and never submits an order.
- **Static Guard** applies fixed risk limits and never submits an order.
- **Adaptive Guard** considers regime, quote quality, liquidity, exposure, and recent loss; it never submits an order.
- **Live Execution** inherits the safe verdict and is the only path with Paper authority. It still requires explicit human approval and `ALPACA_ALLOW_SUBMIT=true`.

## Safety invariants

- Paper endpoint only; live brokerage endpoints are unsupported.
- Preview is the default. This repository ships with `ALPACA_ALLOW_SUBMIT=false`.
- Two-leg, same-expiration vertical debit spreads only.
- Correct strike ordering and per-leg `position_intent` validation.
- Maximum trade loss 1% of equity; portfolio open risk 5%; daily-loss stop 2%.
- Unique `client_order_id` and local idempotency protection.
- AI output cannot relax a deterministic limit. Timeout, malformed JSON, or an unavailable model fails closed.
- Audit records are chained by hash; public evidence is sanitized before export.

## Repository map

```text
src/seoul_shield/       Python policy, risk, broker, AI, audit, and preview core
tests/                  Unit and replay-contract tests
scripts/                Account checks, preview generation, and demo capture
evidence/               Sanitized account, MCP, and preview evidence
app/                    Read-only Three.js tribunal and 2D fallback
submission/             Narration and submission supporting material
```

## Local setup

Python 3.11+ and Node.js 22+ are recommended.

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -e .
$env:PYTHONPATH="src"
python -m pytest -q

cd app
npm install
npm run lint
npm run build
npm run dev
```

The app reads `app/public/data/preview.json`; visitors need no credentials and cannot submit orders.

## Private credential setup

Copy `.env.example` to an untracked `.env` and insert Paper credentials locally. Never paste keys into issues, commits, screenshots, or recordings.

```env
ALPACA_API_KEY=replace_me
ALPACA_SECRET_KEY=replace_me
ALPACA_ALLOW_SUBMIT=false
OPENAI_API_KEY=replace_me
OPENAI_MODEL=gpt-5-mini
```

```powershell
$env:PYTHONPATH="src"
python scripts/check_account.py
python scripts/build_live_preview.py
```

## Validation

- Python: 20 tests passing
- Web lint: passing
- Production web build: passing
- Secrets and runtime artifacts: excluded by `.gitignore`

## Honest limitations

- The included market evidence is a timestamped replay, not a live public feed.
- IV and Greeks appear only when present in sanitized evidence; unavailable fields are not invented.
- Gemini structured analysis is advisory and has no broker authority.
- The MLEG payload is a preview. It was not submitted, filled, or canceled.
- Counterfactual P&L requires later realized outcomes; this snapshot demonstrates decisions and exposure, not performance.

## License and disclaimer

MIT licensed. Verifiable Alpaca Paper Trading demonstration. Options involve substantial risk; this project is not investment advice and must not be used with a live-money account.
