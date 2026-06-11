"""
Generate Technical Documentation PDF for Manual STP Suitability Module
Fixed version: no text overlap, proper table wrapping, safe flowchart.
"""
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, ListFlowable, ListItem
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor

# ── Palette ──────────────────────────────────────────────────────────────────
PRIMARY   = HexColor("#1e40af")
SECONDARY = HexColor("#0891b2")
ACCENT    = HexColor("#7c3aed")
SUCCESS   = HexColor("#16a34a")
WARNING   = HexColor("#d97706")
DANGER    = HexColor("#dc2626")
DARK      = HexColor("#1e293b")
MID       = HexColor("#475569")
WHITE     = colors.white
BORDER    = HexColor("#cbd5e1")

BOX_BLUE   = HexColor("#dbeafe")
BOX_CYAN   = HexColor("#cffafe")
BOX_VIOLET = HexColor("#ede9fe")
BOX_GREEN  = HexColor("#dcfce7")
BOX_AMBER  = HexColor("#fef3c7")
BOX_SLATE  = HexColor("#f8fafc")

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

# ── Styles ────────────────────────────────────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, **kw)

styles = {
    "cover_title": S("cover_title", fontName="Helvetica-Bold", fontSize=26,
                     textColor=WHITE, alignment=TA_CENTER, leading=34, spaceAfter=6),
    "cover_sub":   S("cover_sub", fontName="Helvetica", fontSize=12,
                     textColor=HexColor("#bfdbfe"), alignment=TA_CENTER, leading=17),
    "cover_meta":  S("cover_meta", fontName="Helvetica", fontSize=9,
                     textColor=HexColor("#93c5fd"), alignment=TA_CENTER, leading=13),
    "h1":  S("h1",  fontName="Helvetica-Bold", fontSize=16,
              textColor=PRIMARY, spaceBefore=14, spaceAfter=6, leading=22),
    "h2":  S("h2",  fontName="Helvetica-Bold", fontSize=12,
              textColor=PRIMARY, spaceBefore=10, spaceAfter=4, leading=17),
    "h3":  S("h3",  fontName="Helvetica-Bold", fontSize=10,
              textColor=DARK, spaceBefore=6, spaceAfter=3, leading=14),
    "body": S("body", fontName="Helvetica", fontSize=9,
               textColor=MID, leading=14, spaceAfter=4, alignment=TA_JUSTIFY),
    "body_b": S("body_b", fontName="Helvetica-Bold", fontSize=9,
                 textColor=DARK, leading=14, spaceAfter=3),
    "mono": S("mono", fontName="Courier", fontSize=7.5,
               textColor=HexColor("#1e3a5f"), leading=11, spaceAfter=2),
    "caption": S("caption", fontName="Helvetica-Oblique", fontSize=7.5,
                  textColor=MID, alignment=TA_CENTER, spaceAfter=4),
    "toc_h":    S("toc_h",   fontName="Helvetica-Bold", fontSize=10,
                   textColor=PRIMARY, leading=15, spaceAfter=2),
    "toc_item": S("toc_item", fontName="Helvetica", fontSize=9,
                   textColor=MID, leading=13, leftIndent=10),
    "bullet": S("bullet", fontName="Helvetica", fontSize=9,
                 textColor=MID, leading=13, leftIndent=12, spaceAfter=2),
    "cell":   S("cell", fontName="Helvetica", fontSize=8.5,
                 textColor=MID, leading=12, wordWrap="CJK"),
    "cell_b": S("cell_b", fontName="Helvetica-Bold", fontSize=8.5,
                 textColor=DARK, leading=12),
    "cell_hdr": S("cell_hdr", fontName="Helvetica-Bold", fontSize=8.5,
                   textColor=WHITE, leading=12),
    "cell_code": S("cell_code", fontName="Courier", fontSize=7.5,
                    textColor=HexColor("#1e3a5f"), leading=11, wordWrap="CJK"),
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def HR(color=BORDER, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=5, spaceBefore=5)

def SP(h=4):
    return Spacer(1, h * mm)

def P(text, style="body"):
    return Paragraph(text, styles[style])

def H1(t): return P(t, "h1")
def H2(t): return P(t, "h2")
def H3(t): return P(t, "h3")

def CP(text, style="cell"):
    """Cell paragraph — always wraps."""
    return Paragraph(text, styles[style])

def Bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["bullet"]),
                  leftIndent=16, bulletColor=PRIMARY, bulletType="bullet")
         for i in items],
        bulletType="bullet", leftIndent=6, spaceAfter=3,
    )

BASE_TS = TableStyle([
    ("BOX",       (0,0), (-1,-1), 0.5, BORDER),
    ("INNERGRID", (0,0), (-1,-1), 0.3, BORDER),
    ("TOPPADDING",    (0,0), (-1,-1), 5),
    ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ("RIGHTPADDING",  (0,0), (-1,-1), 6),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
])

def header_ts(header_color=PRIMARY):
    return TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), header_color),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, BOX_SLATE]),
    ] + BASE_TS.getCommands())

def kv_table(rows, c1=55*mm):
    """Key-value two-column table. Keys bold in shaded col."""
    c2 = CONTENT_W - c1
    data = [[CP(f"<b>{k}</b>", "cell_b"), CP(v, "cell")] for k, v in rows]
    t = Table(data, colWidths=[c1, c2], repeatRows=0)
    t.setStyle(TableStyle(
        BASE_TS.getCommands() + [
            ("BACKGROUND", (0,0), (0,-1), HexColor("#e2e8f0")),
            ("BACKGROUND", (1,0), (1,-1), BOX_SLATE),
        ]
    ))
    return t

