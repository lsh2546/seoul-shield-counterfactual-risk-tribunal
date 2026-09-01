from __future__ import annotations

import re
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work" / "guided-demo-audio"
OUT = ROOT / "outputs" / "previews"
SILENT = OUT / "seoul-shield-guided-demo-silent-3m40s.mp4"
REVIEW = OUT / "seoul-shield-guided-demo-review-3m40s.mp4"
SRT = WORK / "review.srt"

SECTIONS = [
    (0, 8, "Two hundred forty-five option contracts enter. Twenty-one survive as opportunities. Eight pass expiration. Four pass liquidity. Two become one defined-risk spread—and the capital gate closes."),
    (8, 30, "Most autonomous trading agents are designed to find a reason to trade. But when an AI can move capital, prediction is only half the problem. The harder question is authority: which safety policy deserves the right to execute? Seoul Shield is a Counterfactual Risk Tribunal built to answer that question with the same signal, the same market snapshot, and four different execution policies."),
    (30, 65, "This run begins with an Alpaca Paper Trading account configured for the hackathon. The sanitized evidence confirms one hundred thousand dollars in cash, four hundred thousand dollars in buying power, options level three, no open positions, and no open orders. Seoul Shield reads the underlying SPY price, account exposure, market status, and an Alpaca options chain containing two hundred forty-five contracts. Every quote carries a timestamp. This captured snapshot is marked stale, so the system does not pretend it is live. The AI layer is also marked fallback, not live AI, because no paid model call was made in this replay."),
    (65, 100, "The Capital Decision Engine now normalizes strike, expiration, implied volatility when available, bid and ask, spread quality, open interest, quote age, and tradability. Each contract travels through market, liquidity, and risk inspection. The result is not decorative animation; every route comes from the replay bundle. Twenty-one contracts are classified as opportunities, eighty require review, and one hundred forty-four are blocked. Stale quotes, wide spreads, weak liquidity, and capital-risk violations are isolated before they can reach an execution path."),
    (100, 135, "The twenty-one opportunity candidates enter a sequence of deterministic gates. Expiration removes incompatible contracts. Strike ordering preserves a valid call-spread structure. Open interest and liquidity eliminate contracts that cannot support a responsible order. Defined-risk validation leaves two legs: buy the SPY seven-sixty-five call and sell the SPY seven-seventy call. The long ask is five dollars and six cents. The short bid is two dollars and thirty-two cents. Together they form a net debit of two dollars and seventy-four cents per share."),
    (135, 165, "At four requested contracts, the net debit creates a maximum possible loss of one thousand ninety-six dollars. Seoul Shield compares that number with a fixed one-percent trade-risk limit: one thousand dollars on this account. The order is ninety-six dollars over the limit. This rule is outside the AI model and cannot be relaxed by a persuasive response, a timeout, or malformed JSON. The hard gate therefore blocks the proposal. Quote stale. AI fallback. Paper preview only. Nothing has been submitted."),
    (165, 200, "Now the identical order signal enters four counterfactual futures. No Guard allows all four contracts to continue, exposing one thousand ninety-six dollars—but remains shadow-only and has no order authority. Static Guard closes at the one-thousand-dollar hard limit: blocked, ninety-six dollars over. Adaptive Guard inspects quote age, AI status, and liquidity. Because the quote is stale and the model is fallback, it fails closed. Live Execution inherits the safe decision, adds idempotency and human approval, and stops at the locked Paper gateway. Paper preview. Human approval required. Not submitted."),
    (200, 220, "Every snapshot, classification, policy decision, risk calculation, and sanitized order preview is linked through a hash-chain audit log. Shadow policies can be compared, but only the Live path can ever receive Paper execution authority—and today it remains locked. Most trading agents search for a reason to trade. Seoul Shield searches for the reason they should not."),
]


def stamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{milliseconds:03}"


def caption_chunks(text: str, limit: int = 68) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    for word in words:
        if current and len(" ".join(current + [word])) > limit:
            chunks.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        chunks.append(" ".join(current))
    return chunks


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    ps1 = WORK / "speak.ps1"
    ps1.write_text(
        "param([string]$TextPath,[string]$OutPath)\n"
        "Add-Type -AssemblyName System.Speech\n"
        "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer\n"
        "$s.SelectVoice('Microsoft Zira Desktop')\n"
        "$s.Rate=-1\n$s.Volume=100\n$s.SetOutputToWaveFile($OutPath)\n"
        "$s.Speak((Get-Content -Raw -LiteralPath $TextPath))\n$s.Dispose()\n",
        encoding="utf-8",
    )
    normalized: list[Path] = []
    cues: list[tuple[float, float, str]] = []
    for index, (start, end, text) in enumerate(SECTIONS):
        text_path = WORK / f"section-{index}.txt"
        raw_path = WORK / f"section-{index}-raw.wav"
        fixed_path = WORK / f"section-{index}-fixed.wav"
        text_path.write_text(text, encoding="utf-8-sig")
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1), str(text_path), str(raw_path)], check=True)
        with wave.open(str(raw_path), "rb") as audio:
            raw_duration = audio.getnframes() / audio.getframerate()
        target = end - start
        speed = max(0.5, min(2.0, raw_duration / (target - 0.45)))
        subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(raw_path), "-af", f"atempo={speed:.6f},apad,atrim=0:{target}", str(fixed_path)], check=True)
        normalized.append(fixed_path)
        chunks = caption_chunks(text)
        weights = [len(re.findall(r"\w+", chunk)) for chunk in chunks]
        total = sum(weights)
        cursor = float(start)
        for chunk, weight in zip(chunks, weights):
            duration = target * weight / total
            cues.append((cursor, min(float(end), cursor + duration), chunk))
            cursor += duration
    concat = WORK / "concat.txt"
    concat.write_text("\n".join(f"file '{path.as_posix()}'" for path in normalized), encoding="utf-8")
    narration = OUT / "seoul-shield-temp-female-narration.wav"
    subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c:a", "pcm_s16le", str(narration)], check=True)
    SRT.write_text("\n\n".join(f"{i}\n{stamp(a)} --> {stamp(b)}\n{text}" for i, (a, b, text) in enumerate(cues, 1)), encoding="utf-8")
    if not SILENT.exists():
        raise FileNotFoundError(SILENT)
    subprocess.run([
        ffmpeg, "-loglevel", "error", "-y", "-i", str(SILENT), "-i", str(narration),
        "-vf", "subtitles=review.srt:force_style='FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF,OutlineColour=&H00102038,BorderStyle=1,Outline=1,Shadow=0,MarginV=52,Alignment=2'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", "220", str(REVIEW),
    ], check=True, cwd=WORK)
    print(SILENT)
    print(REVIEW)


if __name__ == "__main__":
    main()
