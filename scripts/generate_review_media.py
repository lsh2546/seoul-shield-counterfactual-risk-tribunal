from __future__ import annotations

import re
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work" / "guided-demo-audio"
OUT = ROOT / "outputs" / "previews"
SOURCE_SILENT = OUT / "seoul-shield-guided-demo-silent-3m40s.mp4"
SILENT = OUT / "seoul-shield-guided-demo-silent-4m20s.mp4"
REVIEW = OUT / "seoul-shield-guided-demo-review-slow-4m20s.mp4"
SRT = WORK / "review.srt"

SECTIONS = [
    (0, 15, "Two hundred forty-five option contracts enter. Twenty-one survive. Eight pass expiration. Four pass liquidity. Two form one defined-risk spread. The capital gate closes."),
    (15, 35, "Most trading agents search for a reason to trade. When AI can move capital, prediction is only half the problem. The harder question is authority. Which safety policy deserves the right to execute? Seoul Shield answers with one signal and four policies."),
    (35, 77, "This is an Alpaca Paper Trading account. Sanitized evidence confirms one hundred thousand dollars in cash and equity, four hundred thousand dollars in buying power, options level three, no positions, and no open orders. Seoul Shield reads SPY, account exposure, market status, and two hundred forty-five option contracts. Every quote has a timestamp. This replay is marked stale. The AI layer is marked fallback, not live AI. The system never disguises missing evidence."),
    (77, 118, "The Capital Decision Engine evaluates strike, expiration, volatility when available, bid and ask, spread quality, open interest, quote age, and tradability. Every route comes from the evidence bundle. Twenty-one contracts are opportunities. Eighty require review. One hundred forty-four are blocked. Stale quotes, wide spreads, weak liquidity, and capital-risk violations are isolated before execution."),
    (118, 160, "Twenty-one candidates enter deterministic gates. Expiration and strike ordering preserve a valid call spread. Open interest and liquidity remove weak contracts. Defined-risk validation leaves two legs: buy the SPY seven-sixty-five call, and sell the seven-seventy call. The long ask is five dollars and six cents. The short bid is two dollars and thirty-two cents. Net debit: two dollars and seventy-four cents."),
    (160, 195, "Four requested contracts create a maximum loss of one thousand ninety-six dollars. The policy limit is one thousand dollars. The order is ninety-six dollars over. This hard rule sits outside the AI model. A persuasive response, timeout, or malformed JSON cannot relax it. The hard gate blocks the proposal. Quote stale. AI fallback. Paper preview only. Nothing submitted."),
    (195, 236, "The same order now enters four futures. No Guard continues with four contracts and one thousand ninety-six dollars exposed. It remains shadow-only. Static Guard closes at the one-thousand-dollar limit: blocked, ninety-six dollars over. Adaptive Guard checks quote age, AI status, and liquidity. Stale data and fallback AI trigger fail-closed. Live Execution inherits that decision and stops at the locked Paper gateway. Human approval required. Not submitted."),
    (236, 260, "Every snapshot, classification, policy decision, risk calculation, and preview is linked through a hash-chain audit log. Only the Live path can ever receive Paper execution authority. Today, it remains locked. Most trading agents search for a reason to trade. Seoul Shield searches for the reason they should not."),
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
    if not SOURCE_SILENT.exists():
        raise FileNotFoundError(SOURCE_SILENT)
    status_overlay = WORK / "verified-replay-status.png"
    overlay = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((1380, 14, 1897, 46), fill=(11, 31, 57, 255), outline=(114, 148, 176, 255), width=1)
    font = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 12)
    label = "VERIFIED ALPACA REPLAY · PAPER PREVIEW · NOT SUBMITTED"
    box = draw.textbbox((0, 0), label, font=font)
    draw.text((1638 - (box[2] - box[0]) / 2, 24), label, font=font, fill=(255, 255, 255, 255))
    overlay.save(status_overlay)
    subprocess.run([
        ffmpeg, "-loglevel", "error", "-y", "-i", str(SOURCE_SILENT), "-loop", "1", "-i", str(status_overlay),
        "-filter_complex", "[0:v]setpts=1.1818181818*PTS[slow];[slow][1:v]overlay=0:0:shortest=1",
        "-r", "30", "-t", "260", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", str(SILENT),
    ], check=True)
    ps1 = WORK / "speak.ps1"
    ps1.write_text(
        "param([string]$TextPath,[string]$OutPath)\n"
        "Add-Type -AssemblyName System.Speech\n"
        "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer\n"
        "$s.SelectVoice('Microsoft Zira Desktop')\n"
        "$s.Rate=-2\n$s.Volume=100\n$s.SetOutputToWaveFile($OutPath)\n"
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
    subprocess.run([
        ffmpeg, "-loglevel", "error", "-y", "-i", str(SILENT), "-i", str(narration),
        "-vf", "subtitles=review.srt:force_style='FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF,OutlineColour=&H00102038,BorderStyle=1,Outline=1,Shadow=0,MarginV=52,Alignment=2'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", "260", str(REVIEW),
    ], check=True, cwd=WORK)
    print(SILENT)
    print(REVIEW)


if __name__ == "__main__":
    main()
