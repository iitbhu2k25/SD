"""
varuna_report_generator.py — Generates a PDF scenario report for Varuna River
scenarios, visually matching the Streamlit app's report_generator.py HTML
report (cover page with gradient + wave, rounded shadowed cards, pill
badges, serif headings) as closely as reportlab's flowable/canvas model
allows.

Public API:
    generate_pdf_report(scenario: SewageSimulation, all_scenarios: list[SewageSimulation]) -> bytes
"""
from __future__ import annotations

import io
import math
from datetime import datetime
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 3.2 * cm  # left+right margins of 1.6cm each

# ── Palette (mirrors report_generator.py's CSS custom properties) ───────────
NAVY = colors.HexColor("#042C53")
BLUE_DARK = colors.HexColor("#0C447C")
BLUE_MID = colors.HexColor("#185FA5")
BLUE = colors.HexColor("#378ADD")
BLUE_LIGHT = colors.HexColor("#85B7EB")
BLUE_PALE = colors.HexColor("#B5D4F4")
BLUE_GHOST = colors.HexColor("#E6F1FB")
TEAL = colors.HexColor("#1D9E75")
TEAL_LIGHT = colors.HexColor("#D6F2E8")
AMBER = colors.HexColor("#C07A10")
AMBER_LIGHT = colors.HexColor("#FEF3DC")
RED = colors.HexColor("#C0392B")
RED_LIGHT = colors.HexColor("#FDECEA")
GRAY_50 = colors.HexColor("#F9FAFB")
GRAY_100 = colors.HexColor("#EEF2F7")
GRAY_300 = colors.HexColor("#C4CFD9")
GRAY_500 = colors.HexColor("#7B8EA0")
GRAY_700 = colors.HexColor("#3C4F60")
OFF_WHITE = colors.HexColor("#F4F8FD")
WHITE = colors.white

# ── Serif display font (Playfair-Display-like) — fall back to Times-Roman if
# no bundled TTF is available, since reportlab ships only the 14 base fonts.
_SERIF_BOLD = "Times-Bold"
_SERIF = "Times-Roman"
_SERIF_ITALIC = "Times-Italic"
try:
    import os
    _font_dir = os.path.join(os.path.dirname(__file__), "fonts")
    if os.path.exists(os.path.join(_font_dir, "PlayfairDisplay-Bold.ttf")):
        pdfmetrics.registerFont(TTFont("PlayfairDisplay-Bold", os.path.join(_font_dir, "PlayfairDisplay-Bold.ttf")))
        pdfmetrics.registerFont(TTFont("PlayfairDisplay", os.path.join(_font_dir, "PlayfairDisplay-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("PlayfairDisplay-Italic", os.path.join(_font_dir, "PlayfairDisplay-Italic.ttf")))
        _SERIF_BOLD = "PlayfairDisplay-Bold"
        _SERIF = "PlayfairDisplay"
        _SERIF_ITALIC = "PlayfairDisplay-Italic"
except Exception:
    pass


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt(value: float, decimals: int = 1) -> str:
    try:
        return f"{float(value):,.{decimals}f}"
    except (TypeError, ValueError):
        return "0.0"


def _maint_label(raw: Any) -> str:
    s = str(raw).strip().lower()
    if "high" in s or "0.9" in s:
        return "High (>0.90)"
    if "medium" in s or "0.6" in s:
        return "Medium (0.60)"
    return "Low (0.40)"


def _maint_color(raw: Any) -> colors.Color:
    s = str(raw).strip().lower()
    if "high" in s or "0.9" in s:
        return TEAL
    if "medium" in s or "0.6" in s:
        return GRAY_700
    return AMBER


def _val_color(value: float, good_max: float, warn_max: float) -> colors.Color:
    if value <= good_max:
        return TEAL
    if value <= warn_max:
        return AMBER
    return RED


def _status_label(treatment_pct: float) -> tuple[str, colors.Color, colors.Color]:
    if treatment_pct >= 80:
        return "GOOD", TEAL_LIGHT, colors.HexColor("#0A6147")
    if treatment_pct >= 50:
        return "MODERATE", AMBER_LIGHT, colors.HexColor("#7A4F08")
    return "CRITICAL", RED_LIGHT, colors.HexColor("#922B21")


def _extract_series(rows: list[dict], col: str, n_points: int = 7) -> list[float]:
    if not rows or col not in rows[0]:
        return [0.0] * n_points
    values = [float(r.get(col, 0) or 0) for r in rows]
    if len(values) <= n_points:
        return [round(v, 2) for v in values]
    step = max(1, (len(values) - 1) / (n_points - 1))
    indices = [min(int(round(i * step)), len(values) - 1) for i in range(n_points)]
    return [round(values[idx], 2) for idx in indices]


def _extract_day_labels(rows: list[dict], n_points: int = 7) -> list[int]:
    if not rows:
        return list(range(n_points))
    if "Day" in rows[0]:
        days = [int(r.get("Day", 0)) for r in rows]
    else:
        days = list(range(0, len(rows) * 30, 30))
    if len(days) <= n_points:
        return days
    step = max(1, (len(days) - 1) / (n_points - 1))
    indices = [min(int(round(i * step)), len(days) - 1) for i in range(n_points)]
    return [days[idx] for idx in indices]


# ── Matplotlib chart styling — matches Chart.js look from the original ──────

_CHART_RC = {
    "font.family": "DejaVu Sans",
    "axes.edgecolor": "#B5D4F4",
    "axes.linewidth": 0.8,
    "text.color": "#3C4F60",
    "axes.labelcolor": "#7B8EA0",
    "xtick.color": "#7B8EA0",
    "ytick.color": "#7B8EA0",
}


def _line_chart_png(day_labels: list[int], series: list[tuple[str, list[float], str, str]],
                     y_label: str, width_in: float = 7.6, height_in: float = 2.9) -> bytes:
    with plt.rc_context(_CHART_RC):
        fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=170)
        for label, values, color_hex, linestyle in series:
            ax.plot(day_labels, values, label=label, color=color_hex, linewidth=2.2,
                     linestyle=linestyle, marker="o", markersize=4, markeredgecolor="white", markeredgewidth=0.8)
            ax.fill_between(day_labels, values, alpha=0.06, color=color_hex)
        ax.set_xlabel("Day", fontsize=9.5)
        ax.set_ylabel(y_label, fontsize=9.5)
        ax.tick_params(labelsize=8.5)
        ax.grid(True, color="#E6F1FB", linewidth=0.9)
        ax.set_axisbelow(True)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        legend = ax.legend(fontsize=8.5, loc="lower center", bbox_to_anchor=(0.5, 1.02),
                            ncol=len(series), frameon=False, borderaxespad=0)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="white", bbox_inches="tight",
                    bbox_extra_artists=[legend], pad_inches=0.15)
        plt.close(fig)
    buf.seek(0)
    return buf.read()


def _donut_chart_png(labels: list[str], values: list[float], color_hexes: list[str],
                      width_in: float = 4.2, height_in: float = 3.6) -> bytes:
    with plt.rc_context(_CHART_RC):
        fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=170)
        if sum(values) <= 0:
            values, labels, color_hexes = [1], ["No data"], ["#E6F1FB"]
        wedges, _ = ax.pie(values, colors=color_hexes, startangle=90,
                            wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2))
        legend = ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1.02, 0.5), fontsize=8, frameon=False)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="white", bbox_inches="tight",
                    bbox_extra_artists=[legend], pad_inches=0.15)
        plt.close(fig)
    buf.seek(0)
    return buf.read()


