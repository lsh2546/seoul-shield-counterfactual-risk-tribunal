from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "evidence/preflight/2026-09-03T143105Z-paper-preflight.json"
BLOCK = ROOT / "evidence/preflight/2026-09-03T144203Z-paper-preflight.json"
CANDIDATE = ROOT / "evidence/market/2026-09-03T143040Z-live-candidates.json"
OUT = ROOT / "outputs/submission-final-2026-09-04"
VIDEO = OUT / "Seoul-Shield-FINAL-SAFETY-EVIDENCE-90s.mp4"
PDF = ROOT / "output/pdf/Seoul-Shield-Verified-Safety-Evidence-One-Page.pdf"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fonts():
    return (
        ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 58),
        ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 38),
        ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 28),
        ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 22),
    )


def slide(path: Path, kicker: str, title: str, lines: list[str], accent: str = "#35e5ff") -> None:
    h1, h2, body, mono = fonts()
    im = Image.new("RGB", (1920, 1080), "#0b2a49")
    d = ImageDraw.Draw(im)
    for y in range(0, 1080, 60): d.line((0, y, 1920, y), fill="#123b60", width=1)
    for x in range(0, 1920, 80): d.line((x, 0, x, 1080), fill="#123b60", width=1)
    d.rectangle((70, 60, 1850, 1020), fill="#0d3152", outline=accent, width=3)
    d.text((115, 100), kicker, font=mono, fill=accent)
    d.text((110, 170), title, font=h1, fill="#ffffff")
    y = 330
    for text in lines:
        color = "#ffcf5a" if "BLOCKED" in text or "NOT EXECUTED" in text else "#dff8ff"
        d.text((125, y), text, font=h2 if text.startswith("→") else body, fill=color)
        y += 82
    d.text((115, 960), "SEOUL SHIELD  ·  VERIFIED ALPACA PAPER EVIDENCE  ·  ALPACA_ALLOW_SUBMIT=false", font=mono, fill="#7fbed8")
    im.save(path)


def make_video(preview: dict, blocked: dict, candidate: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    slides = [
        ("01", "THE DIFFERENCE", "COMPARE TWO FUTURES BEFORE CAPITAL MOVES", ["AI proposes. Deterministic risk verifies.", "Human authority remains outside the model."]),
        ("02", "LIVE MARKET EVIDENCE", "ALPACA DATA → GEMINI STRUCTURED DECISION", ["SPY · QQQ · AAPL · NVDA scanned", "Gemini schema verified · response hashed", "AAPL selected · bullish confidence 85%"]),
        ("03", "ORIGINAL FUTURE", "4 CONTRACTS · MAX LOSS $952", ["Conservative risk cap: $500", "Excess risk: $452", "→ BLOCKED"]),
        ("04", "CONTROLLED FUTURE", "2 CONTRACTS · MAX LOSS $476", ["Risk reduced by $476", "Account risk: 0.476%", "Paper Preview created · not submitted"]),
        ("05", "VERIFIED INPUTS", "NO INVENTED IV PERCENTILE", ["Long IV 28.03% · Short IV 27.67%", "OI 5,994 / 4,223 · fresh quotes", "IV_HISTORY_UNAVAILABLE policy applied"]),
        ("06", "MARKET CHANGED", "BULLISH → BEARISH", ["AAPL 5-minute return turned negative", "AAPL 15-minute return turned negative", "A bullish spread was no longer valid"]),
        ("07", "FINAL VERDICT", "NOT EXECUTED — SAFETY GATE BLOCKED", ["Bull Call rejected after direction reversal", "No market-order conversion · no fabricated fill"]),
        ("08", "BROKER TRUTH", "ORDERS 0 · POSITIONS 0 · LOSS $0", ["Alpaca Paper account verified", "No fill · no realized or unrealized P&L claim"]),
        ("09", "VERIFIED LINEAGE", "INPUT HASH → DECISION → RESULT HASH", ["Audit chain verified", f"Preview evidence {sha(PREVIEW)[:16]}…", f"NO TRADE evidence {sha(BLOCK)[:16]}…"]),
    ]
    paths = []
    for item in slides:
        p = OUT / f"{item[0]}.png"; slide(p, item[1], item[2], item[3]); paths.append(p)
    concat = OUT / "slides.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\nduration 10\n" for p in paths) + f"file '{paths[-1].as_posix()}'\n", encoding="utf-8")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
                    "-vf", "fps=30,format=yuv420p", "-t", "90", "-c:v", "libx264", "-crf", "18",
                    "-movflags", "+faststart", str(VIDEO)], check=True)