# ── Flowchart (canvas-based, safe layout) ────────────────────────────────────
class FlowchartDrawing(Flowable):
    """
    Draws the complete user-flow flowchart.
    All text fits inside its box; boxes never overlap.
    """
    W = CONTENT_W
    H = 660

    def __init__(self):
        Flowable.__init__(self)
        self.width  = self.W
        self.height = self.H

    # ── primitives ────────────────────────────────────────────────────────────
    def _rect(self, c, x, y, w, h, title, sub="",
              fill=BOX_BLUE, stroke=PRIMARY, tc=PRIMARY):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.9)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        # title
        c.setFillColor(tc)
        fsz = 7.5
        c.setFont("Helvetica-Bold", fsz)
        # clip title to box width
        avail = w - 10
        while c.stringWidth(title, "Helvetica-Bold", fsz) > avail and fsz > 5:
            fsz -= 0.5
        c.setFont("Helvetica-Bold", fsz)
        tw = c.stringWidth(title, "Helvetica-Bold", fsz)
        cy = y + h/2 + (4 if sub else 0)
        c.drawString(x + (w - tw)/2, cy, title)
        if sub:
            sf = 6.5
            c.setFont("Helvetica", sf)
            c.setFillColor(MID)
            sw = c.stringWidth(sub, "Helvetica", sf)
            if sw > avail:
                # truncate
                while c.stringWidth(sub + "...", "Helvetica", sf) > avail and len(sub) > 3:
                    sub = sub[:-1]
                sub = sub + "..."
                sw = c.stringWidth(sub, "Helvetica", sf)
            c.drawString(x + (w - sw)/2, y + h/2 - 7, sub)

    def _diamond(self, c, cx, cy, hw, hh, text, fill=BOX_AMBER, stroke=WARNING):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.9)
        p = c.beginPath()
        p.moveTo(cx,      cy + hh)
        p.lineTo(cx + hw, cy)
        p.lineTo(cx,      cy - hh)
        p.lineTo(cx - hw, cy)
        p.close()
        c.drawPath(p, fill=1, stroke=1)
        # text inside diamond — split on '?' if needed
        c.setFillColor(DARK)
        fsz = 7.0
        c.setFont("Helvetica-Bold", fsz)
        avail = hw * 1.2
        # word-wrap manually (two lines max)
        words = text.split()
        lines = []
        cur = ""
        for w_ in words:
            test = (cur + " " + w_).strip()
            if c.stringWidth(test, "Helvetica-Bold", fsz) <= avail:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w_
        if cur:
            lines.append(cur)
        lines = lines[:3]
        lh = fsz + 2
        start_y = cy + (len(lines)-1) * lh / 2
        for i, ln in enumerate(lines):
            lw = c.stringWidth(ln, "Helvetica-Bold", fsz)
            c.drawString(cx - lw/2, start_y - i*lh, ln)

    def _arrow(self, c, x1, y1, x2, y2, label="", lcolor=MID):
        c.setStrokeColor(lcolor)
        c.setLineWidth(0.8)
        c.line(x1, y1, x2, y2)
        angle = math.atan2(y2 - y1, x2 - x1)
        hs = 5
        for da in (0.4, -0.4):
            ax = x2 - hs * math.cos(angle - da)
            ay = y2 - hs * math.sin(angle - da)
            c.line(x2, y2, ax, ay)
        if label:
            mx, my = (x1+x2)/2 + 3, (y1+y2)/2 + 3
            c.setFont("Helvetica", 6.5)
            c.setFillColor(MID)
            c.drawString(mx, my, label)

    def draw(self):
        c = self.canv
        W, H = self.W, self.H

        BW = 148   # standard box width
        BH = 26    # standard box height
        CX = W / 2

        # Title
        c.setFillColor(PRIMARY)
        c.setFont("Helvetica-Bold", 9)
        title = "Manual STP Suitability -- Complete User Flow"
        tw = c.stringWidth(title, "Helvetica-Bold", 9)
        c.drawString((W - tw)/2, H - 14, title)

        y = H - 32

        # 1. START
        self._rect(c, CX-BW/2, y-BH, BW, BH, "START: Open Manual Mode",
                   fill=PRIMARY, stroke=PRIMARY, tc=WHITE)
        self._arrow(c, CX, y-BH, CX, y-BH-10)
        y -= BH + 10

        # 2. Select Method
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Select Input Method",
                   "Shapefile / KML / Draw Polygon", fill=BOX_CYAN, stroke=SECONDARY)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 3. Diamond: Multi?
        DH, DW = 28, 80
        y -= DH
        self._diamond(c, CX, y, DW, DH, "Multi-file / Multi-polygon?")
        # No -> down
        self._arrow(c, CX, y-DH, CX, y-DH-8, "No", SUCCESS)
        # Yes -> right side note
        nx = CX + DW + 8
        c.setFont("Helvetica-Oblique", 7)
        c.setFillColor(ACCENT)
        c.drawString(nx, y, "Yes: same flow,")
        c.drawString(nx, y-9, "per-polygon entries")
        self._arrow(c, CX+DW, y, nx-2, y, "", ACCENT)
        y -= DH + 8

        # 4. Set Surface Radius
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Set Surface Radius (km)",
                   "Default 5 km buffer around polygon", fill=BOX_SLATE, stroke=BORDER, tc=DARK)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 5. Confirm Selection
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Confirm Selection",
                   "Backend: centroid, bbox, drains, area_ha", fill=BOX_BLUE, stroke=PRIMARY)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 6. Diamond: Constraint violations?
        y -= DH
        self._diamond(c, CX, y, DW, DH, "Constraint Violations?",
                      fill=HexColor("#fee2e2"), stroke=DANGER)
        self._arrow(c, CX, y-DH, CX, y-DH-8, "No", SUCCESS)
        # Yes -> right
        vx = CX + DW + 8
        self._rect(c, vx, y-BH//2, 100, BH, "Constraint Modal",
                   "Redraw / Find via DSS",
                   fill=HexColor("#fee2e2"), stroke=DANGER, tc=DANGER)
        self._arrow(c, CX+DW, y, vx, y, "Yes", DANGER)
        y -= DH + 8

        # 7. Select Drains + MLD
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Select Drains & Set MLD",
                   "Per-polygon drain dropdown; [] = use all", fill=BOX_VIOLET, stroke=ACCENT)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 8. Diamond: DSS Workflow?
        y -= DH
        self._diamond(c, CX, y, DW, DH, "DSS Workflow?",
                      fill=HexColor("#fef9c3"), stroke=HexColor("#ca8a04"))
        self._arrow(c, CX, y-DH, CX, y-DH-8, "Yes", PRIMARY)
        # No -> right side note
        nx2 = CX + DW + 8
        c.setFont("Helvetica-Oblique", 7)
        c.setFillColor(MID)
        c.drawString(nx2, y, "No: skip to")
        c.drawString(nx2, y-9, "Tech Selection")
        self._arrow(c, CX+DW, y, nx2-2, y, "", MID)
        y -= DH + 8

        # 9. DSS Category Select
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "DSS: Select Conditions & Constraints",
                   "Weighted layers -> Run Analysis -> Raster", fill=BOX_BLUE, stroke=PRIMARY)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 10. STP Technology Selection
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "STP Technology Selection",
                   "Enter Q, Ce, BOD, COD, Coliform -> Score techs", fill=BOX_CYAN, stroke=SECONDARY)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 11. Diamond: Land > Area?
        y -= DH
        self._diamond(c, CX, y, DW, DH, "Land Required > Polygon Area?",
                      fill=HexColor("#fee2e2"), stroke=DANGER)
        self._arrow(c, CX, y-DH, CX, y-DH-8, "No", SUCCESS)
        vx2 = CX + DW + 8
        self._rect(c, vx2, y-BH//2, 100, BH, "Land Warning (amber)",
                   "Redraw / Find via DSS",
                   fill=HexColor("#fee2e2"), stroke=DANGER, tc=DANGER)
        self._arrow(c, CX+DW, y, vx2, y, "Yes", DANGER)
        y -= DH + 8

        # 12. Find Suitable Area
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Find Suitable Area",
                   "DSS: clusters | Non-DSS: road path", fill=BOX_GREEN, stroke=SUCCESS)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 13. Cluster Tables
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "Cluster Tables + Map Layers",
                   "Rank A/B/C, area_ha, drain distances, road path", fill=PRIMARY, stroke=PRIMARY, tc=WHITE)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 14. Diamond: All cluster area < land required?
        y -= DH
        self._diamond(c, CX, y, DW+10, DH, "All cluster area < land required?",
                      fill=HexColor("#ffedd5"), stroke=WARNING)
        self._arrow(c, CX, y-DH, CX, y-DH-8, "No", SUCCESS)
        vx3 = CX + DW + 18
        self._rect(c, vx3, y-BH//2, 102, BH, "Orange Warning Message",
                   "No cluster fits land req.",
                   fill=HexColor("#ffedd5"), stroke=WARNING, tc=WARNING)
        self._arrow(c, CX+DW+10, y, vx3, y, "Yes", WARNING)
        y -= DH + 8

        # 15. DPR (optional)
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "DPR Cost Estimation (Optional)",
                   fill=BOX_SLATE, stroke=BORDER, tc=DARK)
        self._arrow(c, CX, y, CX, y-10)
        y -= 10

        # 16. END
        y -= BH
        self._rect(c, CX-BW/2, y, BW, BH, "END / New Analysis",
                   fill=SUCCESS, stroke=SUCCESS, tc=WHITE)

        # ── Legend ────────────────────────────────────────────────────────────
        legend = [
            (BOX_BLUE,   PRIMARY, "Process/Action"),
            (BOX_AMBER,  WARNING, "Decision"),
            (BOX_GREEN,  SUCCESS, "Output/Result"),
            (HexColor("#fee2e2"), DANGER, "Error/Constraint"),
            (PRIMARY,    PRIMARY, "Start/End"),
        ]
        lx, ly = 4, 4
        for i, (fc, bc, lbl) in enumerate(legend):
            c.setFillColor(fc)
            c.setStrokeColor(bc)
            c.setLineWidth(0.6)
            c.roundRect(lx + i*100, ly, 12, 9, 2, fill=1, stroke=1)
            c.setFont("Helvetica", 6.5)
            c.setFillColor(DARK)
            c.drawString(lx + i*100 + 15, ly + 1.5, lbl)