def _bar_chart_png(categories: list[str], series: list[tuple[str, list[float | None], str]],
                    width_in: float = 7.6, height_in: float = 3.0) -> bytes:
    import numpy as np

    with plt.rc_context(_CHART_RC):
        fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=170)
        n_series = max(1, len(series))
        bar_width = 0.8 / n_series
        x = np.arange(len(categories))
        for i, (label, values, color_hex) in enumerate(series):
            vals = [v if v is not None else 0 for v in values]
            ax.bar(x + i * bar_width, vals, width=bar_width, label=label, color=color_hex,
                   edgecolor="white", linewidth=0.6)
        ax.set_xticks(x + bar_width * (n_series - 1) / 2)
        ax.set_xticklabels(categories, fontsize=8.5)
        ax.tick_params(labelsize=8.5)
        ax.grid(True, axis="y", color="#E6F1FB", linewidth=0.9)
        ax.set_axisbelow(True)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        legend = ax.legend(fontsize=8.5, loc="lower center", bbox_to_anchor=(0.5, 1.02),
                            ncol=n_series, frameon=False, borderaxespad=0)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="white", bbox_inches="tight",
                    bbox_extra_artists=[legend], pad_inches=0.15)
        plt.close(fig)
    buf.seek(0)
    return buf.read()


def _stacked_hbar_png(segments: list[tuple[str, float, str]], width_in: float = 7.6, height_in: float = 1.7) -> bytes:
    with plt.rc_context(_CHART_RC):
        fig, ax = plt.subplots(figsize=(width_in, height_in), dpi=170)
        left = 0.0
        for label, value, color_hex in segments:
            ax.barh(["Sewage Flow"], [value], left=left, color=color_hex,
                     label=f"{label} ({_fmt(value)} MLD)", edgecolor="white", linewidth=0.6, height=0.55)
            left += value
        ax.set_xlabel("MLD", fontsize=9.5)
        ax.tick_params(labelsize=8.5)
        legend = ax.legend(fontsize=8.5, loc="upper center", bbox_to_anchor=(0.5, -0.35), ncol=3, frameon=False)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="white", bbox_inches="tight",
                    bbox_extra_artists=[legend], pad_inches=0.15)
        plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── Cover page canvas drawing (gradient + circles + wave, drawn directly) ───

def _lerp_color(c1: colors.Color, c2: colors.Color, t: float) -> colors.Color:
    return colors.Color(
        c1.red + (c2.red - c1.red) * t,
        c1.green + (c2.green - c1.green) * t,
        c1.blue + (c2.blue - c1.blue) * t,
    )


def _draw_cover_background(canvas, doc):
    """Called once for the first page — paints the full gradient cover,
    decorative circles, and the bottom wave, matching the HTML report's
    .cover background."""
    if getattr(canvas, "_cover_drawn", False):
        return
    canvas._cover_drawn = True

    cover_h = 9.6 * cm
    y_top = PAGE_H
    y_bottom = PAGE_H - cover_h

    # Diagonal-ish gradient approximated with horizontal bands (top navy -> mid blue)
    c1 = colors.HexColor("#021D38")
    c2 = colors.HexColor("#0C447C")
    c3 = colors.HexColor("#1A5FA8")
    bands = 60
    band_h = cover_h / bands
    for i in range(bands):
        t = i / (bands - 1)
        if t < 0.55:
            col = _lerp_color(c1, c2, t / 0.55)
        else:
            col = _lerp_color(c2, c3, (t - 0.55) / 0.45)
        canvas.setFillColor(col)
        canvas.rect(0, y_bottom + i * band_h, PAGE_W, band_h + 0.5, stroke=0, fill=1)

    # Decorative translucent circles (mirrors .cover-circles)
    canvas.saveState()
    canvas.setFillColor(colors.Color(55 / 255, 138 / 255, 221 / 255, alpha=0.08))
    canvas.circle(PAGE_W - 2.4 * cm, y_top - 1.6 * cm, 5.8 * cm, stroke=0, fill=1)
    canvas.circle(PAGE_W - 3.4 * cm, y_bottom + 1.6 * cm, 3.4 * cm, stroke=0, fill=1)
    canvas.circle(1.6 * cm, y_bottom + 0.6 * cm, 4.2 * cm, stroke=0, fill=1)
    canvas.restoreState()

    # Bottom wave (simple bezier-ish curve filled with off-white, matching .cover-wave)
    canvas.saveState()
    canvas.setFillColor(OFF_WHITE)
    p = canvas.beginPath()
    wave_y = y_bottom
    p.moveTo(0, wave_y)
    p.curveTo(PAGE_W * 0.25, wave_y + 0.35 * cm, PAGE_W * 0.35, wave_y - 0.35 * cm, PAGE_W * 0.5, wave_y)
    p.curveTo(PAGE_W * 0.65, wave_y + 0.35 * cm, PAGE_W * 0.75, wave_y - 0.35 * cm, PAGE_W, wave_y)
    p.lineTo(PAGE_W, y_bottom - 0.6 * cm)
    p.lineTo(0, y_bottom - 0.6 * cm)
    p.close()
    canvas.drawPath(p, stroke=0, fill=1)
    canvas.restoreState()

    # Fill the rest of the page below the cover with off-white (body background)
    canvas.setFillColor(OFF_WHITE)
    canvas.rect(0, 0, PAGE_W, y_bottom - 0.6 * cm, stroke=0, fill=1)