def make_pdf() -> None:
    PDF.parent.mkdir(parents=True, exist_ok=True)
    navy, blue, cyan, red, green = map(HexColor, ["#0B2A49", "#173F67", "#35E5FF", "#E33E5A", "#09B987"])
    doc = SimpleDocTemplate(str(PDF), pagesize=landscape(letter), leftMargin=.42*inch, rightMargin=.42*inch,
                            topMargin=.34*inch, bottomMargin=.30*inch)
    base = ParagraphStyle("body", fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=HexColor("#183047"))
    h = ParagraphStyle("h", parent=base, fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=blue)
    small = ParagraphStyle("small", parent=base, fontSize=7, leading=8.5, textColor=HexColor("#50677A"))
    title = Table([[Paragraph("SEOUL SHIELD", ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=white)),
                    Paragraph("VERIFIED SAFETY EVIDENCE", ParagraphStyle("s", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=cyan, alignment=2))]], colWidths=[5*inch, 4.9*inch])
    title.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),navy),("BOX",(0,0),(-1,-1),1,cyan),
                               ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
                               ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
                               ("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    metrics = Table([[Paragraph("<b>4 CONTRACTS</b><br/>ORIGINAL", base), Paragraph("<b>$952</b><br/>MAX LOSS", base),
                      Paragraph("<b>2 CONTRACTS</b><br/>CONTROLLED", base), Paragraph("<b>$476</b><br/>MAX LOSS", base)]], colWidths=[2.475*inch]*4)
    metrics.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#EAF5FA")),("BOX",(0,0),(-1,-1),.7,cyan),
                                 ("INNERGRID",(0,0),(-1,-1),.4,HexColor("#B8D5E2")),("PADDING",(0,0),(-1,-1),8)]))
    left = [Paragraph("THE SYSTEM", h), Paragraph("Most trading agents predict one future. Seoul Shield compares the original order with a controlled alternative before capital moves. Gemini proposes; deterministic policy verifies; only an explicitly approved Paper path can execute.", base), Spacer(1,6),
            Paragraph("VERIFIED ALPACA AND GEMINI", h), Paragraph("A live Alpaca Paper scan evaluated SPY, QQQ, AAPL, and NVDA. Gemini returned schema-validated candidate scores, selected AAPL with 85% bullish confidence, and produced input and output hashes. The account showed $100,000 equity, Options Level 3, zero orders, and zero positions.", base), Spacer(1,6),
            Paragraph("CONSERVATIVE RISK POLICY", h), Paragraph("With no verified historical IV series, the system did not invent an IV percentile. IV_HISTORY_UNAVAILABLE reduced the risk cap to 0.5% ($500) and capped size at two contracts. Current IV, spread, OI, volume, quote age, and measured 5- and 15-minute returns remained explicit inputs.", base)]
    right = [Paragraph("TWO FUTURES", h), Paragraph("The original four-contract AAPL 330/335 bull call debit spread carried $952 maximum loss and was blocked at $452 over the conservative limit. The controlled two-contract future carried $476 maximum loss, or 0.476% of equity, and reached Paper Preview only.", base), Spacer(1,6),
             Paragraph("THE SAFETY EVENT", h), Paragraph("Before execution, AAPL changed from bullish to bearish across the measured 5- and 15-minute windows. The bullish strategy became directionally incompatible. Seoul Shield invalidated the preview and kept the broker latch closed.", base), Spacer(1,7),
             Table([[Paragraph("NOT EXECUTED — SAFETY GATE BLOCKED", ParagraphStyle("v",fontName="Helvetica-Bold",fontSize=14,textColor=white,alignment=1))],
                    [Paragraph("ORDERS 0  ·  POSITIONS 0  ·  LOSS $0<br/>NO FILL OR P&amp;L CLAIM", ParagraphStyle("v2",fontName="Helvetica-Bold",fontSize=9,textColor=white,alignment=1))]], colWidths=[4.8*inch], style=TableStyle([("BACKGROUND",(0,0),(-1,0),red),("BACKGROUND",(0,1),(-1,1),navy),("BOX",(0,0),(-1,-1),1,red),("PADDING",(0,0),(-1,-1),8)]))]
    cols = Table([[left,right]], colWidths=[4.9*inch,4.9*inch], style=TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("RIGHTPADDING",(0,0),(0,0),12),("LEFTPADDING",(1,0),(1,0),12)]))
    footer = Paragraph("Evidence: Alpaca Paper Trading and Market Data APIs · Gemini structured response · deterministic risk engine · chained SHA-256 audit · ALPACA_ALLOW_SUBMIT=false", small)
    doc.build([title,Spacer(1,7),metrics,Spacer(1,9),cols,Spacer(1,8),footer])


def main() -> None:
    preview, blocked, candidate = load(PREVIEW), load(BLOCK), load(CANDIDATE)
    make_video(preview, blocked, candidate)
    make_pdf()
    manifest = {"video": str(VIDEO), "pdf": str(PDF), "sources": {str(p.relative_to(ROOT)): sha(p) for p in [CANDIDATE, PREVIEW, BLOCK]},
                "claims": {"orders": 0, "positions": 0, "loss": 0, "executed": False}}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__": main()