# ── Architecture Diagram ──────────────────────────────────────────────────────
class ArchDiagram(Flowable):
    W = CONTENT_W
    H = 210

    def __init__(self):
        Flowable.__init__(self)
        self.width  = self.W
        self.height = self.H

    def _box(self, c, x, y, w, h, lines, fill=BOX_BLUE, stroke=PRIMARY):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
        # lines: list of (text, bold, fontsize)
        total = len(lines)
        lh = 9
        start_y = y + h/2 + (total-1)*lh/2
        for i, (txt, bold, fsz) in enumerate(lines):
            fn = "Helvetica-Bold" if bold else "Helvetica"
            c.setFont(fn, fsz)
            c.setFillColor(stroke if bold else MID)
            avail = w - 8
            while c.stringWidth(txt, fn, fsz) > avail and len(txt) > 4:
                txt = txt[:-1]
            if i == 0 and c.stringWidth(txt + "...", fn, fsz) < avail and txt != lines[i][0]:
                txt += "..."
            tw = c.stringWidth(txt, fn, fsz)
            c.drawString(x + (w-tw)/2, start_y - i*lh, txt)

    def _dash(self, c, x1, y1, x2, y2):
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.4)
        c.setDash(3, 3)
        c.line(x1, y1, x2, y2)
        c.setDash()

    def draw(self):
        c = self.canv
        W, H = self.W, self.H

        # Title
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(PRIMARY)
        title = "Module Architecture -- Component, Store & Service Relationships"
        tw = c.stringWidth(title, "Helvetica-Bold", 8.5)
        c.drawString((W-tw)/2, H-12, title)

        # ── Row 1: Stores (5 across) ──────────────────────────────────────────
        stores = [
            ("manualAreaStore", "Area, polygon, drains", BOX_VIOLET, ACCENT),
            ("manualMapStore",  "Layers, clusters",       BOX_BLUE,   PRIMARY),
            ("manualMultiStore","Multi-polygon entries",   BOX_CYAN,   SECONDARY),
            ("manualCategoryStore","DSS categories",       BOX_GREEN,  SUCCESS),
            ("manualUiStore",   "Panel & loading state",   BOX_AMBER,  WARNING),
        ]
        n = len(stores)
        gap = 4
        sw = (W - gap*(n-1)) / n
        sh = 30
        sy = H - 50
        store_centers = []
        for i, (name, desc, fc, bc) in enumerate(stores):
            sx = i*(sw+gap)
            self._box(c, sx, sy, sw, sh,
                      [(name, True, 6.5), (desc, False, 6.0)], fc, bc)
            store_centers.append(sx + sw/2)

        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(PRIMARY)
        c.drawString(0, sy+sh+3, "Zustand Stores")

        # ── Row 2: Components (4 across) ──────────────────────────────────────
        comps = [
            ("ManualOpenLayersMap", "Map, draw, OL layers",  BOX_SLATE, DARK),
            ("ManualAreaSelector",  "Input method, drains",   BOX_SLATE, DARK),
            ("ManualStpTechDss",    "Tech score, cluster tbl",BOX_SLATE, DARK),
            ("ManualLeft/RightPanel","DSS + workflow panels", BOX_SLATE, MID),
        ]
        nc = len(comps)
        cw = (W - gap*(nc-1)) / nc
        ch = 30
        cy_ = sy - 58
        comp_centers = []
        for i, (name, desc, fc, bc) in enumerate(comps):
            cx_ = i*(cw+gap)
            self._box(c, cx_, cy_, cw, ch,
                      [(name, True, 6.5), (desc, False, 6.0)], fc, bc)
            comp_centers.append(cx_ + cw/2)

        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(PRIMARY)
        c.drawString(0, cy_+ch+3, "React Components")

        # dashed lines stores -> components
        for i in range(min(n, nc)):
            sx_c = store_centers[i]
            cx_c = comp_centers[i] if i < nc else comp_centers[-1]
            self._dash(c, sx_c, sy, cx_c, cy_+ch)

        # ── Row 3: Services (3 across) ────────────────────────────────────────
        srvs = [
            ("manual_stpSuitabilityApi", "REST calls, cache, WS poll"),
            ("stpTechnologyScoring",     "Normalize & score technologies"),
            ("manual_stpSuitabilityTypes","ClusterInfo, PolygonClusterGroup..."),
        ]
        ns = len(srvs)
        srv_w = (W - gap*(ns-1)) / ns
        srv_h = 26
        srv_y = cy_ - 46
        srv_centers = []
        for i, (name, desc) in enumerate(srvs):
            sx_ = i*(srv_w+gap)
            self._box(c, sx_, srv_y, srv_w, srv_h,
                      [(name, True, 6.5), (desc, False, 6.0)],
                      HexColor("#f0fdf4"), SUCCESS)
            srv_centers.append(sx_ + srv_w/2)

        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(SUCCESS)
        c.drawString(0, srv_y+srv_h+3, "Services / Utilities")

        for i in range(min(nc, ns)):
            cx_c = comp_centers[i]
            sc = srv_centers[i] if i < ns else srv_centers[-1]
            self._dash(c, cx_c, cy_, sc, srv_y+srv_h)

        # ── Row 4: Backend bar ────────────────────────────────────────────────
        be_y = srv_y - 28
        c.setFillColor(HexColor("#1e3a5f"))
        c.setStrokeColor(PRIMARY)
        c.setLineWidth(0.8)
        c.roundRect(0, be_y, W, 22, 4, fill=1, stroke=1)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 7)
        btxt = "Backend API (Django / FastAPI)   |   /stp_manual_operation/*   |   Celery workers   |   GeoServer WMS/WFS"
        bw = c.stringWidth(btxt, "Helvetica-Bold", 7)
        c.drawString((W-bw)/2, be_y+7, btxt)

        # arrow services -> backend
        c.setStrokeColor(PRIMARY)
        c.setLineWidth(0.7)
        c.setDash()
        mid_x = W/2
        c.line(mid_x, srv_y, mid_x, be_y+22)
        angle = math.pi/2
        for da in (0.4, -0.4):
            ax = mid_x - 4*math.cos(angle-da)
            ay = be_y+22 - 4*math.sin(angle-da)
            c.line(mid_x, be_y+22, ax, ay)


