from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "Seoul-Shield-One-Page.pdf"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font = "Helvetica"
    font_bold = "Helvetica-Bold"
    arial = Path("C:/Windows/Fonts/arial.ttf")
    arial_bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if arial.exists() and arial_bold.exists():
        pdfmetrics.registerFont(TTFont("Arial", str(arial)))
        pdfmetrics.registerFont(TTFont("Arial-Bold", str(arial_bold)))
        font, font_bold = "Arial", "Arial-Bold"

    navy, blue, cyan = HexColor("#071A33"), HexColor("#10365A"), HexColor("#23C8FF")
    green, gold, red = HexColor("#10A86B"), HexColor("#D89A00"), HexColor("#D9344B")
    ink, muted, line = HexColor("#13263B"), HexColor("#52697F"), HexColor("#C9D8E6")

    doc = SimpleDocTemplate(
        str(OUT), pagesize=landscape(letter), leftMargin=0.43 * inch, rightMargin=0.43 * inch,
        topMargin=0.36 * inch, bottomMargin=0.34 * inch,
    )
    base = ParagraphStyle("base", fontName=font, fontSize=7.6, leading=9.7, textColor=ink)
    h2 = ParagraphStyle("h2", parent=base, fontName=font_bold, fontSize=9.2, leading=11, textColor=blue, spaceAfter=3)
    small = ParagraphStyle("small", parent=base, fontSize=6.8, leading=8.5, textColor=muted)
    metric = ParagraphStyle("metric", parent=base, fontName=font_bold, fontSize=8.1, leading=9.3, textColor=ink, alignment=TA_LEFT)

    story = []
    hero = Table([[Paragraph("SEOUL SHIELD", ParagraphStyle("brand", fontName=font_bold, fontSize=20, leading=22, textColor=white)),
                   Paragraph("COUNTERFACTUAL RISK TRIBUNAL", ParagraphStyle("tag", fontName=font_bold, fontSize=9.5, leading=11, textColor=cyan, alignment=2))]],
                 colWidths=[5.0 * inch, 4.85 * inch])
    hero.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), navy), ("BOX", (0, 0), (-1, -1), 1, cyan),
                              ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 12),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 10),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    story += [hero, Spacer(1, 6), Paragraph("<b>Other agents prove they can trade. Seoul Shield proves which safety policy deserves the right to trade.</b>", ParagraphStyle("claim", parent=base, fontSize=10.4, leading=13, textColor=blue)), Spacer(1, 6)]

    metrics = [
        ("$100,000", "PAPER CASH / EQUITY", green), ("245", "SPY OPTION CONTRACTS", cyan),
        ("21 / 80 / 144", "OPPORTUNITY / UNCERTAIN / BLOCKED", gold), ("$1,096", "MAX LOSS", red),
    ]
    cells = []
    for value, label, color in metrics:
        cells.append(Paragraph(f'<font color="{color.hexval()}"><b>{value}</b></font><br/><font size="6.2" color="#52697F">{label}</font>', metric))
    table = Table([cells], colWidths=[2.46 * inch] * 4)
    table.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, line), ("INNERGRID", (0, 0), (-1, -1), 0.5, line),
                               ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F3F8FC")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                               ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story += [table, Spacer(1, 7)]

    left = []
    left += [Paragraph("THE PROBLEM", h2), Paragraph("AI can produce a persuasive options thesis, but persuasion is not permission to move capital. Seoul Shield tests one signal against four safety policies and reveals why a proposal advances, resizes, or stops.", base), Spacer(1, 5)]
    left += [Paragraph("ONE SNAPSHOT, FOUR POLICIES", h2), Paragraph("<b>No Guard</b> preserves the proposal as a shadow baseline. <b>Static Guard</b> applies fixed limits. <b>Adaptive Guard</b> evaluates regime, quote age, liquidity, exposure, and recent loss. <b>Live Execution</b> is the only path with Paper authority, still gated by deterministic rules and human approval.", base), Spacer(1, 5)]
    left += [Paragraph("HARD SAFETY INVARIANTS", h2), Paragraph("- Two-leg, same-expiration debit spreads only<br/>- 1% maximum trade loss; 5% portfolio risk; 2% daily stop<br/>- Strike ordering and position_intent validation<br/>- Unique client_order_id and duplicate prevention<br/>- Model output can never relax a hard limit<br/>- Hash-chain audit of every decision and preview", base)]

    right = []
    right += [Paragraph("VERIFIED ALPACA REPLAY", h2), Paragraph("An active Paper account showed <b>$100,000 cash/equity</b>, <b>$400,000 buying power</b>, <b>Options Level 3</b>, and zero positions or orders. The engine inspected <b>245 SPY calls</b> expiring September 4, 2026 and sorted them into <b>21 Opportunity, 80 Uncertain, and 144 Risk Blocked</b>.", base), Spacer(1, 5)]
    right += [Paragraph("THE DECISION", h2), Paragraph("Candidate gates converged on <b>BUY SPY 765C</b> at the $5.06 ask and <b>SELL SPY 770C</b> at the $2.32 bid. Four contracts at a $2.74 net debit create <b>$1,096 maximum loss</b>. The deterministic limit is <b>$1,000</b>, so the capital gate closes at <b>$96 over limit</b>.", base), Spacer(1, 5)]
    verdict = Table([[Paragraph("HARD GATE: BLOCKED", ParagraphStyle("v", fontName=font_bold, fontSize=13, leading=15, textColor=white, alignment=1))],
                     [Paragraph("QUOTE STALE  |  FALLBACK / NOT LIVE AI<br/>PAPER PREVIEW  |  NOT SUBMITTED", ParagraphStyle("vs", fontName=font_bold, fontSize=7.2, leading=9, textColor=white, alignment=1))]], colWidths=[4.78 * inch])
    verdict.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), red), ("BACKGROUND", (0, 1), (-1, 1), navy),
                                 ("BOX", (0, 0), (-1, -1), 0.8, red), ("TOPPADDING", (0, 0), (-1, -1), 6),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    right += [verdict, Spacer(1, 5), Paragraph("No fill, return, or realized P&L is claimed. The public app is a sanitized read-only evidence room, not an execution console.", small)]

    cols = Table([[left, right]], colWidths=[4.88 * inch, 4.88 * inch], hAlign="LEFT")
    cols.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (0, 0), 0),
                              ("RIGHTPADDING", (0, 0), (0, 0), 10), ("LEFTPADDING", (1, 0), (1, 0), 10),
                              ("RIGHTPADDING", (1, 0), (1, 0), 0), ("LINEBEFORE", (1, 0), (1, 0), 0.6, line)]))
    story += [cols, Spacer(1, 7)]

    footer = Table([[Paragraph("ALPACA", h2), Paragraph("IMPLEMENTATION EVIDENCE", h2), Paragraph("PUBLIC MODE", h2)],
                    [Paragraph("Trading + Market Data APIs<br/>Read-only MCP evidence<br/>Paper MLEG payload", small),
                     Paragraph("Python risk core: 20 tests<br/>Idempotency + status/cancel paths<br/>Three.js tribunal + 2D fallback", small),
                     Paragraph("VERIFIED ALPACA REPLAY<br/>PAPER PREVIEW<br/>ALPACA_ALLOW_SUBMIT=false", small)]],
                   colWidths=[3.28 * inch, 3.28 * inch, 3.28 * inch])
    footer.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), HexColor("#EEF5FA")), ("BOX", (0, 0), (-1, -1), 0.7, line),
                                ("INNERGRID", (0, 0), (-1, -1), 0.4, line), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story += [footer, Spacer(1, 5), Paragraph("Educational hackathon prototype - not investment advice - no live-money account support", ParagraphStyle("legal", parent=small, alignment=1, fontSize=6.2))]
    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    main()
