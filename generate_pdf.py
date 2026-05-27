"""
Generate PostDeployment_Solutions_WaterDSS_Updated.pdf from the markdown file.
Uses reportlab only (no external binaries required).
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Preformatted, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Flowable
import re

# ── Colour palette ────────────────────────────────────────────────────────────
DARK_NAVY   = colors.HexColor("#0d1b2a")
MID_NAVY    = colors.HexColor("#1a2e45")
LIGHT_BLUE  = colors.HexColor("#2e86c1")
ACCENT_BLUE = colors.HexColor("#3498db")
CRITICAL    = colors.HexColor("#e74c3c")
HIGH        = colors.HexColor("#e67e22")
MEDIUM      = colors.HexColor("#f1c40f")
LOW_COL     = colors.HexColor("#27ae60")
CODE_BG     = colors.HexColor("#1e1e1e")
CODE_FG     = colors.HexColor("#d4d4d4")
RULE_COLOR  = colors.HexColor("#2e86c1")
TABLE_HEAD  = colors.HexColor("#1a2e45")
TABLE_ROW   = colors.HexColor("#f4f6f8")
TABLE_ALT   = colors.HexColor("#eaf0fb")
TEXT_DARK   = colors.HexColor("#1a1a2e")
TEXT_MID    = colors.HexColor("#34495e")
INLINE_BG   = colors.HexColor("#eef2f7")

PAGE_W, PAGE_H = A4
LEFT_M = RIGHT_M = 18 * mm
TOP_M  = 20 * mm
BOT_M  = 20 * mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ────────────────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    def s(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        "cover_title": s("cover_title",
            fontName="Helvetica-Bold", fontSize=32, leading=40,
            textColor=colors.white, alignment=TA_CENTER, spaceAfter=6),
        "cover_sub": s("cover_sub",
            fontName="Helvetica", fontSize=13, leading=18,
            textColor=colors.HexColor("#aed6f1"), alignment=TA_CENTER, spaceAfter=4),
        "cover_meta": s("cover_meta",
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=colors.HexColor("#85c1e9"), alignment=TA_CENTER, spaceAfter=2),

        "h1": s("h1",
            fontName="Helvetica-Bold", fontSize=20, leading=26,
            textColor=colors.white, spaceAfter=4, spaceBefore=6),
        "h2": s("h2",
            fontName="Helvetica-Bold", fontSize=14, leading=20,
            textColor=ACCENT_BLUE, spaceAfter=4, spaceBefore=10),
        "h3": s("h3",
            fontName="Helvetica-Bold", fontSize=11, leading=16,
            textColor=TEXT_DARK, spaceAfter=3, spaceBefore=8),

        "body": s("body",
            fontName="Helvetica", fontSize=9.5, leading=15,
            textColor=TEXT_MID, spaceAfter=5),
        "body_bold": s("body_bold",
            fontName="Helvetica-Bold", fontSize=9.5, leading=15,
            textColor=TEXT_DARK, spaceAfter=3),

        "code": s("code",
            fontName="Courier", fontSize=8, leading=12,
            textColor=CODE_FG, backColor=CODE_BG,
            spaceAfter=6, spaceBefore=4,
            leftIndent=8, rightIndent=8),

        "bullet": s("bullet",
            fontName="Helvetica", fontSize=9.5, leading=15,
            textColor=TEXT_MID, leftIndent=16, spaceAfter=3,
            bulletIndent=4),

        "toc_header": s("toc_header",
            fontName="Helvetica-Bold", fontSize=11, leading=16,
            textColor=colors.white, spaceAfter=2),
        "toc_row": s("toc_row",
            fontName="Helvetica", fontSize=9.5, leading=14,
            textColor=TEXT_MID),

        "issue_num": s("issue_num",
            fontName="Helvetica-Bold", fontSize=9, leading=12,
            textColor=colors.HexColor("#85c1e9"), spaceAfter=1),
        "issue_title": s("issue_title",
            fontName="Helvetica-Bold", fontSize=17, leading=22,
            textColor=colors.white, spaceAfter=0),

        "section_label": s("section_label",
            fontName="Helvetica-Bold", fontSize=9.5, leading=13,
            textColor=ACCENT_BLUE, spaceAfter=2, spaceBefore=6),

        "solution_num": s("solution_num",
            fontName="Helvetica-Bold", fontSize=9.5, leading=13,
            textColor=colors.white, spaceAfter=2),

        "table_head": s("table_head",
            fontName="Helvetica-Bold", fontSize=9, leading=13,
            textColor=colors.white, alignment=TA_CENTER),
        "table_cell": s("table_cell",
            fontName="Helvetica", fontSize=8.5, leading=13,
            textColor=TEXT_DARK),
        "table_cell_mono": s("table_cell_mono",
            fontName="Courier", fontSize=8, leading=13,
            textColor=TEXT_DARK),
        "table_cell_bold": s("table_cell_bold",
            fontName="Helvetica-Bold", fontSize=8.5, leading=13,
            textColor=TEXT_DARK),
    }


# ── Custom Flowables ──────────────────────────────────────────────────────────
class IssueBanner(Flowable):
    """Dark navy banner with issue number, title, and priority badge."""
    def __init__(self, number, title, priority, width):
        Flowable.__init__(self)
        self.number   = number
        self.title    = title
        self.priority = priority.upper()
        self.width    = width
        self.height   = 58

    def _prio_color(self):
        return {"CRITICAL": CRITICAL, "HIGH": HIGH,
                "MEDIUM": MEDIUM, "LOW": LOW_COL}.get(self.priority, LIGHT_BLUE)

    def draw(self):
        c = self.canv
        # background
        c.setFillColor(DARK_NAVY)
        c.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=0)
        # left accent bar
        c.setFillColor(self._prio_color())
        c.rect(0, 0, 5, self.height, fill=1, stroke=0)
        # priority badge (right)
        badge_w = 68
        c.setFillColor(self._prio_color())
        c.roundRect(self.width - badge_w - 10, self.height - 24, badge_w, 20, 4, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(self.width - badge_w/2 - 10, self.height - 14, self.priority)
        # issue number
        c.setFillColor(colors.HexColor("#85c1e9"))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(16, self.height - 16, self.number)
        # title (may wrap)
        from reportlab.pdfbase.pdfmetrics import stringWidth
        font, size = "Helvetica-Bold", 16
        max_w = self.width - badge_w - 30
        while stringWidth(self.title, font, size) > max_w and size > 11:
            size -= 1
        c.setFillColor(colors.white)
        c.setFont(font, size)
        c.drawString(16, self.height - 38, self.title)

    def wrap(self, aw, ah):
        return self.width, self.height


class SolutionStep(Flowable):
    """Numbered circle + bold label for solution steps."""
    def __init__(self, number, label, width):
        Flowable.__init__(self)
        self.number = str(number)
        self.label  = label
        self.width  = width
        self.height = 22

    def draw(self):
        c = self.canv
        c.setFillColor(ACCENT_BLUE)
        c.circle(10, 10, 10, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(10, 6.5, self.number)
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(28, 7, self.label)

    def wrap(self, aw, ah):
        return self.width, self.height


class CoverPage(Flowable):
    """Full-page dark cover."""
    def __init__(self, width, height):
        Flowable.__init__(self)
        self.width  = width
        self.height = height

    def draw(self):
        c = self.canv
        # gradient-ish background
        c.setFillColor(DARK_NAVY)
        c.rect(-LEFT_M, -BOT_M, self.width + LEFT_M + RIGHT_M,
               self.height + TOP_M + BOT_M, fill=1, stroke=0)
        # decorative lines
        c.setStrokeColor(ACCENT_BLUE)
        c.setLineWidth(1)
        c.line(0, self.height * 0.62, self.width, self.height * 0.62)
        c.line(0, self.height * 0.60, self.width, self.height * 0.60)

    def wrap(self, aw, ah):
        return self.width, 0   # zero height — we paint behind content


# ── Header / Footer ───────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # header bar
    canvas.setFillColor(MID_NAVY)
    canvas.rect(0, h - 14 * mm, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(LEFT_M, h - 9 * mm, "WaterDSS — Post-Deployment Solutions Guide  v2.0")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - RIGHT_M, h - 9 * mm, f"Page {doc.page}")
    # footer rule
    canvas.setStrokeColor(ACCENT_BLUE)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT_M, BOT_M - 2 * mm, w - RIGHT_M, BOT_M - 2 * mm)
    canvas.setFillColor(TEXT_MID)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(LEFT_M, BOT_M - 6 * mm, "May 2026 · slcrdeployment")
    canvas.restoreState()


def on_first_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(DARK_NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setStrokeColor(ACCENT_BLUE)
    canvas.setLineWidth(1.2)
    canvas.line(LEFT_M, h * 0.42, w - RIGHT_M, h * 0.42)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT_M, h * 0.405, w - RIGHT_M, h * 0.405)
    canvas.restoreState()


# ── Build helpers ─────────────────────────────────────────────────────────────
def priority_badge_para(text, styles):
    col = {"CRITICAL": "#e74c3c", "HIGH": "#e67e22",
           "MEDIUM": "#f39c12", "LOW": "#27ae60"}.get(text.upper(), "#3498db")
    return Paragraph(
        f'<font color="{col}"><b>[{text.upper()}]</b></font>',
        styles["body"])


def make_code_block(lines, styles):
    """Dark code block."""
    text = "\n".join(lines)
    # sanitise for ReportLab XML
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Preformatted(text, styles["code"])


def make_table(headers, rows, styles, col_widths=None):
    s = styles
    head_cells = [Paragraph(h, s["table_head"]) for h in headers]
    data = [head_cells]
    for i, row in enumerate(rows):
        cells = []
        for j, cell in enumerate(row):
            style = s["table_cell_mono"] if j > 0 and "`" in str(cell) else s["table_cell"]
            cell_text = str(cell).replace("`", "")
            cells.append(Paragraph(cell_text, style))
        data.append(cells)

    if col_widths is None:
        n = len(headers)
        col_widths = [CONTENT_W / n] * n

    t = Table(data, colWidths=col_widths, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  TABLE_HEAD),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  9),
        ("ALIGN",       (0, 0), (-1, 0),  "CENTER"),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("GRID",        (0, 0), (-1, -1), 0.25, colors.HexColor("#c8d6e5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [TABLE_ROW, TABLE_ALT]),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ])
    t.setStyle(ts)
    return t


# ── Document assembly ─────────────────────────────────────────────────────────
def build_pdf(out_path):
    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=LEFT_M, rightMargin=RIGHT_M,
        topMargin=TOP_M + 8 * mm, bottomMargin=BOT_M + 4 * mm,
        title="WaterDSS Post-Deployment Solutions Guide v2.0",
        author="WaterDSS Team",
    )
    styles = build_styles()
    story  = []

    def sp(n=6):
        story.append(Spacer(1, n))

    def rule():
        story.append(HRFlowable(width="100%", thickness=0.5,
                                color=RULE_COLOR, spaceAfter=4, spaceBefore=4))

    def para(text, style="body"):
        story.append(Paragraph(text, styles[style]))

    def h2(text):
        sp(8)
        story.append(Paragraph(text, styles["h2"]))
        sp(2)

    def h3(text):
        story.append(Paragraph(text, styles["h3"]))

    def bullet(text):
        story.append(Paragraph(f"• {text}", styles["bullet"]))

    # ── COVER ─────────────────────────────────────────────────────────────────
    story.append(CoverPage(CONTENT_W, PAGE_H - TOP_M - BOT_M))
    sp(60)
    para("Post-Deployment", "cover_sub")
    sp(4)
    para("Solutions Guide", "cover_title")
    sp(10)
    story.append(HRFlowable(width="60%", thickness=1.5, color=ACCENT_BLUE,
                            spaceAfter=10, spaceBefore=4))
    para("Detailed, actionable fixes for every issue found in the<br/>"
         "current <b>WaterDSS</b> codebase.", "cover_sub")
    sp(20)
    para("Next.js 16 · Django 5.1 + Daphne · FastAPI + Gunicorn/Uvicorn · FastM<br/>"
         "PostgreSQL 16 · Redis 7.4 · Celery 5.4 · GeoServer 2.28.0 (Kartoza)<br/>"
         "Docker Compose · Cloudflare Tunnel · Vercel", "cover_meta")
    sp(12)
    para("May 2026 · Version 2.0", "cover_meta")
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ─────────────────────────────────────────────────────
    # Dark header band
    toc_title_data = [[Paragraph("Table of Contents", styles["toc_header"])]]
    toc_title_table = Table(toc_title_data, colWidths=[CONTENT_W])
    toc_title_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), MID_NAVY),
        ("LEFTPADDING",(0,0),(-1,-1), 10),
        ("TOPPADDING", (0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
    ]))
    story.append(toc_title_table)
    sp(4)

    toc_entries = [
        ("01", "Hardcoded Secrets in Source Code",                 "CRITICAL"),
        ("02", "No Health Checks on Any Docker Service",           "HIGH"),
        ("03", "GeoServer CORS Partially Fixed — WebSocket URL Still Wrong", "CRITICAL"),
        ("04", "No Database Backup Strategy",                      "HIGH"),
        ("05", "PostGIS Spatial Queries Missing Indexes",           "HIGH"),
        ("06", "Celery Flower Has No Authentication",               "MEDIUM"),
        ("07", "Access Token Expiry Set to 1 Minute",              "HIGH"),
        ("08", "print() Statements in Production + Logs Lost on Restart", "MEDIUM"),
        ("09", "DB and Redis Ports Still Exposed Publicly",         "HIGH"),
        ("10", "No CI/CD Pipeline",                                "MEDIUM"),
        ("11", "Rate Limiting Missing on Django Backend",          "MEDIUM"),
        ("12", "Three Separate Databases, Alembic Not Run on Startup", "MEDIUM"),
        ("13", "FastAPI CORS Allows All Methods and Headers",      "MEDIUM"),
        ("14", "frontend/env.txt Has Wrong WebSocket URL & Exposed Secret", "CRITICAL"),
        ("15", "proxy.ts Does Not Validate Token Expiry",          "MEDIUM"),
        ("··", "Priority Checklist",                               ""),
    ]

    def prio_color(p):
        return {"CRITICAL": "#e74c3c", "HIGH": "#e67e22",
                "MEDIUM": "#f39c12", "LOW": "#27ae60"}.get(p, "#aaaaaa")

    for num, title, prio in toc_entries:
        badge = (f' <font color="{prio_color(prio)}"><b>[{prio}]</b></font>'
                 if prio else "")
        row_data = [[
            Paragraph(f'<font color="{ACCENT_BLUE.hexval()}"><b>{num}</b></font>',
                      styles["toc_row"]),
            Paragraph(f"{title}{badge}", styles["toc_row"]),
        ]]
        row_table = Table(row_data, colWidths=[16*mm, CONTENT_W - 16*mm])
        row_table.setStyle(TableStyle([
            ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
            ("LEFTPADDING",(0,0),(-1,-1), 4),
            ("BOTTOMPADDING",(0,0),(-1,-1), 3),
            ("TOPPADDING",(0,0),(-1,-1), 3),
            ("LINEBELOW",(0,0),(-1,-1), 0.25, colors.HexColor("#dce8f5")),
        ]))
        story.append(row_table)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 01
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 01", "Hardcoded Secrets in Source Code", "CRITICAL", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("Multiple credentials are hardcoded directly in tracked source files. Any access to the "
         "repository — by a contributor, a compromised CI runner, or a public leak — immediately "
         "exposes every service.")

    h2("Exact locations in your current codebase")
    story.append(make_table(
        ["File", "Line", "Secret"],
        [
            ("`backend/main/settings.py`",  "12",      "SECRET_KEY = \"django-insecure-3v41%...\""),
            ("`backend/main/settings.py`",  "243–244", "Gmail address + app password in plain text"),
            ("`fast_backend/fastdb.txt`",   "6–7",     "SECRET_KEY, VERIFY_KEY (JWT signing keys)"),
            ("`fast_backend/fastdb.txt`",   "15–16",   "MAIL_PASSWORD = \"sbkd vdki erqz morb\""),
            ("`fast_backend/fastdb.txt`",   "1–2",     "POSTGRES_USER=admin, POSTGRES_PASSWORD=admin"),
            ("`fast_backend/fastdb.txt`",   "19–28",   "GeoServer credentials (admin/geoserver)"),
            ("`database/.db.env`",          "1–2",     "POSTGRES_USER=admin, POSTGRES_PASSWORD=admin"),
            ("`frontend/env.txt`",          "5",       "NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/... — sent to every browser"),
        ],
        styles,
        col_widths=[68*mm, 18*mm, CONTENT_W - 86*mm],
    ))

    h2("Solutions")

    story.append(SolutionStep(1, "Move Django SECRET_KEY and email credentials to environment variables", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# backend/main/settings.py",
        "import os",
        "SECRET_KEY          = os.environ['DJANGO_SECRET_KEY']",
        "EMAIL_HOST_USER     = os.environ['EMAIL_HOST_USER']",
        "EMAIL_HOST_PASSWORD = os.environ['EMAIL_HOST_PASSWORD']",
    ], styles))

    story.append(SolutionStep(2, "Rename fastdb.txt → .fastdb.env and add all env files to .gitignore", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "mv fast_backend/fastdb.txt fast_backend/.fastdb.env",
        "",
        "echo 'fast_backend/.fastdb.env' >> .gitignore",
        "echo 'fast_backend/fastdb.txt'  >> .gitignore",
        "echo 'database/.db.env'         >> .gitignore",
        "echo '.env'                     >> .gitignore",
        "echo 'frontend/.env'            >> .gitignore",
    ], styles))

    story.append(SolutionStep(3, "Remove NEXT_PUBLIC_SECRET from frontend", CONTENT_W))
    sp(4)
    para("NEXT_PUBLIC_ variables are baked into the JavaScript bundle shipped to every browser. "
         "The JWT signing key must never be there. Token verification already runs server-side "
         "in proxy.ts — use MY_VERIFY_KEY (no NEXT_PUBLIC_ prefix) there instead. "
         "Remove NEXT_PUBLIC_SECRET from env.txt entirely.")

    story.append(SolutionStep(4, "Rotate all currently exposed credentials immediately", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# New Django SECRET_KEY",
        "python -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\"",
        "",
        "# New FastAPI JWT secret",
        "openssl rand -base64 32",
        "",
        "# Then:",
        "# - Revoke Gmail App Password (ak2968028@gmail.com) and dssiitbhu@gmail.com",
        "# - Change GeoServer password from 'geoserver'",
        "# - Change PostgreSQL password from 'admin'",
        "# - Change Redis password from 'your_secure_password'",
    ], styles))

    story.append(SolutionStep(5, "Keep .env.example with placeholder values only", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# fast_backend/.env.example",
        "POSTGRES_PASSWORD=changeme",
        "SECRET_KEY=changeme-generate-with-openssl-rand-base64-32",
        "VERIFY_KEY=changeme",
        "ACCESS_TOKEN_EXPIRE_MINUTES=60",
        "MAIL_PASSWORD=changeme-use-gmail-app-password",
        "GEOSERVER_ADMIN_PASSWORD=changeme",
        "REDIS_PASSWORD=changeme",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 02
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 02", "No Health Checks on Any Docker Service", "HIGH", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("depends_on only waits for the container process to start — not for the service inside "
         "to be ready. PostgreSQL takes several seconds before accepting connections. Django runs "
         "python manage.py migrate immediately and fails with a connection error. All Celery workers "
         "start before Redis is ready. restart: always masks this — services crash-restart until "
         "dependencies are up. No service currently defines a healthcheck.")

    h2("Specific locations in your codebase")
    for item in [
        "docker-compose.yml — zero healthcheck blocks on any of the 11 services",
        "backend service — runs python manage.py migrate with no wait logic",
        "celery_low, celery_high — depend on redis but no health condition",
        "celery_django — depends on redis_django and backend but no health condition",
        "database service — depends_on: [redis, geoserver] — DB should not depend on GeoServer",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Add healthchecks to all infrastructure services", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "",
        "database:",
        "  healthcheck:",
        "    test: [\"CMD-SHELL\", \"pg_isready -U admin -d slcr_cloud\"]",
        "    interval: 10s",
        "    timeout: 5s",
        "    retries: 5",
        "    start_period: 30s",
        "",
        "redis:",
        "  healthcheck:",
        "    test: [\"CMD\", \"redis-cli\", \"ping\"]",
        "    interval: 10s",
        "    timeout: 3s",
        "    retries: 5",
        "",
        "redis_django:",
        "  healthcheck:",
        "    test: [\"CMD\", \"redis-cli\", \"ping\"]",
        "    interval: 10s",
        "    timeout: 3s",
        "    retries: 5",
        "",
        "geoserver:",
        "  healthcheck:",
        "    test: [\"CMD-SHELL\", \"curl -f http://localhost:8080/geoserver/web/ || exit 1\"]",
        "    interval: 30s",
        "    timeout: 10s",
        "    retries: 5",
        "    start_period: 60s",
    ], styles))

    story.append(SolutionStep(2, "Use condition: service_healthy on dependent services", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "backend:",
        "  depends_on:",
        "    database:    { condition: service_healthy }",
        "    redis_django:{ condition: service_healthy }",
        "",
        "fast_backend:",
        "  depends_on:",
        "    database: { condition: service_healthy }",
        "    redis:    { condition: service_healthy }",
        "",
        "celery_low:",
        "  depends_on:",
        "    redis: { condition: service_healthy }",
    ], styles))

    story.append(SolutionStep(3, "Fix database depends_on — it should not depend on GeoServer", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# Remove this from database service:",
        "# depends_on:",
        "#   - redis",
        "#   - geoserver",
        "#",
        "# database has no upstream dependencies — remove the block entirely",
    ], styles))

    story.append(SolutionStep(4, "Add /health endpoints to FastAPI and Django", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# fast_backend/app/main.py",
        "@app.get('/health')",
        "async def health():",
        "    return {'status': 'ok'}",
        "",
        "# backend/main/urls.py",
        "from django.http import JsonResponse",
        "urlpatterns += [path('health/', lambda r: JsonResponse({'status': 'ok'}))]",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 03
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 03",
                    "GeoServer CORS Partially Fixed — WebSocket URL Still Wrong",
                    "CRITICAL", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("docker-compose.yml now sets GeoServer CORS to include wildcard subdomains "
         "(https://*.slcrdss.in), but GeoServer does not support wildcard subdomains in its "
         "CORS filter — exact origins must be listed. Additionally, frontend/env.txt line 7 "
         "sets NEXT_PUBLIC_WEBSOCKET_URL = wss://fast_backend:7000/api — fast_backend is a "
         "Docker-internal hostname that does not resolve from a user's browser. Every WebSocket "
         "connection fails immediately in production.")

    h2("Specific locations in your codebase")
    story.append(make_table(
        ["File", "Line", "Problem"],
        [
            ("docker-compose.yml",  "195", "CORS_ALLOWED_ORIGINS: https://*.slcrdss.in — wildcard not supported by GeoServer"),
            ("frontend/env.txt",    "7",   "wss://fast_backend:7000/api — Docker hostname, unreachable from browser"),
            ("frontend/env.txt",    "13",  "ws://localhost:9000/django — plain ws:// rejected by Cloudflare"),
        ],
        styles,
        col_widths=[52*mm, 16*mm, CONTENT_W - 68*mm],
    ))

    h2("Solutions")
    story.append(SolutionStep(1, "Replace wildcard with exact origins in GeoServer CORS", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "geoserver:",
        "  environment:",
        "    CORS_ALLOWED_ORIGINS: \"https://slcrdss.in,https://www.slcrdss.in,http://localhost:3000\"",
        "    CORS_ALLOWED_METHODS: \"GET,POST,PUT,DELETE,HEAD,OPTIONS\"",
        "    CORS_ALLOWED_HEADERS: \"*\"",
    ], styles))

    story.append(SolutionStep(2, "Fix WebSocket URLs in frontend/env.txt", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# frontend/.env — corrected values",
        "",
        "# Use public Cloudflare Tunnel domain, not Docker service name",
        "NEXT_PUBLIC_WEBSOCKET_URL = wss://slcrdss.in/api/ws",
        "",
        "# Django WebSocket — wss:// required through Cloudflare",
        "NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = wss://slcrdss.in/django/ws",
    ], styles))

    story.append(SolutionStep(3, "next.config.ts GeoServer proxy is already correct — keep it", CONTENT_W))
    sp(4)
    para("Your next.config.ts proxies /geoserver/* → http://geoserver:8080/geoserver/* server-side. "
         "frontend/env.txt already uses NEXT_PUBLIC_GEOSERVER_URL = /geoserver (relative). "
         "GeoServer is never called directly from the browser, so its CORS policy does not need "
         "to include Vercel's domain. This pattern is correct — keep it.")

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 04
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 04", "No Database Backup Strategy", "HIGH", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("PostgreSQL data lives in postgres_data Docker volume. GeoServer config lives in "
         "geoserver_data. Both Redis volumes hold Celery task history and Django session data. "
         "There are no backup jobs anywhere. Additionally, del.sh deletes ALL Docker volumes "
         "with no confirmation prompt — running it by accident permanently destroys all data.")

    h2("Specific locations in your codebase")
    for item in [
        "docker-compose.yml: volumes postgres_data, geoserver_data, redis_data, redis_django_data — no backup",
        "del.sh: deletes all Docker volumes (docker volume ls -q | xargs docker volume rm) with no confirmation",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Add a safety confirmation to del.sh immediately", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "#!/bin/bash",
        "echo 'WARNING: This deletes ALL containers, images, and volumes.'",
        "echo \"Type 'YES' to confirm:\"",
        "read confirm",
        "if [ \"$confirm\" != \"YES\" ]; then echo 'Aborted.'; exit 1; fi",
        "# ... rest of script",
    ], styles))

    story.append(SolutionStep(2, "Set up automated daily pg_dump for all three databases", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "#!/bin/bash",
        "# /opt/waterdss/backup.sh",
        "DATE=$(date +%Y%m%d_%H%M%S)",
        "BACKUP_DIR='/opt/waterdss/backups'",
        "mkdir -p $BACKUP_DIR",
        "",
        "for DB in slcr slcr_cloud slcr_fastm; do",
        "  docker exec slcrdeployment-database-1 pg_dump -U admin $DB \\",
        "    | gzip > \"$BACKUP_DIR/${DB}_${DATE}.sql.gz\"",
        "done",
        "",
        "find $BACKUP_DIR -name '*.sql.gz' -mtime +7 -delete",
        "# cron: 0 2 * * * /opt/waterdss/backup.sh",
    ], styles))

    story.append(SolutionStep(3, "Back up GeoServer data directory", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "docker run --rm -v geoserver_data:/data \\",
        "  -v /opt/waterdss/backups:/backup \\",
        "  ubuntu tar czf /backup/geoserver_${DATE}.tar.gz /data",
    ], styles))

    story.append(SolutionStep(4, "Upload backups off-machine (Cloudflare R2 / S3)", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "rclone copy /opt/waterdss/backups/ r2:waterdss-backups/",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 05
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 05", "PostGIS Spatial Queries Missing Indexes", "HIGH", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("Spatial operations (STP site suitability, watershed delineation, GWZ queries) operate on "
         "PostGIS tables defined in model_gwz.py and model_stp.py. None of the SQLAlchemy model "
         "definitions include GiST spatial indexes. Every ST_Within / ST_Intersects / ST_DWithin "
         "query performs a full table scan. With India-wide datasets a query taking 20 ms in "
         "development with 1,000 rows will take 30+ seconds in production with 2 million rows.")

    h2("Specific locations in your codebase")
    for item in [
        "fast_backend/app/database/models/model_gwz.py — water_quality_assessment, groundwater_zone_raster — no indexes",
        "fast_backend/app/database/models/model_stp.py — stp_towns (lat/lon), stp_drain, stp_catchment — no spatial indexes",
        "No Alembic migration creates any GiST index",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Find all geometry columns missing indexes right now", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "-- Run in psql against slcr_cloud",
        "SELECT f_table_name, f_geometry_column",
        "FROM geometry_columns",
        "WHERE f_table_name NOT IN (",
        "    SELECT tablename FROM pg_indexes WHERE indexdef LIKE '%gist%'",
        ");",
    ], styles))

    story.append(SolutionStep(2, "Add GiST indexes via a new Alembic migration", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# In a new Alembic migration file",
        "def upgrade():",
        "    op.execute('CREATE INDEX IF NOT EXISTS idx_stp_towns_geom",
        "               ON stp_towns USING GIST (ST_Point(longitude, latitude))')",
        "    op.execute('CREATE INDEX IF NOT EXISTS idx_gwz_water_quality",
        "               ON water_quality_assessment USING GIST (geometry)')",
        "    op.execute('CREATE INDEX IF NOT EXISTS idx_stp_drain_geom",
        "               ON stp_drain USING GIST (geometry)')",
        "    op.execute('CREATE INDEX IF NOT EXISTS idx_stp_catchment_geom",
        "               ON stp_catchment USING GIST (geometry)')",
    ], styles))

    story.append(SolutionStep(3, "Use EXPLAIN ANALYZE to verify index usage", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "EXPLAIN ANALYZE",
        "SELECT * FROM stp_drain",
        "WHERE ST_Within(geometry,",
        "  ST_MakeEnvelope(80.5, 24.5, 83.5, 26.5, 4326));",
        "",
        "-- Look for 'Index Scan using idx_stp_drain_geom'",
        "-- 'Seq Scan' means the index is not being used",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 06
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 06", "Celery Flower Has No Authentication", "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("The flower service runs with no --basic_auth flag. Anyone who can reach port 5555 can "
         "view all Celery task history, worker status, queue depths, task arguments (which may "
         "contain user data), and can revoke or retry tasks.")

    h2("Specific locations in your codebase")
    for item in [
        "docker-compose.yml lines 175–183: flower with no authentication",
        "command: celery --broker=redis://redis:6379/0 flower --port=5555",
        "Port 5555 mapped publicly",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Add basic auth to Flower", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "flower:",
        "  image: mher/flower:latest",
        "  ports:",
        "    - '5555:5555'",
        "  depends_on:",
        "    redis:",
        "      condition: service_healthy",
        "  command: >",
        "    celery --broker=redis://redis:6379/0 flower",
        "    --port=5555",
        "    --basic_auth=${FLOWER_USER}:${FLOWER_PASSWORD}",
        "",
        "# Add to your environment file:",
        "# FLOWER_USER=admin",
        "# FLOWER_PASSWORD=<generate-strong-password>",
    ], styles))

    story.append(SolutionStep(2, "These Celery settings are already correct — keep them", CONTENT_W))
    sp(4)
    para("Your fast_backend/app/conf/celery.py already has the correct production settings:")
    for item in [
        "worker_max_tasks_per_child=50 — prevents memory growth from geospatial operations ✓",
        "result_expires=3600 — Redis memory does not grow indefinitely ✓",
        "task_soft_time_limit=600, task_time_limit=650 — tasks are bounded ✓",
        "task_acks_late=True, task_reject_on_worker_lost=True — no silent task loss ✓",
        "broker_heartbeat=30 — connection health maintained ✓",
    ]:
        bullet(item)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 07
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 07", "Access Token Expiry Set to 1 Minute", "HIGH", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("fast_backend/fastdb.txt line 9: ACCESS_TOKEN_EXPIRE_MINUTES = 1. Every user's FastAPI "
         "access token expires in 60 seconds. Users running STP site suitability analysis or "
         "watershed delineation (Celery tasks taking 2–30 minutes) will have their token expire "
         "mid-operation. REFRESH_TOKEN_EXPIRE_DAYS = 1 means users are fully logged out daily.")

    h2("Specific locations in your codebase")
    for item in [
        "fast_backend/fastdb.txt line 9: ACCESS_TOKEN_EXPIRE_MINUTES = 1",
        "fast_backend/fastdb.txt line 10: REFRESH_TOKEN_EXPIRE_DAYS = 1",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Increase to practical values", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# fast_backend/.fastdb.env",
        "ACCESS_TOKEN_EXPIRE_MINUTES = 60",
        "REFRESH_TOKEN_EXPIRE_DAYS = 7",
    ], styles))

    story.append(SolutionStep(2, "Implement silent token refresh in Axios", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "axiosInstance.interceptors.response.use(",
        "  response => response,",
        "  async error => {",
        "    if (error.response?.status === 401 && !error.config._retry) {",
        "      error.config._retry = true;",
        "      await refreshToken();",
        "      return axiosInstance(error.config);",
        "    }",
        "    return Promise.reject(error);",
        "  }",
        ");",
    ], styles))

    story.append(SolutionStep(3, "Handle token expiry in Django WebSocket connections", CONTENT_W))
    sp(4)
    para("Your Django WebSocket uses TokenAuthenticationMiddleware (channels_redis on "
         "redis_django:6379). WebSocket connections that outlive the token are silently dropped. "
         "Implement reconnection logic in your reconnecting-websocket setup that fetches a "
         "fresh token on each reconnect attempt.")

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 08
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 08",
                    "print() Statements in Production + Logs Lost on Restart",
                    "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("backend/main/settings.py lines 200–202 print Redis connection URLs to stdout on every "
         "Django startup — these may contain embedded credentials and are collected by log "
         "aggregators. FastAPI writes logs to logs/app.log relative to the container working "
         "directory; when the container restarts, all log history is lost.")

    h2("Solutions")
    story.append(SolutionStep(1, "Remove print() statements from settings.py", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# backend/main/settings.py — DELETE lines 200-202:",
        "# print('CELERY_BROKER_URL', CELERY_BROKER_URL)",
        "# print('CELERY_RESULT_BACKEND', CELERY_RESULT_BACKEND)",
        "# print('CACHE_URL', CACHE_URL)",
    ], styles))

    story.append(SolutionStep(2, "Mount log directories as Docker volumes", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "fast_backend:",
        "  volumes:",
        "    - ./fast_backend:/home/app:z",
        "    - ./logs/fast_backend:/home/app/logs   # persist logs",
        "",
        "backend:",
        "  volumes:",
        "    - ./backend:/home/app:z",
        "    - ./logs/backend:/home/app/logs         # persist logs",
    ], styles))

    story.append(SolutionStep(3, "Add structured logging config to Django settings.py", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# backend/main/settings.py",
        "LOGGING = {",
        "    'version': 1,",
        "    'formatters': {",
        "        'standard': {'format': '%(asctime)s | %(levelname)s | %(message)s'}",
        "    },",
        "    'handlers': {",
        "        'file': {'class': 'logging.handlers.RotatingFileHandler',",
        "                 'filename': '/home/app/logs/django.log',",
        "                 'maxBytes': 10485760, 'backupCount': 5,",
        "                 'formatter': 'standard'},",
        "        'console': {'class': 'logging.StreamHandler', 'formatter': 'standard'},",
        "    },",
        "    'root': {'handlers': ['file', 'console'], 'level': 'INFO'},",
        "}",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 09
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 09", "DB and Redis Ports Still Exposed Publicly", "HIGH", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("PostgreSQL on 5450:5432 and Redis on 6379:6379 are mapped to the host, making them "
         "directly reachable from the internet. With credentials admin/admin and "
         "your_secure_password, this is an open invitation. There is also no Nginx reverse "
         "proxy — all five application services are individually exposed with no single entry point.")

    h2("Specific locations in your codebase")
    story.append(make_table(
        ["Service", "Host Port", "Risk"],
        [
            ("database",    "5450:5432", "PostgreSQL directly reachable — credentials admin/admin"),
            ("redis",       "6379:6379", "Redis directly reachable — FLUSHALL possible"),
            ("redis_django","6370:6379", "Already has expose: but ports: may still bind to host"),
        ],
        styles,
        col_widths=[38*mm, 32*mm, CONTENT_W - 70*mm],
    ))

    h2("Solutions")
    story.append(SolutionStep(1, "Remove database and Redis ports from public host binding", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "database:",
        "  # Remove: ports: ['5450:5432']",
        "  expose: ['5432']   # only reachable within Docker network",
        "",
        "redis:",
        "  # Remove: ports: ['6379:6379']",
        "  expose: ['6379']",
    ], styles))

    story.append(SolutionStep(2, "Add Nginx as a single entry point", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# nginx/nginx.conf",
        "upstream django    { server backend:9000; }",
        "upstream fastapi   { server fast_backend:7000; }",
        "upstream fastm     { server fast_m:7100; }",
        "",
        "server {",
        "    listen 80;",
        "    server_name slcrdss.in;",
        "",
        "    location /django/    { proxy_pass http://django/django/; }",
        "    location /api/       { proxy_pass http://fastapi/api/; }",
        "    location /fastapi/   { proxy_pass http://fastm/; }",
        "    location /geoserver/ { proxy_pass http://geoserver:8080/geoserver/; }",
        "",
        "    # WebSocket",
        "    location /api/ws/ {",
        "        proxy_pass http://fastapi/api/ws/;",
        "        proxy_http_version 1.1;",
        "        proxy_set_header Upgrade $http_upgrade;",
        "        proxy_set_header Connection \"upgrade\";",
        "    }",
        "    client_max_body_size 100M;",
        "}",
    ], styles))

    story.append(SolutionStep(3, "Point Cloudflare Tunnel to Nginx on port 80, not individual services", CONTENT_W))
    sp(4)
    para("Configure cloudflared to forward to http://localhost:80 (Nginx). This gives you one "
         "entry point with routing, access logging, and rate limiting instead of tunnelling "
         "each service separately.")

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 10
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 10", "No CI/CD Pipeline", "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("There is no .github/workflows/ directory. Every deployment is manual: SSH, git pull, "
         "docker compose build, docker compose up -d. There is no automated test run, no build "
         "validation, and no smoke test after deploy. del.sh only destroys containers.")

    h2("Solutions")
    story.append(SolutionStep(1, "Create a minimal GitHub Actions deploy workflow", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# .github/workflows/deploy.yml",
        "name: Deploy WaterDSS",
        "on:",
        "  push:",
        "    branches: [main]",
        "jobs:",
        "  check:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - name: Django system check",
        "        run: cd backend && python manage.py check --deploy",
        "  deploy:",
        "    needs: check",
        "    steps:",
        "      - name: Deploy via SSH",
        "        uses: appleboy/ssh-action@v1",
        "        with:",
        "          script: |",
        "            cd /opt/waterdss && git pull",
        "            docker compose build && docker compose up -d",
        "            docker compose exec fast_backend alembic upgrade head",
    ], styles))

    story.append(SolutionStep(2, "Tag every production deployment", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "git tag v1.0.$(date +%Y%m%d) && git push --tags",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 11
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 11", "Rate Limiting Missing on Django Backend", "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("FastAPI has a custom AsyncSlidingWindowCounter (fast_backend/app/conf/rate_limiting.py) "
         "but it is an in-process counter — it does not share state across Gunicorn workers. With "
         "workers = cpu_count/2 + 1 (likely 5–9 on an i9), the effective rate limit is 5–9x "
         "higher than configured. Django (port 9000) has no rate limiting at all — login, OTP, "
         "and password reset endpoints are open to unlimited brute-force.")

    h2("Solutions")
    story.append(SolutionStep(1, "Add rate limiting to Django using django-ratelimit", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "pip install django-ratelimit  # add to backend/requirements.txt",
        "",
        "# backend/authapp/views.py",
        "from django_ratelimit.decorators import ratelimit",
        "",
        "@ratelimit(key='ip', rate='10/15m', method='POST', block=True)",
        "def login_view(request): ...",
        "",
        "@ratelimit(key='ip', rate='5/h', method='POST', block=True)",
        "def otp_verify(request): ...",
    ], styles))

    story.append(SolutionStep(2, "Replace in-process FastAPI rate limiter with Redis-backed slowapi", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# pip install slowapi",
        "from slowapi import Limiter",
        "from slowapi.util import get_remote_address",
        "",
        "# Shared across all Gunicorn workers via Redis",
        "limiter = Limiter(",
        "    key_func=get_remote_address,",
        "    storage_uri='redis://redis:6379/2'",
        ")",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 12
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 12",
                    "Three Databases — Alembic Not Run on Startup & --reload in Production",
                    "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("Neither fast_backend nor fast_m run Alembic migrations on container startup. Django "
         "runs python manage.py migrate correctly, but the FastAPI services start Gunicorn/Uvicorn "
         "directly, so schema changes are never applied automatically. Additionally both services "
         "use --reload in production commands, which watches filesystem changes and causes "
         "unpredictable worker restarts.")

    h2("Specific locations in your codebase")
    for item in [
        "docker-compose.yml line 88: fast_m command is uvicorn ... --reload — no migration, no production flag",
        "docker-compose.yml line 110: fast_backend command is gunicorn ... --reload — no migration",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Run Alembic migrations on startup and remove --reload", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# docker-compose.yml",
        "fast_backend:",
        "  command: >",
        "    sh -c 'alembic upgrade head &&",
        "           gunicorn app.main:app --config gunicorn.conf.py'",
        "",
        "fast_m:",
        "  command: >",
        "    sh -c 'alembic upgrade head &&",
        "           uvicorn app.main:app --host 0.0.0.0 --port 7100'",
    ], styles))

    story.append(SolutionStep(2, "Long-term: consolidate three databases into one with schemas", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "-- Single PostgreSQL database, three schemas",
        "-- Foreign keys work across schemas",
        "CREATE SCHEMA django_app;",
        "CREATE SCHEMA fastapi_app;",
        "CREATE SCHEMA fast_m;",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 13
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 13", "FastAPI CORS Allows All Methods and Headers", "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("fast_backend/app/main.py uses allow_methods=[\"*\"] and allow_headers=[\"*\"]. "
         "DOMAIN resolves to \"localhost:7000\" from fastdb.txt — this is the Docker-internal "
         "hostname, not your production domain. In production the effective CORS origin list "
         "is only http://localhost:3000.")

    h2("Solutions")
    story.append(SolutionStep(1, "Restrict methods and headers, fix DOMAIN value", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# fast_backend/app/main.py",
        "app.add_middleware(",
        "    CORSMiddleware,",
        "    allow_origins=[",
        "        'http://localhost:3000',",
        "        os.environ['ALLOWED_ORIGIN'],   # https://slcrdss.in in production",
        "    ],",
        "    allow_credentials=True,",
        "    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],",
        "    allow_headers=['Authorization', 'Content-Type', 'Accept'],",
        ")",
        "",
        "# fast_backend/.fastdb.env",
        "DOMAIN=https://slcrdss.in",
        "ALLOWED_ORIGIN=https://slcrdss.in",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 14
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 14",
                    "frontend/env.txt — Wrong WebSocket URL & Exposed JWT Secret",
                    "CRITICAL", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("Three problems in frontend/env.txt:")
    for item in [
        "Line 5: NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/... — same JWT key as FastAPI's SECRET_KEY, "
         "baked into every user's browser JavaScript bundle. Any user can extract it and forge tokens.",
        "Line 7: NEXT_PUBLIC_WEBSOCKET_URL = wss://fast_backend:7000/api — Docker-internal "
         "hostname. Unreachable from the user's browser. Every WebSocket connection fails immediately.",
        "Line 13: NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = ws://localhost:9000/django — plain ws:// "
         "rejected by Cloudflare Tunnel.",
    ]:
        bullet(item)

    h2("What's already correct (do not change)")
    for item in [
        "NEXT_PUBLIC_BASE_URL = /api  — relative path, proxied by next.config.ts ✓",
        "NEXT_PUBLIC_GEOSERVER_URL = /geoserver  — relative path, proxied server-side ✓",
        "NEXT_PUBLIC_DJANGO_URL = /django  — relative path, proxied server-side ✓",
        "NEXT_PUBLIC_TOKEN_URL = /token  — relative path, proxied server-side ✓",
    ]:
        bullet(item)

    h2("Solutions")
    story.append(SolutionStep(1, "Remove NEXT_PUBLIC_SECRET and fix WebSocket URLs", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "# frontend/.env — corrected",
        "",
        "# DELETE this line — JWT key must never reach the browser:",
        "# NEXT_PUBLIC_SECRET=BaAxHx8w0uFSm/wD5d+uDXVIGPVzYDdzkyJtns8uZ0Q",
        "",
        "# Keep this for server-side proxy.ts use only (no NEXT_PUBLIC_ prefix):",
        "MY_VERIFY_KEY=<rotated-value>",
        "",
        "# Fix WebSocket URLs to use your public domain:",
        "NEXT_PUBLIC_WEBSOCKET_URL = wss://slcrdss.in/api/ws",
        "NEXT_PUBLIC_WEBSOCKET_DJANGO_URL = wss://slcrdss.in/django/ws",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # ISSUE 15
    # ══════════════════════════════════════════════════════════════════════════
    story.append(KeepTogether([
        IssueBanner("ISSUE 15", "proxy.ts Does Not Validate Token Expiry", "MEDIUM", CONTENT_W),
        Spacer(1, 8),
    ]))

    h2("What's happening")
    para("proxy.ts checks only for the presence of the verified_token cookie — it does not "
         "verify the JWT signature or check the exp claim. An expired token passes the check. "
         "There is also a typo: /dss/about/vission (line 8) — should be vision.")

    h2("Solutions")
    story.append(SolutionStep(1, "Validate token expiry using jwtVerify from jose", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "// frontend/proxy.ts",
        "import { jwtVerify } from 'jose';",
        "",
        "export async function proxy(request: NextRequest) {",
        "  const { pathname } = request.nextUrl;",
        "  // ... existing bypass logic ...",
        "",
        "  const token = request.cookies.get('verified_token')?.value;",
        "  if (!token) return redirectToLogin(request);",
        "",
        "  try {",
        "    const secret = new TextEncoder().encode(process.env.MY_VERIFY_KEY);",
        "    await jwtVerify(token, secret);  // throws if expired or invalid",
        "  } catch {",
        "    return redirectToLogin(request);",
        "  }",
        "  return NextResponse.next();",
        "}",
    ], styles))

    story.append(SolutionStep(2, "Fix the typo in public routes", CONTENT_W))
    sp(4)
    story.append(make_code_block([
        "const PUBLIC_DSS_ROUTES = [",
        "  '/dss/about/vision',     // was '/dss/about/vission'",
        "  // ...",
        "];",
    ], styles))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # PRIORITY CHECKLIST
    # ══════════════════════════════════════════════════════════════════════════
    toc_title_data2 = [[Paragraph("Priority Checklist", styles["toc_header"])]]
    toc_title_table2 = Table(toc_title_data2, colWidths=[CONTENT_W])
    toc_title_table2.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), MID_NAVY),
        ("LEFTPADDING",(0,0),(-1,-1), 10),
        ("TOPPADDING",(0,0),(-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1), 10),
    ]))
    story.append(toc_title_table2)
    sp(6)

    checklist = [
        ("CRITICAL", "Rotate all exposed credentials — DB (admin/admin), GeoServer (admin/geoserver), JWT keys, Gmail app passwords", "2 hours"),
        ("CRITICAL", "Remove NEXT_PUBLIC_SECRET from frontend/env.txt", "15 min"),
        ("CRITICAL", "Fix WebSocket URLs: wss://fast_backend:7000 → wss://slcrdss.in/api/ws", "15 min"),
        ("CRITICAL", "Add .gitignore entries for all .env and fastdb.txt files", "15 min"),
        ("HIGH",     "Add Docker health checks to all services (Issue 02)", "2 hours"),
        ("HIGH",     "Fix database depends_on — remove redis and geoserver dependencies", "15 min"),
        ("HIGH",     "Add del.sh safety confirmation before volume deletion (Issue 04)", "15 min"),
        ("HIGH",     "Set up automated database backups (Issue 04)", "3 hours"),
        ("HIGH",     "Add GiST spatial indexes via Alembic migration (Issue 05)", "2 hours"),
        ("HIGH",     "Increase ACCESS_TOKEN_EXPIRE_MINUTES from 1 to 60 (Issue 07)", "15 min"),
        ("HIGH",     "Remove database ports 5450:5432 and redis ports 6379:6379 from host binding (Issue 09)", "30 min"),
        ("MEDIUM",   "Add Flower basic authentication (Issue 06)", "30 min"),
        ("MEDIUM",   "Remove print() statements from settings.py lines 200–202 (Issue 08)", "15 min"),
        ("MEDIUM",   "Mount log directories as Docker volumes (Issue 08)", "30 min"),
        ("MEDIUM",   "Add Nginx reverse proxy as single entry point (Issue 09)", "4 hours"),
        ("MEDIUM",   "Fix FastAPI CORS: restrict methods/headers, set correct DOMAIN (Issue 13)", "30 min"),
        ("MEDIUM",   "Run Alembic migrations on fast_backend and fast_m startup (Issue 12)", "30 min"),
        ("MEDIUM",   "Remove --reload flag from production commands (Issue 12)", "15 min"),
        ("MEDIUM",   "Add django-ratelimit to Django auth views (Issue 11)", "2 hours"),
        ("MEDIUM",   "Replace in-process FastAPI rate limiter with Redis-backed slowapi (Issue 11)", "2 hours"),
        ("MEDIUM",   "Add token expiry validation to proxy.ts (Issue 15)", "1 hour"),
        ("MEDIUM",   "Fix typo /dss/about/vission → vision in proxy.ts (Issue 15)", "5 min"),
        ("MEDIUM",   "Set up GitHub Actions CI/CD pipeline (Issue 10)", "3 hours"),
        ("LOW",      "Enable GeoWebCache tile caching in GeoServer admin panel", "1 hour"),
        ("LOW",      "Consolidate three databases into one with schemas (Issue 12)", "1 week"),
    ]

    def prio_col_hex(p):
        return {"CRITICAL": "#e74c3c","HIGH":"#e67e22","MEDIUM":"#f39c12","LOW":"#27ae60"}.get(p,"#888")

    cl_data = [[
        Paragraph("<b>Priority</b>", styles["table_head"]),
        Paragraph("<b>Issue</b>", styles["table_head"]),
        Paragraph("<b>Effort</b>", styles["table_head"]),
    ]]
    for p, desc, effort in checklist:
        cl_data.append([
            Paragraph(f'<font color="{prio_col_hex(p)}"><b>{p}</b></font>', styles["table_cell"]),
            Paragraph(desc, styles["table_cell"]),
            Paragraph(effort, styles["table_cell"]),
        ])

    cl_table = Table(cl_data, colWidths=[24*mm, CONTENT_W - 50*mm, 26*mm], repeatRows=1)
    cl_table.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,0),  TABLE_HEAD),
        ("TEXTCOLOR",   (0,0),(-1,0),  colors.white),
        ("ALIGN",       (0,0),(-1,0),  "CENTER"),
        ("VALIGN",      (0,0),(-1,-1), "TOP"),
        ("GRID",        (0,0),(-1,-1), 0.25, colors.HexColor("#c8d6e5")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[TABLE_ROW, TABLE_ALT]),
        ("LEFTPADDING",  (0,0),(-1,-1), 5),
        ("RIGHTPADDING", (0,0),(-1,-1), 5),
        ("TOPPADDING",   (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    story.append(cl_table)

    sp(14)
    rule()
    sp(4)
    para("<b>Stack verified against:</b> docker-compose.yml · backend/main/settings.py · "
         "fast_backend/fastdb.txt · fast_backend/app/main.py · fast_backend/app/conf/celery.py · "
         "fast_backend/app/conf/logging.py · fast_backend/app/conf/rate_limiting.py · "
         "fast_backend/app/database/models/model_gwz.py · fast_backend/app/database/models/model_stp.py · "
         "frontend/env.txt · frontend/proxy.ts · frontend/next.config.ts · "
         "database/init-databases.sql · del.sh", "body")
    sp(4)
    para("<b>Date:</b> May 2026 · <b>Version:</b> 2.0 · <b>Project:</b> WaterDSS — slcrdeployment", "body")

    # ── Build ──────────────────────────────────────────────────────────────────
    doc.build(story,
              onFirstPage=on_first_page,
              onLaterPages=on_page)
    print(f"PDF written → {out_path}")


if __name__ == "__main__":
    build_pdf(r"e:\slcrdeployment\PostDeployment_Solutions_WaterDSS_Updated.pdf")