# ── Page templates ─────────────────────────────────────────────────────────────
def on_cover(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas_obj.setFillColor(HexColor("#1d4ed8"))
    canvas_obj.circle(PAGE_W-60, PAGE_H-60, 90, fill=1, stroke=0)
    canvas_obj.setFillColor(HexColor("#1e3a8a"))
    canvas_obj.circle(60, 60, 70, fill=1, stroke=0)
    canvas_obj.setFillColor(SECONDARY)
    canvas_obj.rect(0, PAGE_H-7*mm, PAGE_W, 7*mm, fill=1, stroke=0)
    canvas_obj.restoreState()

def on_page(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, 0, PAGE_W, 11*mm, fill=1, stroke=0)
    canvas_obj.setFillColor(WHITE)
    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.drawString(MARGIN, 3.5*mm, "Manual STP Suitability -- Technical Reference")
    canvas_obj.drawRightString(PAGE_W-MARGIN, 3.5*mm, f"Page {doc.page}")
    canvas_obj.restoreState()


# ── Build story ───────────────────────────────────────────────────────────────
OUT = r"e:\slcrdeployment_new\Manual_STP_Suitability_Technical_Documentation.pdf"

story = []

# ── COVER ─────────────────────────────────────────────────────────────────────
story += [
    SP(55),
    P("Manual STP Suitability", "cover_title"),
    Paragraph("Technical Documentation", S("ct2", fontName="Helvetica", fontSize=16,
       textColor=HexColor("#bfdbfe"), alignment=TA_CENTER, leading=22)),
    SP(8),
    HRFlowable(width="80%", thickness=1.2, color=HexColor("#3b82f6"),
               spaceAfter=5, spaceBefore=5, hAlign="CENTER"),
    SP(4),
    P("Architecture  |  User Flow Flowchart  |  API Reference  |  Store Design",
      "cover_sub"),
    SP(50),
    P("DSS | STP | Wastewater Treatment Planning", "cover_meta"),
    SP(3),
    P("v1.0  |  June 2026", "cover_meta"),
    SP(3),
    P("SLCR Deployment -- Frontend Manual Mode Module", "cover_meta"),
    PageBreak(),
]

# ── TOC ───────────────────────────────────────────────────────────────────────
story += [H1("Table of Contents"), HR(PRIMARY, 1)]
toc = [
    ("1",  "Module Overview"),
    ("2",  "Architecture Diagram"),
    ("3",  "User Flow Flowchart"),
    ("4",  "Complete User Flow -- Step by Step"),
    ("5",  "Store Architecture & State Management"),
    ("6",  "API Service Reference"),
    ("7",  "TypeScript Types & Interfaces"),
    ("8",  "Map Layers & Styling"),
    ("9",  "STP Technology Scoring Algorithm"),
    ("10", "Multi-Polygon Flow"),
    ("11", "Key Algorithms & Logic"),
    ("12", "Configuration & Constants"),
    ("13", "Error Handling & Edge Cases"),
]
toc_data = [[CP(f"<b>{n}.</b>  {title}", "cell_b"), CP(f"pg {i+3}", "cell")]
            for i, (n, title) in enumerate(toc)]
toc_t = Table(toc_data, colWidths=[CONTENT_W-25*mm, 25*mm])
toc_t.setStyle(TableStyle([
    ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("LEFTPADDING", (0,0), (-1,-1), 4),
    ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ("LINEBELOW", (0,0), (-1,-2), 0.3, HexColor("#e2e8f0")),
    ("ALIGN", (1,0), (1,-1), "RIGHT"),
]))
story += [toc_t, PageBreak()]

# ── 1. MODULE OVERVIEW ────────────────────────────────────────────────────────
story += [H1("1. Module Overview"), HR(PRIMARY, 1)]
story.append(P(
    "The <b>Manual STP Suitability</b> module is a geospatial decision-support tool for Sewage "
    "Treatment Plant site selection. Planners delineate a study area (shapefile, KML, or drawn "
    "polygon), run weighted suitability analysis, score candidate STP technologies, and find "
    "optimal clusters with road-network distance calculations to drain points."
))

story += [SP(3), H2("1.1  Module Location")]
story.append(kv_table([
    ("Root Path",         "frontend/app/dss/stp/wwt/stp_suitability_v2/manual/"),
    ("Route",             "/dss/stp/wwt/stp_suitability_v2/manual"),
    ("Framework",         "Next.js 14 (App Router) + React 18"),
    ("Map Library",       "OpenLayers 9"),
    ("State Management",  "Zustand (5 dedicated stores)"),
    ("Styling",           "Tailwind CSS"),
    ("Backend",           "Django REST + FastAPI + Celery + GeoServer"),
]))

story += [SP(4), H2("1.2  Key Capabilities")]
story.append(Bullets([
    "<b>Three input methods:</b> Shapefile upload, KML upload, or interactive polygon drawing.",
    "<b>Multi-file / multi-polygon:</b> Process multiple regions simultaneously; each gets independent drain selection and cluster analysis.",
    "<b>Constraint checking:</b> Backend validates the area against constraint layers before proceeding.",
    "<b>DSS workflow:</b> Optional suitability raster from weighted condition + constraint layers.",
    "<b>Technology scoring:</b> Normalized multi-criteria scoring across 12 STP technologies.",
    "<b>Cluster analysis:</b> Finds top-N clusters within the suitability raster; computes road-network distances to drains.",
    "<b>Cluster area warning:</b> Alerts if no cluster has sufficient land for the required STP footprint.",
    "<b>DPR cost estimation:</b> Optional project cost report from selected technology + cluster.",
]))
story.append(PageBreak())

# ── 2. ARCHITECTURE DIAGRAM ───────────────────────────────────────────────────
story += [H1("2. Architecture Diagram"), HR(PRIMARY, 1)]
story.append(P(
    "Relationships between Zustand stores, React components, service utilities, and the backend API."
))
story += [SP(4), ArchDiagram(), SP(6)]

story += [H2("2.1  Component Responsibilities")]
comp_hdr = [[CP("<b>Component</b>","cell_hdr"), CP("<b>Responsibility</b>","cell_hdr"), CP("<b>Key Stores</b>","cell_hdr")]]
comp_rows = [
    ("ManualOpenLayersMap",    "OL map, draw/modify/snap interactions, all GeoServer WMS/WFS layers, admin layer toggles",  "mapStore, areaStore, multiStore"),
    ("ManualAreaSelector",     "Left panel: method selector, file uploader, drain picker, surface radius, confirm button",   "areaStore, mapStore, multiStore"),
    ("ManualStpTechnologyDss", "Right panel: STP parameters, technology ranking table, cluster tables, land/cluster warnings, DPR button", "mapStore, categoryStore"),
    ("ManualLeftPanel",        "Shell wrapping ManualAreaSelector in the left drawer",                                        "uiStore"),
    ("ManualRightPanel",       "Orchestrates DSS workflow panels (category slider -> suitability -> tech selection)",         "uiStore, categoryStore"),
    ("MultiDrainSelector",     "Per-polygon drain dropdown accordion for multi-polygon flow",                                 "multiStore, mapStore"),
    ("ClusterDistancesTable",  "Single-polygon cluster table: distance legend, drain chips, info tooltip, road-path toggle",  "mapStore"),
    ("MultiClusterDistancesTable", "One ClusterTableShell per polygon group (multi-polygon flow)",                           "mapStore"),
]
comp_data = comp_hdr + [[CP(n,"cell_b"), CP(d,"cell"), CP(s,"cell")] for n,d,s in comp_rows]
comp_t = Table(comp_data, colWidths=[48*mm, 90*mm, 37*mm])
comp_t.setStyle(header_ts())
story += [comp_t, PageBreak()]

# ── 3. FLOWCHART ──────────────────────────────────────────────────────────────
story += [H1("3. User Flow Flowchart"), HR(PRIMARY, 1)]
story.append(P(
    "Complete decision tree from opening the manual mode to cluster results and DPR estimation."
))
story += [SP(4), FlowchartDrawing(), PageBreak()]

# ── 4. COMPLETE USER FLOW ─────────────────────────────────────────────────────
story += [H1("4. Complete User Flow -- Step by Step"), HR(PRIMARY, 1)]

story.append(H2("Phase 1 -- Area Selection"))
story.append(kv_table([
    ("Step 1: Select Method",     "Choose Shapefile, KML, or Draw Polygon from the left panel radio group."),
    ("Step 2: Upload / Draw",     "Shapefile/KML: upload files, click Upload, preview appears on map. Polygon: toggle Draw on Map, click vertices, double-click to close. Multiple polygons can be drawn sequentially."),
    ("Step 3: Preview",           "Polygon outline appears in cyan dashed style before confirmation."),
    ("Step 4: Surface Radius",    "Adjust buffer zone (default 5 km) controlling drain search area around the polygon."),
    ("Step 5: Confirm Selection", "POST to /stp_manual_operation/confirm_manual_area. Returns: village vector layer, polygon layer, centroid, bbox, area_ha, raster layers."),
]))

story += [SP(3), H2("Phase 2 -- Constraint Checking")]
story.append(P(
    "After confirmation, the backend checks constraint layers within the polygon. "
    "If violations exist, a modal appears with two options:"
))
story.append(Bullets([
    "<b>Redraw Area</b> -- unlocks, clears map, returns to Phase 1.",
    "<b>Find through DSS</b> -- proceeds to DSS suitability workflow (Phase 4).",
]))

story += [SP(3), H2("Phase 3 -- Drain Selection & MLD Input")]
story.append(P(
    "Drain points in the buffer bbox are fetched and shown in a dropdown. "
    "User can leave All Drains checked (default = all used), uncheck individually, "
    "or uncheck All to clear. User also enters <b>Drain Capacity (MLD)</b> which drives "
    "technology scoring and land calculation: <b>Land Required (ha) = land_per_MLD x Q (MLD)</b>."
))

story += [SP(3), H2("Phase 4 -- DSS Suitability Analysis (Optional)")]
story.append(P(
    "User selects weighted condition layers (slope, land use etc.) and constraint layers. "
    "Clicking Analyze runs suitability raster generation. The map shows this raster; a "
    "village-level risk score table appears in the right panel."
))

story += [SP(3), H2("Phase 5 -- STP Technology Selection")]
story.append(kv_table([
    ("Q (MLD)",                 "STP design capacity; drives land and cost calculations."),
    ("Ce (Rs/kWh)",             "Electricity cost; affects O&M score."),
    ("BOD / COD (mg/L)",        "Influent concentrations; determine effluent compatibility score."),
    ("Coliform (MPN/100mL)",    "Faecal coliform load; same."),
    ("Land Required",           "= land_per_MLD x Q. Shown as constraint in Phase 6."),
], c1=50*mm))

story += [SP(3), H2("Phase 6 -- Land Violation Check")]
story.append(P(
    "If <b>Land Required > Marked Area (ha)</b>, an amber warning banner replaces the Find Suitable Area button. "
    "Options: Redraw Area or Find through DSS."
))

story += [SP(3), H2("Phase 7 -- Find Suitable Area")]
story.append(kv_table([
    ("DSS Mode",       "POST /find_area_cluster. Backend clusters suitability raster, ranks by proximity to centroid, returns top-N clusters (A/B/C) with area_ha, dist_to_polygon_m, drain distances, pre-computed road-path layers."),
    ("Non-DSS Mode",   "POST /find_manual_path. Finds shortest road path from centroid to drains. Returns path layer and cluster distances."),
    ("Multi-Polygon",  "Calls findMultiArea / findMultiPath sequentially per polygon to avoid Celery worker saturation."),
], c1=42*mm))

story += [SP(3), H2("Phase 8 -- Cluster Results & Area Warning")]
story.append(P(
    "Cluster tables render showing rank (A/B/C), area_ha (green), distance from polygon, "
    "and drain road distances. Clicking a cluster row toggles its road-path layer on the map."
))
story.append(P(
    "<b>Cluster Area Warning:</b> If every cluster's area_ha is less than landRequired, "
    "an orange warning appears below the last table: 'Land required (X.XX ha) is too large "
    "to match any cluster area. No cluster has sufficient land for the selected technology.'"
))
story.append(PageBreak())

# ── 5. STORE ARCHITECTURE ─────────────────────────────────────────────────────
story += [H1("5. Store Architecture & State Management"), HR(PRIMARY, 1)]
story.append(P("Five Zustand stores manage all module state."))

stores_detail = [
    ("manualAreaStore", BOX_VIOLET, ACCENT, [
        ("selectedMethod",      '"shapefile" | "polygon" | "kml"',  "Active input method"),
        ("uploadedFiles",       "File[]",                            "Files queued for upload"),
        ("drawnPolygon",        "{ geojson, label } | null",         "Latest confirmed polygon"),
        ("drawnPolygons",       "{ geojson, label }[]",              "All drawn polygons"),
        ("selectionsLocked",    "boolean",                           "Prevents edits after confirm"),
        ("selectionVectorLayer","string | null",                     "GeoServer villages layer name"),
        ("polygonLayer",        "string | null",                     "GeoServer polygon outline layer"),
        ("areaCentroid",        "[lat, lon] | null",                 "Polygon centroid for API calls"),
        ("bufferBbox",          "[minLon, minLat, maxLon, maxLat]",  "Bbox for drain query"),
        ("drainPoints",         "DrainPoint[]",                      "All drains within bbox"),
        ("selectedDrainNos",    "number[]",                          "[] = use all; [1,2] = specific"),
        ("drainCapacityMld",    "number | null",                     "Design flow in MLD"),
        ("markedAreaHa",        "number",                            "Polygon area in hectares"),
        ("surfaceRadius",       "number",                            "Buffer radius in km (default 5)"),
        ("previewGeojson",      "FeatureCollection | null",          "Preview outline before confirm"),
    ]),
    ("manualMapStore", BOX_BLUE, PRIMARY, [
        ("resultVectorLayer",      "string | null",            "Cluster polygons GeoServer layer"),
        ("resultPathVectorLayer",  "string | null",            "Road path GeoServer layer"),
        ("clusterDistances",       "ClusterInfo[] | null",     "Single-polygon cluster results"),
        ("multiClusterDistances",  "PolygonClusterGroup[] | null", "Multi-polygon cluster results"),
        ("selectedRadioLayer",     "string | null",            "Active raster for WMS display"),
        ("rasterLayerInfo",        "ClipRasters | null",       "Workspace + layer_name for WMS"),
        ("layerOpacity",           "number",                   "0-100 raster opacity"),
        ("showLegend",             "boolean",                  "Show/hide raster legend"),
        ("drawingActive",          "boolean",                  "OL draw interaction active"),
        ("showDrainLabels",        "boolean",                  "Drain No. text labels on map"),
        ("showPolygonLabels",      "boolean",                  "Polygon 1/2/3 labels on map"),
        ("selectedClusterRank",    "number | null",            "Which cluster road-path to show"),
    ]),
    ("manualMultiStore", BOX_CYAN, SECONDARY, [
        ("polygonEntries",    "MultiPolygonEntry[]",     "Per-polygon: layers, centroid, bbox, area, drains"),
        ("polygonResults",    "MultiPolygonResult[]",    "Per-polygon cluster + path results"),
        ("drainCapacityMld",  "number | null",           "Shared MLD across all polygons"),
        ("selectionsLocked",  "boolean",                 "Locks all polygon entries after confirm"),
    ]),
    ("manualCategoryStore", BOX_GREEN, SUCCESS, [
        ("initialized",         "boolean",                  "Categories fetched from backend"),
        ("conditionCategories", "Category[]",               "Available suitability layers"),
        ("constraintCategories","Category[]",               "Available constraint layers"),
        ("areaOptions",         "Stp_area[]",               "Technology land-per-MLD options"),
        ("selectedCondition",   "SelectRasterLayer[]",      "User-selected conditions with weights"),
        ("selectedConstraint",  "SelectRasterLayer[]",      "User-selected constraints with weights"),
        ("tableData",           "DataRow[]",                "Suitability analysis CSV results"),
        ("showTable",           "boolean",                  "Show results table"),
    ]),
    ("manualUiStore", BOX_AMBER, WARNING, [
        ("isRightPanelOpen",      "boolean",                           "Right panel drawer state"),
        ("showDssWorkflow",       "boolean",                           "DSS path selected"),
        ("treatmentLoading",      "boolean",                           "Area-finding in progress"),
        ("isPdfGenerating",       "boolean",                           "DPR report generating"),
        ("pendingTechnologyValues","TechnologyAreaSubmitValues | null", "Tech values pending after constraint"),
    ]),
]

for store_name, bg, bc, fields in stores_detail:
    story.append(H2(f"5.x  {store_name}"))
    hdr = [[CP("<b>Field</b>","cell_hdr"), CP("<b>Type</b>","cell_hdr"), CP("<b>Description</b>","cell_hdr")]]
    rows = [[CP(f, "cell_b"), CP(t, "cell_code"), CP(d, "cell")] for f, t, d in fields]
    ft = Table(hdr + rows, colWidths=[48*mm, 55*mm, CONTENT_W-103*mm])
    ft.setStyle(TableStyle(
        [("BACKGROUND", (0,0), (-1,0), bc),
         ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, bg])]
        + BASE_TS.getCommands()
    ))
    story += [ft, SP(5)]

