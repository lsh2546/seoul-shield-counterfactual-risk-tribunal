# Seoul Shield — 3:40 English Demo Narration

Target runtime: **3 minutes 40 seconds**. Delivery: calm and precise, approximately 145–150 words per minute with short pauses on the Hard Gate and final message. Status language must match the evidence shown on screen.

## 0:00–0:08 — Data-classification teaser

Two hundred forty-five option contracts enter. Twenty-one survive as opportunities. Eight pass expiration. Four pass liquidity. Two become one defined-risk spread—and the capital gate closes.

## 0:08–0:30 — The problem

Most autonomous trading agents are designed to find a reason to trade. But when an AI can move capital, prediction is only half the problem. The harder question is authority: which safety policy deserves the right to execute? Seoul Shield is a Counterfactual Risk Tribunal built to answer that question with the same signal, the same market snapshot, and four different execution policies.

## 0:30–1:05 — Alpaca account and evidence snapshot

This run begins with an Alpaca Paper Trading account configured for the hackathon. The sanitized evidence confirms one hundred thousand dollars in cash, four hundred thousand dollars in buying power, options level three, no open positions, and no open orders. Seoul Shield reads the underlying SPY price, account exposure, market status, and an Alpaca options chain containing two hundred forty-five contracts. Every quote carries a timestamp. This captured snapshot is marked stale, so the system does not pretend it is live. The AI layer is also marked fallback, not live AI, because no paid model call was made in this replay.

## 1:05–1:40 — Intake and classification

The Capital Decision Engine now normalizes strike, expiration, implied volatility when available, bid and ask, spread quality, open interest, quote age, and tradability. Each contract travels through market, liquidity, and risk inspection. The result is not decorative animation; every route comes from the replay bundle. Twenty-one contracts are classified as opportunities, eighty require review, and one hundred forty-four are blocked. Stale quotes, wide spreads, weak liquidity, and capital-risk violations are isolated before they can reach an execution path.

## 1:40–2:15 — Candidate convergence

The twenty-one opportunity candidates enter a sequence of deterministic gates. Expiration removes incompatible contracts. Strike ordering preserves a valid call-spread structure. Open interest and liquidity eliminate contracts that cannot support a responsible order. Defined-risk validation leaves two legs: buy the SPY seven-sixty-five call and sell the SPY seven-seventy call. The long ask is five dollars and six cents. The short bid is two dollars and thirty-two cents. Together they form a net debit of two dollars and seventy-four cents per share.

## 2:15–2:45 — Defined risk and hard gate

At four requested contracts, the net debit creates a maximum possible loss of one thousand ninety-six dollars. Seoul Shield compares that number with a fixed one-percent trade-risk limit: one thousand dollars on this account. The order is ninety-six dollars over the limit. This rule is outside the AI model and cannot be relaxed by a persuasive response, a timeout, or malformed JSON. The hard gate therefore blocks the proposal. Quote stale. AI fallback. Paper preview only. Nothing has been submitted.

## 2:45–3:20 — Four-Future Tribunal

Now the identical order signal enters four counterfactual futures. No Guard allows all four contracts to continue, exposing one thousand ninety-six dollars—but remains shadow-only and has no order authority. Static Guard closes at the one-thousand-dollar hard limit: blocked, ninety-six dollars over. Adaptive Guard inspects quote age, AI status, and liquidity. Because the quote is stale and the model is fallback, it fails closed. Live Execution inherits the safe decision, adds idempotency and human approval, and stops at the locked Paper gateway. Paper preview. Human approval required. Not submitted.

## 3:20–3:40 — Evidence, auditability, and close

Every snapshot, classification, policy decision, risk calculation, and sanitized order preview is linked through a hash-chain audit log. Shadow policies can be compared, but only the Live path can ever receive Paper execution authority—and today it remains locked. Most trading agents search for a reason to trade. Seoul Shield searches for the reason they should not.

## On-screen status rules

- Do not show `FILLED`, realized P&L, or live AI unless verified evidence exists.
- Keep `PAPER PREVIEW · NOT SUBMITTED`, `QUOTE: STALE`, and `FALLBACK / NOT LIVE AI` visible for this replay.
- If fresh verified evidence replaces the replay, update the narration and status labels together; never update only the visual claim.