def _draw_body_background(canvas, doc):
    """Later pages: plain off-white body background (no cover)."""
    canvas.setFillColor(OFF_WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


# ── Rounded card / pill builders ──────────────────────────────────────────

def _card(inner_flowable_or_table, bg=WHITE, pad=10, radius=10, border_color=None, accent=None):
    """Wrap content in a single-cell rounded, optionally accented card."""
    t = Table([[inner_flowable_or_table]], colWidths=[CONTENT_W])
    cmds = [
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("LEFTPADDING", (0, 0), (-1, -1), pad + (4 if accent else 0)),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("ROUNDEDCORNERS", [radius, radius, radius, radius]),
    ]
    if border_color:
        cmds.append(("BOX", (0, 0), (-1, -1), 0.75, border_color))
    if accent:
        cmds.append(("LINEBEFORE", (0, 0), (0, -1), 3.2, accent))
    t.setStyle(TableStyle(cmds))
    return t


def _pill(text: str, bg: colors.Color, fg: colors.Color, styles) -> Table:
    p = Paragraph(text, ParagraphStyle("pill", parent=styles["body"], textColor=fg, fontSize=7.5,
                                        fontName="Helvetica-Bold", alignment=TA_CENTER, leading=9))
    t = Table([[p]], colWidths=[2.6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    return t


def _section_header(icon_bg: colors.Color, title: str, sub: str, styles) -> Table:
    icon_box = Table([[""]], colWidths=[1.05 * cm], rowHeights=[1.05 * cm])
    icon_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), icon_bg),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    title_block = [
        Paragraph(title, ParagraphStyle("sh_title", parent=styles["body"], fontName=_SERIF_BOLD,
                                          fontSize=15.5, textColor=NAVY, leading=18)),
        Paragraph(sub, ParagraphStyle("sh_sub", parent=styles["body"], fontSize=8.5, textColor=GRAY_500, leading=11)),
    ]
    t = Table([[icon_box, title_block]], colWidths=[1.3 * cm, CONTENT_W - 1.3 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 1.4, BLUE_GHOST),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


# ── Styles ────────────────────────────────────────────────────────────────────

def _styles():
    ss = getSampleStyleSheet()
    styles = {
        "cover_badge": ParagraphStyle("cover_badge", parent=ss["Normal"], fontSize=8.5, textColor=BLUE_PALE,
                                      fontName="Helvetica-Bold", spaceAfter=12, leading=11),
        "cover_h1": ParagraphStyle("cover_h1", parent=ss["Title"], fontSize=30, textColor=WHITE, leading=34,
                                   fontName=_SERIF_BOLD, alignment=TA_LEFT, spaceAfter=8),
        "cover_h2": ParagraphStyle("cover_h2", parent=ss["Normal"], fontSize=12.5, textColor=BLUE_PALE,
                                   fontName=_SERIF_ITALIC, spaceAfter=20),
        "cover_meta_label": ParagraphStyle("cover_meta_label", parent=ss["Normal"], fontSize=7, textColor=BLUE_LIGHT,
                                           fontName="Helvetica-Bold", leading=9),
        "cover_meta_val": ParagraphStyle("cover_meta_val", parent=ss["Normal"], fontSize=10, textColor=WHITE,
                                         leading=12),
        "sec_title": ParagraphStyle("sec_title", parent=ss["Heading1"], fontName=_SERIF_BOLD, fontSize=15.5,
                                    textColor=NAVY, spaceBefore=4, spaceAfter=2),
        "sec_sub": ParagraphStyle("sec_sub", parent=ss["Normal"], fontSize=8.5, textColor=GRAY_500, spaceAfter=10),
        "kpi_val": ParagraphStyle("kpi_val", parent=ss["Normal"], fontSize=15, leading=18, textColor=NAVY,
                                  alignment=TA_CENTER, fontName=_SERIF_BOLD),
        "kpi_val_dark": ParagraphStyle("kpi_val_dark", parent=ss["Normal"], fontSize=13.5, leading=16, textColor=WHITE,
                                       alignment=TA_CENTER, fontName=_SERIF_BOLD),
        "kpi_lbl": ParagraphStyle("kpi_lbl", parent=ss["Normal"], fontSize=7.5, leading=9, textColor=BLUE_DARK,
                                  alignment=TA_CENTER, fontName="Helvetica-Bold", spaceBefore=0),
        "kpi_lbl_dark": ParagraphStyle("kpi_lbl_dark", parent=ss["Normal"], fontSize=7.5, leading=9, textColor=BLUE_LIGHT,
                                       alignment=TA_CENTER, fontName="Helvetica-Bold", spaceBefore=0),
        "body": ParagraphStyle("body", parent=ss["Normal"], fontSize=9, textColor=GRAY_700, leading=13),
        "impact_title": ParagraphStyle("impact_title", parent=ss["Normal"], fontSize=9.5, textColor=NAVY,
                                       fontName="Helvetica-Bold", spaceAfter=3, leading=12),
        "impact_desc": ParagraphStyle("impact_desc", parent=ss["Normal"], fontSize=8.5, textColor=GRAY_700, leading=12.5),
        "rec_lbl": ParagraphStyle("rec_lbl", parent=ss["Normal"], fontSize=8, textColor=BLUE_PALE,
                                  fontName="Helvetica-Bold", spaceAfter=8),
        "rec_title": ParagraphStyle("rec_title", parent=ss["Normal"], fontSize=13, textColor=WHITE, leading=17,
                                    fontName=_SERIF_BOLD, spaceAfter=10),
        "rec_body": ParagraphStyle("rec_body", parent=ss["Normal"], fontSize=9, textColor=BLUE_PALE, leading=13.5),
        "note": ParagraphStyle("note", parent=ss["Normal"], fontSize=8.5, textColor=GRAY_700, leading=12.5),
        "footer_l": ParagraphStyle("footer_l", parent=ss["Normal"], fontSize=9.5, textColor=BLUE_PALE, fontName=_SERIF_BOLD),
        "footer_r": ParagraphStyle("footer_r", parent=ss["Normal"], fontSize=7.5, textColor=BLUE_LIGHT),
        "table_head": ParagraphStyle("table_head", parent=ss["Normal"], fontSize=7, textColor=BLUE_PALE,
                                     fontName="Helvetica-Bold"),
        "table_cell": ParagraphStyle("table_cell", parent=ss["Normal"], fontSize=8, textColor=GRAY_700, leading=10),
        "table_cell_bold": ParagraphStyle("table_cell_bold", parent=ss["Normal"], fontSize=8, textColor=NAVY,
                                          fontName="Helvetica-Bold", leading=10),
    }
    return styles


def _kpi_row(items: list[tuple[str, str, bool]], styles) -> Table:
    """items: list of (value_text, label_text, is_dark)"""
    n = len(items)
    col_width = CONTENT_W / n
    cells = []
    for value_text, label_text, is_dark in items:
        val_style = styles["kpi_val_dark"] if is_dark else styles["kpi_val"]
        lbl_style = styles["kpi_lbl_dark"] if is_dark else styles["kpi_lbl"]
        inner = Table([[Paragraph(value_text, val_style)], [Paragraph(label_text, lbl_style)]],
                      colWidths=[col_width - 0.3 * cm])
        bg = NAVY if is_dark else BLUE_GHOST
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("ROUNDEDCORNERS", [12, 12, 12, 12]),
            ("TOPPADDING", (0, 0), (-1, 0), 14),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 1), (-1, 1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 14),
            ("BOX", (0, 0), (-1, -1), 0.75, BLUE_PALE if not is_dark else BLUE_DARK),
        ]))
        cells.append(inner)
    row = Table([cells], colWidths=[col_width] * n)
    row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    return row