story.append(PageBreak())

# ── 6. API REFERENCE ─────────────────────────────────────────────────────────
story += [H1("6. API Service Reference"), HR(PRIMARY, 1)]
story.append(P(
    "All calls are in <b>manual_stpSuitabilityApi.ts</b>. Long-running tasks use Celery; "
    "frontend polls via WebSocket (HTTP fallback, 2s interval, 10 min timeout)."
))
story.append(SP(3))

apis = [
    ("POST", "/confirm_manual_area",         "confirmManualAreaSelection",
     "Accepts shapefile/KML/polygon. Returns vector layer, polygon layer, centroid, bbox, area_ha, raster layers.",
     "method, files|polygon|kml, surface_radius",
     "{ vectorLayer, polygonLayer, centroidLat/Lon, bufferBbox, areaHa, rasterLayers }"),
    ("POST", "/preview_polygon",              "previewPolygon",
     "Returns GeoJSON FeatureCollection outline before confirmation.",
     "files: File[]",   "GeoJSON.FeatureCollection"),
    ("POST", "/confirm_multi_area",           "confirmMultiAreaSelection",
     "Processes multiple files into separate polygon entries.",
     "files, surface_radius",  "{ results: MultiAreaConfirmSingleResult[] }"),
    ("POST", "/confirm_multi_drawn_polygons", "confirmMultiDrawnPolygons",
     "Processes array of drawn GeoJSON polygons.",
     "polygons: { geojson, label }[]",  "{ results: MultiAreaConfirmSingleResult[] }"),
    ("POST", "/stp_manual_check_constraints", "checkManualConstraints",
     "Checks polygon against constraint layers. Returns violations list.",
     "polygon_geojson",  "{ constraint_violations: string[], can_proceed: boolean }"),
    ("POST", "/run_manual_suitability",       "runManualSuitabilityAnalysis",
     "Weighted suitability analysis; generates raster on GeoServer.",
     "data: SelectRasterLayer[], village_layer, method, file?, polygon?",
     "{ workspace, layer_name, csv_details: DataRow[] }"),
    ("GET",  "/fetch_drains_in_bbox",         "fetchDrainsInBbox",
     "Drain points within bounding box.",
     "bbox: [minLon, minLat, maxLon, maxLat]",
     "{ Drain_No, latitude, longitude }[]"),
    ("POST", "/find_area_cluster",            "findSuitabilityAreaCluster",
     "DSS mode: K-means clustering on suitability raster, ranks by proximity. Long-running (Celery).",
     "treatment_technology, mld_capacity, layer_name, location, drain_points?, num_clusters?",
     "{ cluster_layer, cluster_distances: ClusterInfo[], suitable_path? }"),
    ("POST", "/find_manual_path",             "findManualPath",
     "Non-DSS mode: road-network path from centroid to drains.",
     "location, drain_points, mld_capacity",
     "{ suitable_path, cluster_distances: ClusterInfo[] }"),
    ("POST", "/find_multi_area",              "findMultiArea",
     "Multi-polygon DSS: runs findSuitabilityAreaCluster sequentially per polygon.",
     "entries: MultiPolygonEntry[], tech params",
     "{ results: MultiAreaSingleResult[] }"),
    ("POST", "/find_multi_path",              "findMultiPath",
     "Multi-polygon non-DSS: runs findManualPath sequentially per polygon.",
     "entries: MultiPolygonEntry[], drain params",
     "{ results: MultiFindPathSingleResult[] }"),
    ("GET",  "/get_suitability_categories",   "fetchSuitabilityCategories",
     "Available condition/constraint layers and technology land-per-MLD options.",
     "--",  "{ conditions, constraints, area_options: Stp_area[] }"),
]

