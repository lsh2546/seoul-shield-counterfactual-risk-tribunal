# Seoul Shield Submission Fields

## Project name

Seoul Shield - Counterfactual Risk Tribunal

## Opening sentence

Seoul Shield is an autonomous control layer that continuously revalidates AI trading decisions before capital moves.

## Tagline

Most trading agents predict one future. Seoul Shield compares two before capital moves.

## Short description

Seoul Shield is a risk-first AI options agent that compares an original trade with a safer counterfactual before capital moves. Gemini ranks live Alpaca market candidates, while an independent deterministic engine verifies direction, liquidity, quote freshness, position size, and maximum loss. A human-controlled Paper gateway remains locked unless every condition passes.

## What was verified

Using live Alpaca Paper evidence, Gemini selected AAPL in a schema-validated response. The original four-contract 330/335 bull call debit spread carried $952 maximum loss and was blocked by a conservative $500 cap. A two-contract alternative reduced maximum loss to $476 and reached Preview only. Before execution, AAPL's measured 5- and 15-minute direction changed from bullish to bearish, so Seoul Shield invalidated the Bull Call and produced a final NO TRADE decision.

## Final result

NOT EXECUTED - SAFETY GATE BLOCKED. Orders 0, positions 0, capital moved $0. No fill or P&L is claimed.

## Technologies

Alpaca Trading API, Alpaca Market Data API, Alpaca Paper Trading, Gemini structured output, Python deterministic risk engine, SHA-256 audit chain, Next.js, React, Three.js, Cloudflare Workers.

## Links

- Demo: https://lsh2546.github.io/seoul-shield-counterfactual-risk-tribunal/
- Repository: https://github.com/lsh2546/seoul-shield-counterfactual-risk-tribunal
- Main video source filename: `Seoul-Shield-Autonomous-Control-Layer-4m20s-V3-SUBTITLE-SAFEZONE-CANDIDATE.mp4`
- Main video SHA-256: `4E2AD210B280964EE3F7E327F86ADB0A1155110B5D90E9C4540E164819DAF0C2`
- Main video public URL: https://youtu.be/cwlbxvQxEEM
- Supporting 90-second video: https://github.com/lsh2546/seoul-shield-counterfactual-risk-tribunal/blob/master/submission/assets/Seoul-Shield-FINAL-SAFETY-EVIDENCE-90s.mp4