def _io_card(rows: list[tuple[str, str, colors.Color | None]], header: str, header_bg: colors.Color,
             header_fg: colors.Color, styles, card_width: float = (CONTENT_W - 0.4 * cm) / 2) -> Table:
    header_row = Table([[Paragraph(header, ParagraphStyle("h", parent=styles["body"], textColor=header_fg,
                                                            fontSize=9, fontName="Helvetica-Bold"))]],
                        colWidths=[card_width])
    header_row.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), header_bg),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [10, 10, 0, 0]),
    ]))

    body_rows = []
    for key, val, val_color in rows:
        vcolor = val_color or NAVY
        body_rows.append([
            Paragraph(key, ParagraphStyle("k", parent=styles["body"], fontSize=8, textColor=GRAY_500)),
            Paragraph(val, ParagraphStyle("v", parent=styles["body"], fontSize=8.5, textColor=vcolor,
                                          fontName="Helvetica-Bold", alignment=2)),
        ])
    body_table = Table(body_rows, colWidths=[card_width * 0.58, card_width * 0.42])
    body_table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, GRAY_100),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("ROUNDEDCORNERS", [0, 0, 10, 10]),
    ]))

    wrapper = Table([[header_row], [body_table]], colWidths=[card_width])
    wrapper.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX", (0, 0), (-1, -1), 0.75, BLUE_PALE),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
    ]))
    return wrapper


# ── Main entrypoint ──────────────────────────────────────────────────────────