api_hdr = [[CP("<b>Method</b>","cell_hdr"), CP("<b>Endpoint</b>","cell_hdr"),
            CP("<b>Function</b>","cell_hdr"), CP("<b>Description / I-O</b>","cell_hdr")]]
api_rows = []
for method, ep, fn, desc, inp, out in apis:
    mc = SUCCESS if method == "GET" else PRIMARY
    api_rows.append([
        CP(f'<font color="{mc.hexval()}">{method}</font>', "cell_b"),
        CP(ep.replace("/","/<br/>", 1) if len(ep)>22 else ep, "cell_code"),
        CP(fn, "cell_code"),
        CP(f"{desc}<br/><i>In: {inp}</i><br/><i>Out: {out}</i>", "cell"),
    ])
api_t = Table(api_hdr + api_rows, colWidths=[14*mm, 48*mm, 46*mm, CONTENT_W-108*mm])
api_t.setStyle(header_ts())
story += [api_t, PageBreak()]

# ── 7. TYPESCRIPT TYPES ───────────────────────────────────────────────────────
story += [H1("7. TypeScript Types & Interfaces"), HR(PRIMARY, 1)]

types_data = [
    ("ClusterInfo",
     "cluster_rank: number  // 1=nearest\n"
     "area_ha: number\n"
     "dist_to_polygon_m: number\n"
     "drains: { Drain_No: number; distance_m: number }[]\n"
     "path_layer?: string | null  // DSS mode only"),
    ("PolygonClusterGroup",
     "label: string  // e.g. 'Polygon 1'\n"
     "clusters: ClusterInfo[]"),
    ("MultiPolygonEntry",
     "index: number\n"
     "vectorLayer: string  // GeoServer villages\n"
     "polygonLayer: string | null\n"
     "centroid: [lat: number, lon: number]\n"
     "bufferBbox: [minLon, minLat, maxLon, maxLat]\n"
     "areaHa: number\n"
     "drainPoints: DrainPoint[]\n"
     "selectedDrainNos: number[]  // [] = use all\n"
     "displayRasters: ClipRasters[]"),
    ("TechnologyAreaSubmitValues",
     "landPerMld: number       // ha/MLD\n"
     "mldCapacity: number      // Q in MLD\n"
     "technologyName: string\n"
     "numClusters?: number     // 1-10, default 3"),
    ("ManualAreaConfirmResult",
     "rasterLayers: ClipRasters[]\n"
     "vectorLayer: string | null\n"
     "polygonLayer: string | null\n"
     "centroidLat: number\n"
     "centroidLon: number\n"
     "bufferBbox: [minLon, minLat, maxLon, maxLat]\n"
     "areaHa: number"),
    ("StpTechnologyDssProps",
     "canFindArea?: boolean\n"
     "enableDprCostEstimator?: boolean\n"
     "isFindingArea?: boolean\n"
     "drainCapacityMld?: number | null\n"
     "markedAreaHa?: number\n"
     "showClusterSelect?: boolean\n"
     "onRedrawPolygon?: () => void\n"
     "onApplyDss?: (v: TechnologyAreaSubmitValues) => void\n"
     "onFindArea?: (v: TechnologyAreaSubmitValues) => void | Promise<void>"),
]
for type_name, code_str in types_data:
    story.append(H3(type_name))
    # Render as a shaded table cell so it wraps correctly
    code_para = CP(code_str.replace("\n", "<br/>").replace(" ", "&nbsp;"), "cell_code")
    code_t = Table([[code_para]], colWidths=[CONTENT_W])
    code_t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,-1), HexColor("#f0f9ff")),
        ("BOX",         (0,0), (-1,-1), 0.5, HexColor("#bae6fd")),
        ("TOPPADDING",  (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0), (-1,-1), 10),
    ]))
    story += [code_t, SP(3)]

story.append(PageBreak())

# ── 8. MAP LAYERS ─────────────────────────────────────────────────────────────
story += [H1("8. Map Layers & Styling"), HR(PRIMARY, 1), H2("8.1  Layer Z-Index Stack")]
layer_hdr = [[CP("<b>Z-Index</b>","cell_hdr"), CP("<b>Layer</b>","cell_hdr"),
              CP("<b>Type</b>","cell_hdr"),    CP("<b>Style</b>","cell_hdr")]]
layer_rows = [
    ("0",  "Base tile map (OSM)",            "TileLayer",              "Default OSM tiles"),
    ("1",  "India boundary",                 "VectorLayer (WFS)",      "Stroke #1e40af, no fill"),
    ("13", "Villages (confirmed area)",      "VectorLayer (WFS)",      "Indigo #6366f1, 10% fill"),
    ("20", "Draw layer (active drawing)",    "VectorLayer",            "Cyan #06b6d4 dashed 5,5"),
    ("30", "Suitability raster",             "ImageLayer (WMS)",       "Opacity: user-adjustable 0-100%"),
    ("40", "Result clusters (A/B/C)",        "VectorLayer (WFS)",      "Dark fill with rank text labels"),
    ("41", "Road path network",              "VectorLayer (WFS)",      "Green #16a34a, width 3"),
    ("55", "Drain points",                   "VectorLayer (points)",   "Violet #7c3aed circles; optional No. labels"),
    ("60", "Polygon outline",                "VectorLayer",            "Cyan #06b6d4 dashed, 8% fill"),
    ("70", "Polygon labels (Polygon 1/2/3)", "VectorLayer (text)",     "16px bold #4D5D53, toggle ON/OFF"),
]
lt = Table(layer_hdr + [[CP(a,"cell_b"),CP(b,"cell"),CP(c,"cell"),CP(d,"cell")] for a,b,c,d in layer_rows],
           colWidths=[17*mm, 52*mm, 38*mm, CONTENT_W-107*mm])
lt.setStyle(header_ts())
story += [lt, SP(5), H2("8.2  Administrative Layer Toggles")]
story.append(kv_table([
    ("India boundary",      "Toggles country boundary (WFS). Ref: multiPolygonOutlineLayersRef."),
    ("Drawn Polygon",       "Toggles uploaded/drawn polygon outline layers."),
    ("Confirmed Selection", "Toggles village vector layers (per-polygon in multi mode)."),
    ("Treatment Cluster",   "Toggles cluster result polygons (A/B/C). Ref: multiResultLayersRef."),
]))
story.append(PageBreak())

# ── 9. TECHNOLOGY SCORING ──────────────────────────────────────────────────────
story += [H1("9. STP Technology Scoring Algorithm"), HR(PRIMARY, 1)]
story.append(P(
    "Implemented in <b>stpTechnologyScoring.ts</b>. Each technology is scored 0-10 across "
    "seven criteria; weighted sum determines the rank."
))
story += [SP(3), H2("9.1  Scoring Criteria & Weights")]
sc_hdr = [[CP("<b>Criterion</b>","cell_hdr"), CP("<b>Weight Key</b>","cell_hdr"), CP("<b>Calculation</b>","cell_hdr")]]
sc_rows = [
    ("Reliability",          "C_WEIGHTS.rel",     "Fixed value per technology (0-10)"),
    ("Capital Cost",         "C_WEIGHTS.cap",     "Normalized: 10 x (max-cap)/(max-min); higher = better"),
    ("Land Requirement",     "C_WEIGHTS.land",    "Normalized: 10 x (max-land)/(max-min); higher = better"),
    ("O&M Cost",             "C_WEIGHTS.om",      "Normalized over all technologies; higher = better"),
    ("Ease of Operation",    "C_WEIGHTS.ease",    "Fixed value per technology (0-10)"),
    ("Track Record",         "C_WEIGHTS.track",   "Fixed value per technology (0-10)"),
    ("Effluent Compatibility","C_WEIGHTS.effluent","avg(BOD_score, COD_score, Coliform_score) from lookup"),
]
sc_t = Table(sc_hdr + [[CP(a,"cell_b"),CP(b,"cell_code"),CP(c,"cell")] for a,b,c in sc_rows],
             colWidths=[48*mm, 38*mm, CONTENT_W-86*mm])
sc_t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),ACCENT),
                           ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,BOX_VIOLET])]
                          + BASE_TS.getCommands()))
story += [sc_t, SP(4), H2("9.2  Land Required Formula")]
formula_t = Table([[CP("landRequired (ha)  =  selectedRawTech.land (ha/MLD)  x  params.Q (MLD)", "cell_code")]],
                  colWidths=[CONTENT_W])
formula_t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1), HexColor("#f0f9ff")),
    ("BOX",(0,0),(-1,-1), 0.5, HexColor("#bae6fd")),
    ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8),
    ("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12),
]))
story += [formula_t, SP(3)]
story.append(P(
    "Compared against <b>markedAreaHa</b> (polygon area check) and each "
    "<b>cluster.area_ha</b> (cluster area warning). Both produce distinct warnings."
))
story.append(PageBreak())

# ── 10. MULTI-POLYGON FLOW ────────────────────────────────────────────────────
story += [H1("10. Multi-Polygon Flow"), HR(PRIMARY, 1)]
story.append(P(
    "When 2+ files are uploaded or 2+ polygons drawn, the module switches to multi-polygon mode. "
    "Each polygon is processed independently; drain capacity MLD is shared across all."
))
story += [SP(3), H2("10.1  Entry Structure (MultiPolygonEntry)")]
story.append(kv_table([
    ("index",           "Sequential identifier (0, 1, 2...)"),
    ("vectorLayer",     "GeoServer WFS layer for this polygon's villages"),
    ("polygonLayer",    "GeoServer polygon outline layer (may be null for drawn polygons)"),
    ("centroid",        "[lat, lon] -- used as origin for road-path and cluster queries"),
    ("bufferBbox",      "[minLon, minLat, maxLon, maxLat] -- for drain fetch"),
    ("areaHa",          "Polygon area in hectares"),
    ("drainPoints",     "All drain points within buffer bbox"),
    ("selectedDrainNos","[] = use all drains; [1,2,3] = specific drain numbers"),
    ("displayRasters",  "Raster layers generated for this polygon (STP_Suitability_P1, etc.)"),
]))

story += [SP(4), H2("10.2  Drain Selection Per Polygon")]
story.append(P(
    "MultiDrainSelector renders a collapsible accordion with one PolygonDrainDropdown per entry. "
    "Each dropdown has its own uiSelected local state (null = all, [] = none, array = partial), "
    "completely decoupled from the store's selectedDrainNos semantics."
))
story += [SP(4), H2("10.3  Sequential API Calls")]
story.append(P(
    "Multi-polygon API calls are sequential (not parallel) to prevent Celery worker saturation. "
    "Each polygon's result is stored in polygonResults in multiStore."
))
story += [SP(4), H2("10.4  Raster Layer Deduplication")]
story.append(P(
    "Each polygon gets its own suitability raster (STP_Suitability_P1, P2...). "
    "The layer selector shows a single 'STP Suitability' entry; selecting it displays "
    "the first polygon's raster."
))
story.append(PageBreak())

# ── 11. KEY ALGORITHMS ────────────────────────────────────────────────────────
story += [H1("11. Key Algorithms & Logic"), HR(PRIMARY, 1), H2("11.1  Drain Checkbox UX (uiSelected Pattern)")]
story.append(P(
    "Two-state pattern distinguishes 'all selected' from 'none selected':"
))

alg1 = (
    "// uiSelected: null = all selected (visual), [] = none, [1,2] = partial\n"
    "const [uiSelected, setUiSelected] = useState<number[]|null>(null);\n"
    "const isAllSelected = uiSelected === null;\n"
    "const checkedIds = isAllSelected ? allIds : uiSelected;\n\n"
    "const toggleAll = () => {\n"
    "  if (isAllSelected) { setUiSelected([]); setSelectedDrainNos(allIds); }\n"
    "  else { setUiSelected(null); setSelectedDrainNos([]); }\n"
    "};\n"
    "// store [] = 'use all drains in API' (backend convention)\n"
    "// uiSelected null = 'show all checked in UI'\n"
    "// Intentionally inverted to handle semantic mismatch"
)
code_t1 = Table([[CP(alg1.replace("\n","<br/>").replace(" ","&nbsp;"), "cell_code")]],
                colWidths=[CONTENT_W])
code_t1.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#f0f9ff")),
    ("BOX",(0,0),(-1,-1),0.5,HexColor("#bae6fd")),("TOPPADDING",(0,0),(-1,-1),6),
    ("BOTTOMPADDING",(0,0),(-1,-1),6),("LEFTPADDING",(0,0),(-1,-1),10),
    ("RIGHTPADDING",(0,0),(-1,-1),10)]))