def generate_pdf_report(scenario, all_scenarios: list) -> bytes:
    """
    scenario: SewageSimulation ORM object (the primary scenario to report on)
    all_scenarios: list[SewageSimulation] — every saved scenario, for the comparison section
    """
    styles = _styles()
    rows = scenario.rows or []
    params = scenario.params or {}
    strategies = scenario.strategies or []

    last_row = rows[-1] if rows else {}
    first_row = rows[0] if rows else {}

    total_sewage = float(last_row.get("Total Sewage (MLD)", 0))
    treated = float(last_row.get("Treated (MLD)", 0))
    untreated = float(last_row.get("Untreated Load (MLD)", 0))
    treatment_pct = float(last_row.get("Treatment %", scenario.treatment_pct or 0))

    drain_overflow_ng = float(last_row.get("Tapped Drain Overflow (Non-Gravity) (MLD)", 0))
    drain_overflow_g = float(last_row.get("Tapped Drain Overflow (Gravity) (MLD)", 0))
    drain_overflow = drain_overflow_ng + drain_overflow_g
    stp_overflow = float(last_row.get("STP Overflow (MLD)", 0))
    pump_overflow = float(last_row.get("Pumping Station Overflow (MLD)", 0))

    capital_cost = float(last_row.get("Capital Cost (Cr)", 0))
    om_cost = float(last_row.get("OM Cost (Cr)", 0))

    bod = float(last_row.get("BOD of River", 28.49))

    treated_first = float(first_row.get("Treated (MLD)", 0))
    untreated_first = float(first_row.get("Untreated Load (MLD)", 0))
    treated_change = treated - treated_first
    untreated_change = untreated - untreated_first

    max_day = int(last_row.get("Day", len(rows) * 30))
    start_year = 2025
    end_year = start_year + max(1, max_day // 365)

    population = int(params.get("population", 2644440))
    per_capita = int(params.get("per_capita_sewage", 135))
    stp_capacity = float(params.get("stp_capacity", 260))
    pump_capacity = float(params.get("pump_capacity", 140))
    maint_tapped = params.get("maint_tapped", "low (0.40)")
    maint_stp = params.get("maint_stp", "high (>0.90)")
    maint_pump = params.get("maint_pump", "high (>0.90)")
    om_tapped = float(params.get("om_tapped", 4.0))
    om_stp_val = float(params.get("om_stp", 28.47))
    om_pump_val = float(params.get("om_pump", 1.4))
    stp_construction = float(params.get("stp_construction", 0.0))
    tap_construction = float(params.get("tap_construction", 0.0))
    pump_construction = float(params.get("pump_construction", 0.0))

    discharge_pct = [
        params.get("pct_untapped_drains", 31.0), params.get("pct_tapped_non_gravity", 32.0),
        params.get("pct_tapped_gravity", 0.0), params.get("pct_stp_gravity_sewer", 22.0),
        params.get("pct_stp_non_gravity_sewer", 15.0), params.get("pct_non_stp_sewer", 0.0),
        params.get("pct_in_situ", 0.0),
    ]
    growth_rates = [
        params.get("growth_untapped", 2.0), params.get("growth_tapped_non_gravity", 2.0),
        params.get("growth_tapped_gravity", 2.0), params.get("growth_stp_gravity", 2.0),
        params.get("growth_stp_non_gravity", 2.0), params.get("growth_non_stp_sewer", 2.0),
        params.get("growth_in_situ", 2.0),
    ]

    # ── Charts ────────────────────────────────────────────────────────────
    n_pts = 7
    day_labels = _extract_day_labels(rows, n_pts)
    sewage_data = _extract_series(rows, "Total Sewage (MLD)", n_pts)
    treated_data = _extract_series(rows, "Treated (MLD)", n_pts)
    untreated_data = _extract_series(rows, "Untreated Load (MLD)", n_pts)
    overflow_tap_data = [
        round(a + b, 2) for a, b in zip(
            _extract_series(rows, "Tapped Drain Overflow (Non-Gravity) (MLD)", n_pts),
            _extract_series(rows, "Tapped Drain Overflow (Gravity) (MLD)", n_pts),
        )
    ]
    overflow_stp_data = _extract_series(rows, "STP Overflow (MLD)", n_pts)
    overflow_pump_data = _extract_series(rows, "Pumping Station Overflow (MLD)", n_pts)
    bod_data = _extract_series(rows, "BOD of River", n_pts)
    if all(v == 0 for v in bod_data):
        bod_data = [bod] * n_pts

    sewage_chart = _line_chart_png(day_labels, [
        ("Generation", sewage_data, "#042C53", "-"),
        ("Treated", treated_data, "#1D9E75", "-"),
        ("Untreated", untreated_data, "#C0392B", "--"),
    ], "MLD")
    overflow_chart = _line_chart_png(day_labels, [
        ("Tapped Overflow", overflow_tap_data, "#C07A10", "-"),
        ("STP Overflow", overflow_stp_data, "#185FA5", "-"),
        ("Pump Overflow", overflow_pump_data, "#B5D4F4", "--"),
    ], "MLD")
    bod_chart = _line_chart_png(day_labels, [
        ("River BOD (mg/L)", bod_data, "#C0392B", "-"),
        ("CPCB Class C Limit", [10] * n_pts, "#1D9E75", "--"),
    ], "BOD (mg/L)")

    donut_colors_list = ["#C0392B", "#C07A10", "#1D9E75", "#378ADD", "#185FA5", "#7B8EA0", "#B5D4F4"]
    short_labels = ["Untapped Drains", "Tapped Non-Gravity", "Tapped Gravity",
                    "STP-Gravity Sewer", "STP-Non-Gravity Sewer", "Non-STP Sewer", "In-Situ"]
    donut_labels, donut_values, donut_colors = [], [], []
    for i, lbl in enumerate(short_labels):
        pv = float(discharge_pct[i]) if i < len(discharge_pct) else 0
        if pv > 0:
            donut_labels.append(f"{lbl} ({pv:.0f}%)")
            donut_values.append(pv)
            donut_colors.append(donut_colors_list[i % len(donut_colors_list)])
    conveyance_chart = _donut_chart_png(donut_labels, donut_values, donut_colors)

    untreated_remainder = max(0, untreated - drain_overflow)
    sankey_chart = _stacked_hbar_png([
        ("Treated", treated, "#1D9E75"),
        ("Drain Overflow", drain_overflow, "#C07A10"),
        ("Untreated Remainder", untreated_remainder, "#C0392B"),
    ])

    # ── Scenario comparison data ─────────────────────────────────────────
    compare_names, compare_treatment, compare_untreated, compare_bod, compare_overflow = [], [], [], [], []
    for sc in all_scenarios:
        sc_rows = sc.rows or []
        sc_last = sc_rows[-1] if sc_rows else {}
        compare_names.append(sc.name)
        compare_treatment.append(round(float(sc_last.get("Treatment %", sc.treatment_pct or 0)), 1))
        compare_untreated.append(round(float(sc_last.get("Untreated Load (MLD)", sc.untreated or 0)), 1))
        compare_bod.append(round(float(sc_last.get("BOD of River", 0)), 2))
        sc_ovf = float(sc_last.get("Tapped Drain Overflow (Non-Gravity) (MLD)", 0)) + float(sc_last.get("Tapped Drain Overflow (Gravity) (MLD)", 0))
        compare_overflow.append(round(sc_ovf, 1))

    bar_colors = ["#C07A10", "#185FA5", "#1D9E75", "#C0392B", "#8E24AA"]
    compare_series = [
        (name, [compare_treatment[i], compare_untreated[i], compare_bod[i], compare_overflow[i]], bar_colors[i % len(bar_colors)])
        for i, name in enumerate(compare_names)
    ]
    compare_chart = _bar_chart_png(
        ["Treatment %", "Untreated (MLD)", "BOD (mg/L)", "Overflow (MLD)"], compare_series,
    ) if compare_series else None

    # ── Recommendation ────────────────────────────────────────────────────
    if treatment_pct >= 80:
        rec_title = f"{scenario.name} achieves {_fmt(treatment_pct)}% treatment &mdash; meeting reasonable treatment targets."
        rec_body = (
            f"This scenario treats <b>{_fmt(treated)} MLD</b> out of <b>{_fmt(total_sewage)} MLD</b> total sewage. "
            f"River BOD stands at <b>{_fmt(bod, 2)} mg/L</b>. Continue monitoring and consider further interventions "
            f"to achieve CPCB Class C compliance (BOD &lt; 10 mg/L)."
        )
    elif treatment_pct >= 50:
        rec_title = f"{scenario.name} achieves only {_fmt(treatment_pct)}% treatment &mdash; immediate intervention is required to meet CPCB river quality standards."
        bottleneck = f"low tapped-network maintenance ({maint_tapped})" if drain_overflow > 20 else "insufficient conveyance to STP"
        rec_body = (
            f"The primary bottleneck is <b>{bottleneck}</b>"
            + (f", causing {_fmt(drain_overflow)} MLD of drain overflow before sewage reaches the STP" if drain_overflow > 0 else "")
            + f". With {_fmt(untreated / max(1, total_sewage) * 100)}% of sewage untreated, the Varuna receives "
            f"{_fmt(untreated)} MLD of raw load daily, sustaining a river BOD of {_fmt(bod, 2)} mg/L"
            + (f" &mdash; nearly {int(bod / 10)}&times; the acceptable limit." if bod > 10 else ".")
        )
    else:
        rec_title = f"{scenario.name} achieves only {_fmt(treatment_pct)}% treatment &mdash; critical intervention is urgently needed."
        rec_body = (
            f"Only <b>{_fmt(treated)} MLD</b> out of <b>{_fmt(total_sewage)} MLD</b> is being treated. "
            f"River BOD of <b>{_fmt(bod, 2)} mg/L</b> far exceeds safe limits. Major capacity augmentation and "
            f"conveyance improvements are essential."
        )

    impact_cards = _build_impact_cards(params, {
        "total_sewage": total_sewage, "treated": treated, "untreated": untreated,
        "drain_overflow": drain_overflow, "stp_overflow": stp_overflow, "pump_overflow": pump_overflow,
        "capital_cost": capital_cost, "om_cost": om_cost, "bod": bod,
        "treated_change": treated_change, "untreated_change": untreated_change,
    })

    # ── Build the document ────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=0.9 * cm, bottomMargin=1.3 * cm,
                             leftMargin=1.6 * cm, rightMargin=1.6 * cm,
                             title=f"System Dynamics Report - Scenario Report: {scenario.name}")
    story: list = []
    now = datetime.now()

    # ── COVER ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.6 * cm))
    story.append(Paragraph(f"PROJECT REPORT &nbsp;&middot;&nbsp; {now.strftime('%B %Y').upper()}", styles["cover_badge"]))
    story.append(Paragraph("System Dynamics<br/>Report", styles["cover_h1"]))
    story.append(Paragraph("Scenario Results, Inputs &amp; Comparative Analysis", styles["cover_h2"]))

    meta_items = [
        ("REPORT DATE", now.strftime("%B %Y")),
        ("LOCATION", "Varanasi, Uttar Pradesh"),
        ("SCENARIOS", f"{len(all_scenarios)} Selected ({scenario.name})"),
        ("MODEL PERIOD", f"{start_year}-{end_year} ({max_day}d)"),
    ]
    meta_cells = [[Paragraph(lbl, styles["cover_meta_label"]) for lbl, _ in meta_items]]
    meta_cells.append([Paragraph(val, styles["cover_meta_val"]) for _, val in meta_items])
    meta_table = Table(meta_cells, colWidths=[CONTENT_W / 4] * 4)
    meta_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.Color(181 / 255, 212 / 255, 244 / 255, alpha=0.35)),
        ("TOPPADDING", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 2.6 * cm))

    # ── SECTION 1: SCENARIO RESULTS ─────────────────────────────────────
    story.append(_section_header(BLUE_GHOST, "Scenario Results",
                                  f"Summary of simulated outcomes for the selected scenario ({scenario.name})", styles))

    kpi = _kpi_row([
        (scenario.name[:14], "ACTIVE SCENARIO", True),
        (f"{_fmt(treatment_pct)}%", "TREATMENT RATE", False),
        (f"{_fmt(treated)} MLD", "TREATED FLOW", False),
        (f"{_fmt(untreated)} MLD", "UNTREATED LOAD", False),
    ], styles)
    story.append(kpi)
    story.append(Spacer(1, 0.45 * cm))

    summary_data = [[Paragraph(h, styles["table_head"]) for h in
                      ["Scenario", "Description", "Total Sewage", "Treated", "Treatment %", "Untreated", "Total Cost", "Status"]]]
    for sc in all_scenarios:
        sc_rows = sc.rows or []
        sc_first = sc_rows[0] if sc_rows else {}
        sc_last = sc_rows[-1] if sc_rows else {}
        sc_tp = float(sc_last.get("Treatment %", sc.treatment_pct or 0))
        sc_ts = float(sc_first.get("Total Sewage (MLD)", 0))
        sc_tr = float(sc_last.get("Treated (MLD)", 0))
        sc_ut = float(sc_last.get("Untreated Load (MLD)", sc.untreated or 0))
        sc_tc = float(sc_last.get("Capital Cost (Cr)", 0)) + float(sc_last.get("OM Cost (Cr)", 0))
        sc_desc = ", ".join(sc.strategies or []) or "Baseline"
        sc_status, sc_bg, sc_fg = _status_label(sc_tp)
        row_cells = [
            Paragraph(f"<b>{sc.name}</b>", styles["table_cell_bold"]),
            Paragraph(sc_desc, styles["table_cell"]),
            Paragraph(f"{_fmt(sc_ts)} MLD", styles["table_cell"]),
            Paragraph(f"{_fmt(sc_tr)} MLD", styles["table_cell"]),
            Paragraph(f"{_fmt(sc_tp)}%", styles["table_cell"]),
            Paragraph(f"{_fmt(sc_ut)} MLD", styles["table_cell"]),
            Paragraph(f"{_fmt(sc_tc)} Cr", styles["table_cell"]),
            _pill(sc_status, sc_bg, sc_fg, styles),
        ]
        summary_data.append(row_cells)
    summary_table = Table(summary_data, colWidths=[2.1 * cm, 2.9 * cm, 2.0 * cm, 1.7 * cm, 1.9 * cm, 1.8 * cm, 1.7 * cm, 2.3 * cm], repeatRows=1)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, GRAY_100),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
        ("BOX", (0, 0), (-1, -1), 0.75, BLUE_PALE),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.4 * cm))

    story.append(_chart_card("Sewage Trend", "Generation &middot; Treated &middot; Untreated", sewage_chart, styles))
    story.append(Spacer(1, 0.3 * cm))
    story.append(_chart_card("Overflow Trend", "Tapped &middot; STP &middot; Pumping", overflow_chart, styles))
    story.append(Spacer(1, 0.3 * cm))
    story.append(_chart_card("River BOD Trend", "Biochemical Oxygen Demand over the simulation period", bod_chart, styles))

    story.append(PageBreak())

    # ── SECTION 2: SCENARIO DETAIL ───────────────────────────────────────
    story.append(_section_header(BLUE_GHOST, f"Scenario Detail: {scenario.name}",
                                  "All inputs, corresponding outputs and how they affect the result", styles))

    input_rows = [
        ("Population", f"{population:,}", None),
        ("Per Capita Sewage", f"{per_capita} LPCD", None),
        ("Installed STP Capacity", f"{_fmt(stp_capacity, 0)} MLD", None),
        ("Installed Pumping Capacity", f"{_fmt(pump_capacity, 0)} MLD", None),
        ("Network Maintenance", _maint_label(maint_tapped), _maint_color(maint_tapped)),
        ("STP Maintenance", _maint_label(maint_stp), _maint_color(maint_stp)),
        ("Pump Maintenance", _maint_label(maint_pump), _maint_color(maint_pump)),
        ("Network O&amp;M Cost", f"{_fmt(om_tapped)} Cr/yr", None),
        ("STP O&amp;M Cost", f"{_fmt(om_stp_val)} Cr/yr", None),
        ("Pump O&amp;M Cost", f"{_fmt(om_pump_val)} Cr/yr", None),
        ("STP Construction Cost", f"{_fmt(stp_construction)} Cr", None),
        ("Tapping Construction Cost", f"{_fmt(tap_construction)} Cr", None),
        ("Pumping Construction Cost", f"{_fmt(pump_construction)} Cr", None),
    ]
    output_rows = [
        ("Final Total Sewage", f"{_fmt(total_sewage)} MLD", None),
        ("Final Treated Sewage", f"{_fmt(treated)} MLD", TEAL),
        ("Treatment Percentage", f"{_fmt(treatment_pct)}%", _val_color(100 - treatment_pct, 30, 50)),
        ("Untreated Load", f"{_fmt(untreated)} MLD", _val_color(untreated, 50, 150)),
        ("Tapped Drain Overflow", f"{_fmt(drain_overflow)} MLD", _val_color(drain_overflow, 5, 50)),
        ("STP Overflow", f"{_fmt(stp_overflow)} MLD", _val_color(stp_overflow, 0.1, 10)),
        ("Pumping Overflow", f"{_fmt(pump_overflow)} MLD", _val_color(pump_overflow, 0.1, 10)),
        ("Capital Cost", f"{_fmt(capital_cost)} Cr", None),
        ("Cumulative O&amp;M Cost", f"{_fmt(om_cost)} Cr", None),
        ("Final BOD of River", f"{_fmt(bod, 2)} mg/L", _val_color(bod, 10, 20)),
    ]
    io_input = _io_card(input_rows, "&#9654; SCENARIO INPUTS", NAVY, BLUE_PALE, styles)
    io_output = _io_card(output_rows, "&#9664; SCENARIO OUTPUTS", BLUE_MID, WHITE, styles)
    io_grid = Table([[io_input, io_output]], colWidths=[CONTENT_W / 2, CONTENT_W / 2])
    io_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (1, 0), (1, 0), 8)]))
    story.append(io_grid)
    story.append(Spacer(1, 0.45 * cm))

    story.append(_section_header(BLUE_GHOST, "Conveyance Share Breakdown",
                                  "Network pathway distribution with annual growth rates", styles))

    conveyance_rows = [
        ("Untapped Drains", "Direct discharge, no collection"),
        ("Tapped (Non-Gravity)", "Collected, pumped to STP"),
        ("Tapped (Gravity)", "Gravity-fed tapped drains"),
        ("STP-Connected (Gravity Sewer)", "Sewer network to STP"),
        ("STP-Connected (Non-Gravity Sewer)", "Pumped sewer to STP"),
        ("Non-STP Sewer Network", "No treatment destination"),
        ("In-Situ Setup", "On-site treatment"),
    ]
    conv_data = [[Paragraph(h, styles["table_head"]) for h in ["Conveyance Pathway", "Share", "Annual Growth", "Description"]]]
    for i, (label, desc) in enumerate(conveyance_rows):
        pct_val = int(discharge_pct[i]) if i < len(discharge_pct) else 0
        growth_val = float(growth_rates[i]) if i < len(growth_rates) else 2.0
        conv_data.append([
            Paragraph(f"<b>{label}</b>", styles["table_cell_bold"]),
            Paragraph(f"{pct_val}%", styles["table_cell"]),
            Paragraph(f"+{growth_val:.1f}%/yr", styles["table_cell"]),
            Paragraph(desc, styles["table_cell"]),
        ])
    conv_data.append([Paragraph("<b>Total</b>", styles["table_cell_bold"]), Paragraph("100%", styles["table_cell"]),
                       Paragraph("-", styles["table_cell"]), Paragraph("-", styles["table_cell"])])
    conv_table = Table(conv_data, colWidths=[5.0 * cm, 1.6 * cm, 2.2 * cm, CONTENT_W - 8.8 * cm], repeatRows=1)
    conv_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BACKGROUND", (0, -1), (-1, -1), BLUE_GHOST),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, GRAY_100),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
        ("BOX", (0, 0), (-1, -1), 0.75, BLUE_PALE),
    ]))
    story.append(conv_table)
    story.append(Spacer(1, 0.35 * cm))
    story.append(_chart_card("Conveyance Share Distribution", "Current network pathway split", conveyance_chart, styles, img_width_frac=0.7))

    story.append(PageBreak())

    # ── SECTION 3: HOW INPUTS AFFECT RESULTS ─────────────────────────────
    story.append(_section_header(TEAL_LIGHT, "How Inputs Affect the Result",
                                  "Causal linkages between scenario parameters and outcomes", styles))
    for card in impact_cards:
        text = Paragraph(f"<b>{card['title']}</b><br/>{card['desc']}",
                          ParagraphStyle("card", parent=styles["impact_desc"], textColor=GRAY_700))
        story.append(_card(text, bg=card["bg"], pad=10, radius=9, accent=card["accent"]))
        story.append(Spacer(1, 0.22 * cm))

    story.append(Spacer(1, 0.15 * cm))
    story.append(_chart_card("Input &rarr; Output Flow Diagram",
                              f"How {_fmt(total_sewage)} MLD of sewage is routed through the system",
                              sankey_chart, styles))

    story.append(PageBreak())

    # ── SECTION 4: SCENARIO COMPARISON ───────────────────────────────────
    story.append(_section_header(BLUE_GHOST, "Scenario Comparison",
                                  "Side-by-side evaluation across saved scenarios", styles))

    if compare_chart:
        story.append(_chart_card("Multi-Scenario Key Indicator Comparison",
                                  f"{len(all_scenarios)} scenario(s) compared" if len(all_scenarios) > 1 else "Add more scenarios to populate",
                                  compare_chart, styles))
        story.append(Spacer(1, 0.35 * cm))

    rec_content = [
        Paragraph("CURRENT ASSESSMENT", styles["rec_lbl"]),
        Paragraph(rec_title, styles["rec_title"]),
        Paragraph(rec_body, styles["rec_body"]),
    ]
    rec_inner = Table([[c] for c in rec_content], colWidths=[CONTENT_W - 2.4 * cm])
    rec_inner.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    rec_box = Table([[rec_inner]], colWidths=[CONTENT_W])
    rec_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("ROUNDEDCORNERS", [14, 14, 14, 14]),
    ]))
    story.append(rec_box)
    story.append(Spacer(1, 0.4 * cm))

    story.append(_section_header(AMBER_LIGHT, "Notes &amp; Assumptions",
                                  "Data sources, model parameters, and caveats", styles))
    notes = [
        ("The report uses saved scenario inputs and simulation outputs from the Varuna River simulation model.", False),
        (f"Charts are generated from the scenario's simulation output, illustrative of the {max_day}-day simulation arc.", False),
        ("Model outputs are planning-support estimates. Field values may vary with monsoon timing, unaccounted drain loads, groundwater interactions, and implementation delays.", True),
        ("All cost figures are in Indian Rupees (Crores). Capital costs for baseline scenarios are zero as no new infrastructure is constructed.", True),
    ]
    for note_text, is_warn in notes:
        accent = AMBER if is_warn else BLUE_MID
        note_p = Paragraph(note_text, styles["note"])
        note_table = Table([[note_p]], colWidths=[CONTENT_W])
        note_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), OFF_WHITE),
            ("LINEBEFORE", (0, 0), (0, -1), 2.6, accent),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("ROUNDEDCORNERS", [0, 6, 6, 0]),
        ]))
        story.append(note_table)
        story.append(Spacer(1, 0.18 * cm))

    # footer_table = Table([[
    #     Paragraph("System Dynamics Report", styles["footer_l"]),
    #     Paragraph(f"Varanasi, UP &nbsp;&middot;&nbsp; {now.strftime('%B %Y')} &nbsp;&middot;&nbsp; Confidential", styles["footer_r"]),
    # ]], colWidths=[CONTENT_W * 0.6, CONTENT_W * 0.4])
    # footer_table.setStyle(TableStyle([
    #     ("BACKGROUND", (0, 0), (-1, -1), NAVY),
    #     ("TOPPADDING", (0, 0), (-1, -1), 10),
    #     ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    #     ("LEFTPADDING", (0, 0), (-1, -1), 14),
    #     ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    #     ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    #     ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    #     ("ROUNDEDCORNERS", [10, 10, 10, 10]),
    # ]))
    # story.append(footer_table)

    doc.build(story, onFirstPage=_draw_cover_background, onLaterPages=_draw_body_background)
    buf.seek(0)
    return buf.read()