story += [code_t1, SP(4), H2("11.2  Cluster Area Warning Logic")]

alg2 = (
    "const allClusters = multiClusterDistances\n"
    "  ? multiClusterDistances.flatMap((g) => g.clusters)\n"
    "  : clusterDistances ?? [];\n\n"
    "const noneQualifies = allClusters.every((c) => (c.area_ha ?? 0) < landRequired);\n"
    "// Shows orange warning if noneQualifies === true"
)
code_t2 = Table([[CP(alg2.replace("\n","<br/>").replace(" ","&nbsp;"), "cell_code")]],
                colWidths=[CONTENT_W])
code_t2.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#fff7ed")),
    ("BOX",(0,0),(-1,-1),0.5,HexColor("#fed7aa")),("TOPPADDING",(0,0),(-1,-1),6),
    ("BOTTOMPADDING",(0,0),(-1,-1),6),("LEFTPADDING",(0,0),(-1,-1),10),
    ("RIGHTPADDING",(0,0),(-1,-1),10)]))
story += [code_t2, SP(4), H2("11.3  Weighted Influence Normalization")]

alg3 = (
    "// manualCategoryStore.ts -- buildWeightedSelections()\n"
    "const totalInfluence = selections.reduce((s, r) => s + Number(r.Influence), 0);\n"
    "return selections.map((r) => ({\n"
    "  ...r,\n"
    "  weight: (Number(r.Influence) / totalInfluence).toFixed(4),\n"
    "}));\n"
    "// Ensures weights always sum to 1.0"
)
code_t3 = Table([[CP(alg3.replace("\n","<br/>").replace(" ","&nbsp;"), "cell_code")]],
                colWidths=[CONTENT_W])
code_t3.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),HexColor("#f0fdf4")),
    ("BOX",(0,0),(-1,-1),0.5,HexColor("#bbf7d0")),("TOPPADDING",(0,0),(-1,-1),6),
    ("BOTTOMPADDING",(0,0),(-1,-1),6),("LEFTPADDING",(0,0),(-1,-1),10),
    ("RIGHTPADDING",(0,0),(-1,-1),10)]))
story += [code_t3, SP(4), H2("11.4  API Caching & Deduplication")]
story.append(P(
    "Two Map caches in manual_stpSuitabilityApi.ts prevent duplicate simultaneous requests for "
    "identical payloads: <b>areaResultCache</b> (completed results) and "
    "<b>areaRequestCache</b> (in-flight Promises). The key is JSON.stringify(payload). "
    "findSuitabilityAreaClusterFresh() clears both caches to force a fresh request."
))
story.append(PageBreak())

# ── 12. CONFIG & CONSTANTS ────────────────────────────────────────────────────
story += [H1("12. Configuration & Constants"), HR(PRIMARY, 1), H2("12.1  Technology Land per MLD")]
tech_hdr = [[CP("<b>Technology</b>","cell_hdr"), CP("<b>land (ha/MLD)</b>","cell_hdr")]]
tech_rows = [
    ("Trickling Filter",            "0.25"),
    ("Activated Sludge Process",    "0.15"),
    ("Extended Aeration",           "0.15"),
    ("Sequential Batch Reactor",    "0.10"),
    ("BIOFOR-F",                    "0.08"),
    ("Membrane Bioreactor",         "0.05"),
    ("Constructed Wetland",         "0.30"),
    ("Waste Stabilization Pond",    "0.40"),
    ("Anaerobic Baffled Reactor",   "0.08"),
    ("UASB + Constructed Wetland",  "0.15"),
    ("Compact MBBR",                "0.06"),
    ("Packaged Modular STP",        "0.05"),
]
tt = Table(tech_hdr + [[CP(n,"cell"),CP(v,"cell_b")] for n,v in tech_rows],
           colWidths=[110*mm, 40*mm])
tt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),SECONDARY),
                         ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,BOX_CYAN])]
                        + BASE_TS.getCommands()))
story += [tt, SP(5), H2("12.2  STP Parameter Ranges")]
story.append(kv_table([
    ("Q (MLD)",               "1 - 1000"),
    ("Ce (Rs/kWh)",           "1 - 20"),
    ("BOD (mg/L)",            "1 - 60,000"),
    ("COD (mg/L)",            "1 - 100,000"),
    ("Coliform (MPN/100mL)",  "1 - 1,000,000,000"),
    ("Land (ha/MLD)",         "0 - 10"),
    ("Capital (Cr/MLD)",      "0 - 100"),
    ("O&M (Rs/m3)",           "0 - 100"),
    ("Reliability/Ease/Track","0 - 10 (score)"),
    ("Num Clusters",          "1 - 10 (default 3)"),
    ("Surface Radius",        "Default 5 km; adjustable"),
], c1=50*mm))
story.append(PageBreak())

# ── 13. ERROR HANDLING ────────────────────────────────────────────────────────
story += [H1("13. Error Handling & Edge Cases"), HR(PRIMARY, 1), H2("13.1  User-Facing Errors")]
err_hdr = [[CP("<b>Scenario</b>","cell_hdr"), CP("<b>Handling</b>","cell_hdr"), CP("<b>Recovery</b>","cell_hdr")]]
err_rows = [
    ("Constraint violations",     "Modal with violation list",                   "Redraw or proceed via DSS"),
    ("Land required > area",      "Amber warning, Find Area disabled",           "Redraw polygon or switch to DSS"),
    ("All cluster areas too small","Orange warning below last cluster table",    "Larger polygon or different technology"),
    ("API timeout (>10 min)",     "Error toast, loading cleared",                "Retry via New Analysis button"),
    ("No drains in buffer",       "Empty drain dropdown",                        "Expand surface radius or redraw"),
    ("Zero categories (DSS)",     "Analyze button disabled",                     "Select at least one condition layer"),
    ("File format error",         "Toast notification with error message",       "Re-upload valid shapefile/KML"),
]
et = Table(err_hdr + [[CP(a,"cell"),CP(b,"cell"),CP(c,"cell")] for a,b,c in err_rows],
           colWidths=[50*mm, 65*mm, CONTENT_W-115*mm])
et.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),DANGER),
                         ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,HexColor("#fff1f2")])]
                        + BASE_TS.getCommands()))
story += [et, SP(5), H2("13.2  WebSocket / HTTP Polling")]
story.append(kv_table([
    ("Primary",       "WebSocket on /tools/ws/operation/{taskId} -- instant push when task completes."),
    ("Fallback",      "HTTP polling every 2 seconds, max 300 attempts (10 minutes total)."),
    ("Timeout",       "10 minutes hard limit; error shown and UI unblocked."),
    ("Deduplication", "Duplicate requests for same payload share a single in-flight Promise."),
], c1=40*mm))
story += [SP(5), H2("13.3  Map Layer Persistence")]
story.append(P(
    "All OL layers are stored in typed React refs (multiPolygonOutlineLayersRef, "
    "multiVillageLayersRef, multiResultLayersRef, polygonLabelLayerRef). "
    "Visibility toggle effects iterate these refs directly, ensuring correct toggling "
    "even when some entries lack a polygonLayer (e.g. drawn polygons without a GeoServer outline)."
))
story += [SP(8), HR(BORDER),
          P("<i>End of Documentation -- Manual STP Suitability Module | June 2026 | SLCR Deployment Team</i>",
            "caption")]

# ── Render ────────────────────────────────────────────────────────────────────
class CoverDoc(SimpleDocTemplate):
    def handle_pageBegin(self):
        super().handle_pageBegin()
        if self.page == 1:
            on_cover(self.canv, self)
        else:
            on_page(self.canv, self)

doc = CoverDoc(
    OUT,
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=16*mm,
    title="Manual STP Suitability -- Technical Documentation",
    author="SLCR Deployment Team",
)
doc.build(story)
print(f"PDF written to {OUT}")