def _chart_card(title: str, sub: str, png_bytes: bytes, styles, img_width_frac: float = 1.0) -> Table:
    """Card with a navy header bar + chart image, mirroring .chart-card in the HTML report."""
    header = Table([[
        Paragraph(f"<b>{title}</b>", ParagraphStyle("cch", parent=styles["body"], textColor=WHITE, fontSize=9.5,
                                                      fontName="Helvetica-Bold")),
        Paragraph(sub, ParagraphStyle("ccs", parent=styles["body"], textColor=BLUE_LIGHT, fontSize=8, alignment=2)),
    ]], colWidths=[CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4 * cm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [10, 10, 0, 0]),
    ]))
    img_w = CONTENT_W * img_width_frac - 1.6 * cm
    # Use the PNG's real pixel aspect ratio (charts are saved with bbox_inches="tight",
    # which crops to content and changes the aspect ratio from the nominal figsize).
    from PIL import Image as PILImage
    px_w, px_h = PILImage.open(io.BytesIO(png_bytes)).size
    img_h = img_w * (px_h / px_w)
    img = Image(io.BytesIO(png_bytes), width=img_w, height=img_h)
    body = Table([[img]], colWidths=[CONTENT_W - 0.4 * cm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), OFF_WHITE),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [0, 0, 10, 10]),
    ]))
    wrapper = Table([[header], [body]], colWidths=[CONTENT_W])
    wrapper.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX", (0, 0), (-1, -1), 0.75, BLUE_PALE),
        ("ROUNDEDCORNERS", [10, 10, 10, 10]),
    ]))
    return wrapper


def _build_impact_cards(params: dict, outputs: dict) -> list[dict]:
    """Generate impact analysis cards based on actual scenario data (ported 1:1 from report_generator.py)."""
    cards = []

    maint_tapped = _maint_label(params.get("maint_tapped", "low (0.40)"))
    drain_overflow = outputs.get("drain_overflow", 0.0)
    if drain_overflow > 0:
        cards.append({
            "title": f"{maint_tapped} Tapped Network Maintenance &rarr; High Drain Overflow",
            "desc": (
                f"The tapped network maintenance factor of <b>{maint_tapped}</b> directly causes "
                f"<b>{_fmt(drain_overflow)} MLD of drain overflow</b>. Even though sewage enters the tapped network, "
                f"poor conveyance efficiency means a large fraction spills before reaching the STP. Raising maintenance "
                f"to 0.80+ would reduce this overflow by an estimated 30-40 MLD."
            ),
            "bg": AMBER_LIGHT if drain_overflow < 100 else RED_LIGHT,
            "accent": AMBER if drain_overflow < 100 else RED,
        })
    else:
        cards.append({
            "title": f"{maint_tapped} Tapped Network Maintenance &rarr; Zero Drain Overflow",
            "desc": (
                f"The tapped network maintenance factor of <b>{maint_tapped}</b> results in <b>0.0 MLD drain overflow</b>. "
                f"The conveyance network is performing well - sewage reaches the treatment plant without significant spills."
            ),
            "bg": TEAL_LIGHT, "accent": TEAL,
        })

    stp_cap = float(params.get("stp_capacity", 260))
    treated = outputs.get("treated", 0.0)
    gap = stp_cap - treated
    cards.append({
        "title": f"STP Capacity ({_fmt(stp_cap, 0)} MLD) vs. Actual Treatment ({_fmt(treated)} MLD)",
        "desc": (
            f"Installed STP capacity is <b>{_fmt(stp_cap, 0)} MLD</b>, yet only <b>{_fmt(treated)} MLD</b> is treated. "
            f"The gap (~{_fmt(gap)} MLD) is attributable to conveyance losses upstream. "
            + ("High STP maintenance (&gt;0.90) ensures the plant performs well - the bottleneck is not the STP itself but sewage delivery to it."
               if "high" in str(params.get("maint_stp", "")).lower()
               else "Improving STP maintenance could help close this gap further.")
        ),
        "bg": BLUE_GHOST if gap < 50 else AMBER_LIGHT,
        "accent": BLUE_MID if gap < 50 else AMBER,
    })

    total_sewage = outputs.get("total_sewage", 1.0)
    untreated = outputs.get("untreated", 0.0)
    untreated_pct = (untreated / max(1, total_sewage)) * 100
    bod = outputs.get("bod", 28.49)
    treated_change = outputs.get("treated_change", 0.0)
    untreated_change = outputs.get("untreated_change", 0.0)
    cards.append({
        "title": f"{_fmt(untreated_pct)}% Untreated Sewage &rarr; River BOD of {_fmt(bod, 2)} mg/L",
        "desc": (
            f"With <b>{_fmt(untreated)} MLD untreated</b> ({_fmt(untreated_pct)}% of total generation), the river "
            f"receives a substantial organic load, pushing <b>BOD to {_fmt(bod, 2)} mg/L</b>"
            + (f" - nearly {_fmt(bod / 10, 0)}x the CPCB Class C limit of 10 mg/L." if bod > 10 else ".")
            + f" Treated sewage changed by <b>{'+' if treated_change >= 0 else ''}{_fmt(treated_change)} MLD</b>"
            f" and untreated load by <b>{'+' if untreated_change >= 0 else ''}{_fmt(untreated_change)} MLD</b> over the simulation"
            + (", indicating the gap is widening with population growth." if untreated_change > 0 else ".")
        ),
        "bg": RED_LIGHT if bod > 10 else TEAL_LIGHT,
        "accent": RED if bod > 10 else TEAL,
    })

    pump_overflow = outputs.get("pump_overflow", 0.0)
    pump_cap = float(params.get("pump_capacity", 140))
    maint_pump = _maint_label(params.get("maint_pump", "high (>0.90)"))
    if pump_overflow <= 0:
        cards.append({
            "title": f"{maint_pump} Pump Maintenance &rarr; Zero Pumping Overflow",
            "desc": (
                f"Despite a pumping capacity of only <b>{_fmt(pump_cap, 0)} MLD</b>, maintaining pumps at &gt;0.90 "
                f"efficiency results in <b>0.0 MLD pumping overflow</b>. This confirms pumping infrastructure is not "
                f"a bottleneck in this scenario - sewage that reaches pumping stations is reliably conveyed to the STP."
            ),
            "bg": TEAL_LIGHT, "accent": TEAL,
        })
    else:
        cards.append({
            "title": f"Pumping Overflow: {_fmt(pump_overflow)} MLD",
            "desc": (
                f"With a pumping capacity of <b>{_fmt(pump_cap, 0)} MLD</b>, the system is experiencing "
                f"<b>{_fmt(pump_overflow)} MLD of pumping overflow</b>. Consider increasing pumping capacity or "
                f"improving maintenance to reduce this overflow."
            ),
            "bg": AMBER_LIGHT, "accent": AMBER,
        })

    capital_cost = outputs.get("capital_cost", 0.0)
    om_cost = outputs.get("om_cost", 0.0)
    if capital_cost <= 0:
        cards.append({
            "title": "Zero Capital Cost &rarr; Baseline Scenario Validity",
            "desc": (
                f"Capital costs are <b>0.0 Cr</b>, confirming this is a true do-nothing baseline. The "
                f"<b>{_fmt(om_cost)} Cr cumulative O&amp;M</b> cost represents only routine operations over the model period. "
                f"Any intervention scenario will add capital cost but should be evaluated against the reduction in river "
                f"BOD and untreated load."
            ),
            "bg": TEAL_LIGHT, "accent": TEAL,
        })
    else:
        cards.append({
            "title": f"Capital Investment: {_fmt(capital_cost)} Cr",
            "desc": (
                f"This scenario includes <b>{_fmt(capital_cost)} Cr in capital investment</b> for new infrastructure. "
                f"Combined with <b>{_fmt(om_cost)} Cr cumulative O&amp;M</b>, evaluate whether the treatment improvement "
                f"justifies the total expenditure."
            ),
            "bg": BLUE_GHOST, "accent": BLUE_MID,
        })

    pcts = params.get("discharge_pct") or [
        params.get("pct_untapped_drains", 31.0), params.get("pct_tapped_non_gravity", 32.0),
        params.get("pct_tapped_gravity", 0.0), params.get("pct_stp_gravity_sewer", 22.0),
    ]
    untapped_pct_val = float(pcts[0]) if len(pcts) > 0 else 31
    non_gravity_pct = float(pcts[1]) if len(pcts) > 1 else 32
    risky_pct = untapped_pct_val + non_gravity_pct
    gravity_sewer_pct = float(pcts[3]) if len(pcts) > 3 else 22
    if risky_pct > 50:
        cards.append({
            "title": f"{_fmt(risky_pct, 0)}% Sewage in Untapped / Non-Gravity Network &rarr; Structural Gap",
            "desc": (
                f"The conveyance breakdown shows <b>{_fmt(untapped_pct_val, 0)}% untapped drains + "
                f"{_fmt(non_gravity_pct, 0)}% non-gravity tapped</b> = {_fmt(risky_pct, 0)}% of sewage moving through "
                f"pathways with high overflow risk. Only {_fmt(gravity_sewer_pct, 0)}% reaches the STP via gravity sewer "
                f"(most reliable). Expanding STP-connected gravity sewer coverage is the highest-leverage structural "
                f"intervention to improve treatment rate."
            ),
            "bg": AMBER_LIGHT, "accent": AMBER,
        })

    return cards
