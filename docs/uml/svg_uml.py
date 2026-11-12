"""Ve so do UML thanh SVG thuan (khong can PlantUML/Graphviz): so do use case, so do goi (package),
so do phan cap actor va so do hoat dong (activity) co lan boi (swimlane).

Bo cuc dat theo luoi (cot, hang) khai bao trong du lieu; chu tieng Viet do trinh duyet ve khi xuat PNG
(render_svg.mjs). Moi ham tra ve (svg_text, width, height)."""
import html
import math
import re

FONT = "'Segoe UI', Arial, sans-serif"
INK = "#1f2937"
LINE = "#374151"
MUTED = "#6b7280"
UC_FILL, UC_STROKE = "#eef5ff", "#2563eb"
REF_FILL, REF_STROKE = "#f8fafc", "#64748b"
NODE_FILL, NODE_STROKE = "#fffbeb", "#b45309"
ALT_FILL, ALT_STROKE = "#fef2f2", "#b91c1c"
PKG_FILL, PKG_STROKE = "#f8fafc", "#475569"
LANE_HEAD = "#e2e8f0"
CHAR_W = 0.56  # be rong trung binh mot ky tu so voi co chu

DEFS = (
    "<defs>"
    '<marker id="arrow" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
    '<path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker>'
    '<marker id="open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto">'
    '<path d="M1,1 L11,6 L1,11" fill="none" stroke="#374151" stroke-width="1.5"/></marker>'
    '<marker id="tri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="12" markerHeight="12" orient="auto">'
    '<path d="M1,1 L13,7 L1,13 z" fill="#ffffff" stroke="#374151" stroke-width="1.3"/></marker>'
    "</defs>"
)


def esc(s):
    return html.escape(str(s), quote=True)


def _pieces(word, limit):
    """Tu dai hon mot dong (vd ma loi OUT_OF_SERVICE_AREA): tach sau dau _ hoac cat cung."""
    if len(word) <= limit:
        return [word]
    parts = re.findall(r"[^_]*_|[^_]+$", word) if "_" in word else [word]
    out, cur = [], ""
    for p in parts:
        while len(p) > limit:  # mot phan van qua dai -> cat cung
            if cur:
                out.append(cur)
                cur = ""
            out.append(p[:limit])
            p = p[limit:]
        if cur and len(cur) + len(p) > limit:
            out.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        out.append(cur)
    return out


def wrap(text, max_px, size):
    """Ngat dong theo be rong uoc luong (px)."""
    limit = max(4, int(max_px / (size * CHAR_W)))
    lines = []
    for para in str(text).split("\n"):
        cur = ""
        for word in para.split():
            for k, piece in enumerate(_pieces(word, limit)):
                if k == 0 and (not cur or len(cur) + 1 + len(piece) <= limit):
                    cur = f"{cur} {piece}" if cur else piece
                else:
                    lines.append(cur)
                    cur = piece
        lines.append(cur)
    return lines


class Canvas:
    def __init__(self):
        self.items = []

    def add(self, s):
        self.items.append(s)

    def poly(self, pts, dashed=False, marker=None, width=1.3, color=LINE):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        mk = f' marker-end="url(#{marker})"' if marker else ""
        self.add(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dash}{mk}/>')

    def text(self, x, y, s, size=12, anchor="middle", weight=400, italic=False, color=INK):
        st = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" '
                 f'text-anchor="{anchor}" fill="{color}"{st}>{esc(s)}</text>')

    def block(self, x, y_center, lines, size=12, lh=None, **kw):
        lh = lh or size * 1.25
        y0 = y_center - (len(lines) - 1) * lh / 2 + size * 0.35
        for i, ln in enumerate(lines):
            self.text(x, y0 + i * lh, ln, size=size, **kw)

    def tag(self, x, y, s, size=11):
        """Nhan tren duong noi, co nen trang de doc ro."""
        w = len(s) * size * CHAR_W + 10
        self.add(f'<rect x="{x - w / 2:.1f}" y="{y - size * 0.85:.1f}" width="{w:.1f}" height="{size * 1.35:.1f}" '
                 f'fill="#ffffff" opacity="0.95"/>')
        self.text(x, y + size * 0.2, s, size=size, italic=True, color=LINE)

    def svg(self, w, h):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" '
                f'viewBox="0 0 {w:.0f} {h:.0f}" font-family="{FONT}">{DEFS}'
                f'<rect width="100%" height="100%" fill="#ffffff"/>' + "".join(self.items) + "</svg>")


# ---------------------------------------------------------------- actor, use case

def actor_label_bottom(y, name, stereo=None, width=130):
    """Day cua ten actor (de duong noi di xuong bat dau tu duoi ten, khong cat qua chu)."""
    lines = wrap(name, width, 12)
    return y + 36 + (14 if stereo else 0) + (len(lines) - 1) * 15 + 6


def actor_start(ax, ay, side, name, stereo, target_y):
    """Diem bat dau duong noi tu actor: tu tay neu muc tieu o tren/ngang, tu duoi ten neu o duoi."""
    sign = 1 if side == "L" else -1
    if target_y > ay + 40:
        return ax + 14 * sign, actor_label_bottom(ay, name, stereo) + 2
    return ax + 18 * sign, ay - 6


def draw_actor(c, x, y, name, stereo=None, width=130):
    """Hinh nguoi que; y la tam than. Tra ve diem neo de noi duong."""
    c.add(f'<circle cx="{x:.1f}" cy="{y - 30:.1f}" r="9" fill="#ffffff" stroke="{LINE}" stroke-width="1.6"/>')
    c.poly([(x, y - 21), (x, y + 3)], width=1.6)
    c.poly([(x - 15, y - 13), (x + 15, y - 13)], width=1.6)
    c.poly([(x, y + 3), (x - 12, y + 21)], width=1.6)
    c.poly([(x, y + 3), (x + 12, y + 21)], width=1.6)
    lines = wrap(name, width, 12)
    top = y + 36
    if stereo:
        c.text(x, top, f"«{stereo}»", size=10.5, italic=True, color=MUTED)
        top += 14
    for i, ln in enumerate(lines):
        c.text(x, top + i * 15, ln, size=12, weight=600)
    return {"x": x, "y": y, "top": y - 40, "bottom": top + (len(lines) - 1) * 15 + 6}


def ellipse_point(e, tx, ty):
    cx, cy, rx, ry = e
    dx, dy = tx - cx, ty - cy
    if abs(dx) < 1e-6 and abs(dy) < 1e-6:
        return cx, cy
    t = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    return cx + dx * t, cy + dy * t


def draw_usecase(c, cx, cy, name, code=None, rx=108, ref=None):
    label = f"{code} {name}" if code else name
    lines = wrap(label, rx * 1.55, 12)
    ry = max(22, 11 + 8 * len(lines))
    fill, stroke = (REF_FILL, REF_STROKE) if ref else (UC_FILL, UC_STROKE)
    dash = ' stroke-dasharray="5 3"' if ref else ""
    c.add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" '
          f'stroke-width="1.4"{dash}/>')
    c.block(cx, cy - (5 if ref else 0), lines, size=12)
    if ref:
        c.text(cx, cy + ry - 5, f"(gói {ref})", size=9.5, italic=True, color=MUTED)
    return (cx, cy, rx, ry)


def usecase_diagram(boundary, actors, ucs, links, colw=250, rowh=80):
    """actors: [{id, name, side 'L'|'R', row, stereo?}]; ucs: [{id, code, name, col, row, ref?}];
    links: [(kind, a, b)] kind = assoc | include | extend | gen."""
    c = Canvas()
    has_l = any(a["side"] == "L" for a in actors)
    has_r = any(a["side"] == "R" for a in actors)
    aw = 160
    ncols = max(u["col"] for u in ucs) + 1
    max_row = max([u["row"] for u in ucs] + [a["row"] for a in actors])
    bx0 = aw if has_l else 24
    bw = ncols * colw + 20
    by0, head = 16, 34
    bh = head + (max_row + 1) * rowh + 8
    w = bx0 + bw + (aw if has_r else 24)
    h = by0 + bh + 18

    def row_y(r):
        return by0 + head + rowh * (r + 0.5)

    c.add(f'<rect x="{bx0}" y="{by0}" width="{bw}" height="{bh}" rx="8" fill="#ffffff" stroke="#94a3b8" '
          f'stroke-width="1.4"/>')
    c.text(bx0 + 12, by0 + 22, boundary, size=13, anchor="start", weight=700, color="#334155")

    pos = {}
    for u in ucs:
        pos[u["id"]] = ("uc", bx0 + 10 + colw * (u["col"] + 0.5), row_y(u["row"]))
    for a in actors:
        x = aw / 2 if a["side"] == "L" else bx0 + bw + aw / 2
        pos[a["id"]] = ("actor", x, row_y(a["row"]))

    # duong lien ket actor - use case ve truoc de hinh ve sau de len dau mut
    ell = {}
    tmp = Canvas()
    for u in ucs:
        _, x, y = pos[u["id"]]
        ell[u["id"]] = draw_usecase(tmp, x, y, u["name"], u.get("code"), rx=colw / 2 - 16, ref=u.get("ref"))
    for kind, a, b in links:
        if kind != "assoc":
            continue
        _, ax, ay = pos[a]
        act = next(x for x in actors if x["id"] == a)
        cx, cy, rx, _ry = ell[b]
        # noi vao dinh trai/phai cua elip: doan thang chi nam trong khoang trong giua actor va cot use case
        ex = cx - rx if act["side"] == "L" else cx + rx
        sx, sy = actor_start(ax, ay, act["side"], act["name"], act.get("stereo"), cy)
        c.poly([(sx, sy), (ex, cy)], width=1.3)
    c.items.extend(tmp.items)
    figs = {}
    for a in actors:
        _, x, y = pos[a["id"]]
        figs[a["id"]] = draw_actor(c, x, y, a["name"], a.get("stereo"))
    for kind, a, b in links:
        if kind in ("include", "extend"):
            ea, eb = ell[a], ell[b]
            p1 = ellipse_point(ea, eb[0], eb[1])
            p2 = ellipse_point(eb, ea[0], ea[1])
            c.poly([p1, p2], dashed=True, marker="open")
            c.tag((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, f"«{kind}»")
        elif kind == "gen":
            if a in figs:  # actor -> actor
                fa, fb = figs[a], figs[b]
                p1 = (fa["x"], fa["top"]) if fa["y"] > fb["y"] else (fa["x"], fa["bottom"])
                p2 = (fb["x"], fb["bottom"]) if fa["y"] > fb["y"] else (fb["x"], fb["top"])
            else:
                ea, eb = ell[a], ell[b]
                p1 = ellipse_point(ea, eb[0], eb[1])
                p2 = ellipse_point(eb, ea[0], ea[1])
            c.poly([p1, p2], marker="tri")
    return c.svg(w, h), w, h


# ---------------------------------------------------------------- package, phan cap actor

def package_diagram(title, packages, actors, links, colw=320):
    """packages: [{id, name, col, row, items}]; actors: [{id, name, side, y(0..1)}]; links: [(actor, pkg)]."""
    c = Canvas()
    aw = 150
    ncols = max(p["col"] for p in packages) + 1
    nrows = max(p["row"] for p in packages) + 1
    pw = colw - 40
    heights = {}
    for p in packages:
        heights[p["id"]] = 44 + 16 * len(p["items"])
    row_h = [max([heights[p["id"]] for p in packages if p["row"] == r] or [0]) for r in range(nrows)]
    bx0, by0, head = aw, 16, 36
    bw = ncols * colw + 10
    bh = head + sum(row_h) + 26 * nrows + 6
    w, h = bx0 + bw + aw, by0 + bh + 16
    c.add(f'<rect x="{bx0}" y="{by0}" width="{bw}" height="{bh}" rx="8" fill="#ffffff" stroke="#94a3b8" '
          f'stroke-width="1.4"/>')
    c.text(bx0 + 12, by0 + 23, title, size=13, anchor="start", weight=700, color="#334155")
    box = {}
    for p in packages:
        x = bx0 + 20 + colw * p["col"]
        y = by0 + head + sum(row_h[: p["row"]]) + 26 * p["row"] + 10
        ph = heights[p["id"]]
        box[p["id"]] = (x, y + 16, pw, ph - 16)
    for a, pid in links:
        act = next(x for x in actors if x["id"] == a)
        ax = aw / 2 if act["side"] == "L" else bx0 + bw + aw / 2
        ay = by0 + head + act["y"] * (bh - head)
        # noi vao canh ben huong ve actor de duong chi nam trong khoang trong giua actor va cot goi
        px, py, pwid, phgt = box[pid]
        ex = px if act["side"] == "L" else px + pwid
        ey = min(max(ay - 6, py + 10), py + phgt - 10)
        sx, sy = actor_start(ax, ay, act["side"], act["name"], act.get("stereo"), ey)
        if sy > ay:  # di xuong tu duoi ten: dich diem cuoi xuong theo
            ey = min(max(sy, py + 10), py + phgt - 10)
        c.poly([(sx, sy), (ex, ey)], width=1.2, color="#64748b")
    for p in packages:
        x, y, bwid, bhgt = box[p["id"]]
        c.add(f'<rect x="{x}" y="{y - 16}" width="120" height="16" fill="{PKG_FILL}" stroke="{PKG_STROKE}" '
              f'stroke-width="1.3"/>')
        c.add(f'<rect x="{x}" y="{y}" width="{bwid}" height="{bhgt}" fill="{PKG_FILL}" stroke="{PKG_STROKE}" '
              f'stroke-width="1.3"/>')
        c.text(x + 10, y + 19, p["name"], size=12.5, anchor="start", weight=700)
        for i, it in enumerate(p["items"]):
            c.text(x + 14, y + 38 + 16 * i, it, size=11, anchor="start", color="#334155")
    for a in actors:
        ax = aw / 2 if a["side"] == "L" else bx0 + bw + aw / 2
        ay = by0 + head + a["y"] * (bh - head)
        draw_actor(c, ax, ay, a["name"], a.get("stereo"))
    return c.svg(w, h), w, h


def actor_tree(actors, gens, w, h, notes=()):
    """actors: [{id, name, x, y, stereo?}] toa do tuyet doi; gens: [(con, cha)]."""
    c = Canvas()
    figs = {}
    for a in actors:
        figs[a["id"]] = draw_actor(c, a["x"], a["y"], a["name"], a.get("stereo"), width=150)
    for child, parent in gens:
        fa, fb = figs[child], figs[parent]
        c.poly([(fa["x"], fa["top"]), (fb["x"], fb["bottom"])], marker="tri")
    for x, y, s, opts in notes:
        c.text(x, y, s, **opts)
    return c.svg(w, h), w, h


# ---------------------------------------------------------------- activity

LW, MAINC, MAINW, ALTC, ALTW = 310, 90, 160, 243, 128
GAP, HEAD = 22, 36


def activity_diagram(lanes, main, alts):
    """lanes: [ten lan]; main: [(lan, viec)]; alts: [{after, guard, steps: [(lan, viec)], then: 'end'|so buoc,
    lane (lan dat nut quyet dinh), else_guard}]."""
    c = Canvas()
    lane_x = {name: 14 + LW * i for i, name in enumerate(lanes)}
    rows = []

    def add(kind, lane, **kw):
        rows.append(dict(kind=kind, lane=lane, **kw))

    add("start", main[0][0])
    for i, (lane, text) in enumerate(main, 1):
        add("step", lane, text=text, idx=i)
        for a in [a for a in alts if a["after"] == i]:
            add("dec", a.get("lane", "Hệ thống"), alt=a)
            for lane2, text2 in a["steps"]:
                add("alt", lane2, text=text2, alt=a)
            if a["then"] == "end":
                add("altend", a["steps"][-1][0] if a["steps"] else a.get("lane", "Hệ thống"), alt=a)
    add("final", main[-1][0])

    y = HEAD + 16
    for r in rows:
        lx = lane_x[r["lane"]]
        if r["kind"] in ("start", "final"):
            r.update(cx=lx + MAINC, top=y, h=24)
        elif r["kind"] == "step":
            r["lines"] = wrap(r["text"], MAINW - 16, 12.5)
            r.update(cx=lx + MAINC, top=y, h=max(34, 12 + 15.5 * len(r["lines"])))
        elif r["kind"] == "dec":
            r["glines"] = wrap(f"[{r['alt']['guard']}]", 150, 11.5)
            lh = 14 * len(r["glines"])
            r.update(cx=lx + MAINC, top=y, h=lh + 19, cy=y + lh + 6)
        elif r["kind"] == "alt":
            r["lines"] = wrap(r["text"], ALTW - 12, 12)
            r.update(cx=lx + ALTC, top=y, h=max(32, 11 + 15 * len(r["lines"])))
        elif r["kind"] == "altend":
            r.update(cx=lx + ALTC, top=y, h=24)
        r["bottom"] = r["top"] + r["h"]
        r.setdefault("cy", r["top"] + r["h"] / 2)
        y = r["bottom"] + GAP
    loops = [a for a in alts if a["then"] != "end"]
    right = 14 + LW * len(lanes)
    w = right + (16 + 14 * len(loops) if loops else 14)
    h = y + 4

    # lan boi
    for name, lx in lane_x.items():
        c.add(f'<rect x="{lx}" y="10" width="{LW}" height="{HEAD}" fill="{LANE_HEAD}" stroke="#94a3b8"/>')
        c.text(lx + LW / 2, 10 + HEAD / 2 + 4.5, name, size=14, weight=700, color="#1e293b")
        c.add(f'<rect x="{lx}" y="{10 + HEAD}" width="{LW}" height="{h - 14 - HEAD}" fill="none" stroke="#94a3b8"/>')

    def top_pt(r):
        return (r["cx"], r["cy"] - 13) if r["kind"] == "dec" else (r["cx"], r["top"])

    def bottom_pt(r):
        return (r["cx"], r["cy"] + 13) if r["kind"] == "dec" else (r["cx"], r["bottom"])

    def connect(a, b, label=None):
        (ax, ay), (bx, by) = bottom_pt(a), top_pt(b)
        if abs(ax - bx) < 0.5:
            pts = [(ax, ay), (bx, by)]
        else:
            ymid = by - GAP / 2
            pts = [(ax, ay), (ax, ymid), (bx, ymid), (bx, by)]
        c.poly(pts, marker="arrow")
        if label:
            c.text(ax + 6, ay + 14, label, size=11.5, anchor="start", italic=True, color=LINE)

    main_rows = [r for r in rows if r["kind"] in ("start", "step", "dec", "final")]
    for a, b in zip(main_rows, main_rows[1:]):
        connect(a, b, f"[{a['alt'].get('else_guard', 'ngược lại')}]" if a["kind"] == "dec" else None)

    step_row = {r["idx"]: r for r in rows if r["kind"] == "step"}
    for li, dec in enumerate([r for r in rows if r["kind"] == "dec"]):
        a = dec["alt"]
        chain = [r for r in rows if r.get("alt") is a and r["kind"] in ("alt", "altend")]
        if chain:
            first = chain[0]
            to_right = first["cx"] >= dec["cx"]
            sx = dec["cx"] + (13 if to_right else -13)
            c.poly([(sx, dec["cy"]), (first["cx"], dec["cy"]), (first["cx"], first["top"])], marker="arrow")
            gx = dec["cx"] + (18 if to_right else -18)
            for i, ln in enumerate(dec["glines"]):
                c.text(gx, dec["cy"] - 5 - 14 * (len(dec["glines"]) - 1 - i), ln, size=11.5,
                       anchor="start" if to_right else "end", italic=True, color=ALT_STROKE)
            for p, q in zip(chain, chain[1:]):
                connect(p, q)
        src = chain[-1] if chain and chain[-1]["kind"] == "alt" else (None if chain else dec)
        if a["then"] != "end" and src is not None:
            tgt = step_row[a["then"]]
            xl = right + 12 + 14 * loops.index(a)
            sx = src["cx"] + (13 if src["kind"] == "dec" else ALTW / 2)
            tx = tgt["cx"] + MAINW / 2
            c.poly([(sx, src["cy"]), (xl, src["cy"]), (xl, tgt["cy"]), (tx, tgt["cy"])], marker="arrow")
            if src["kind"] == "dec":
                for i, ln in enumerate(dec["glines"]):
                    c.text(dec["cx"] + 18, dec["cy"] - 5 - 14 * (len(dec["glines"]) - 1 - i), ln, size=11.5,
                           anchor="start", italic=True, color=ALT_STROKE)

    for r in rows:
        k = r["kind"]
        if k == "start":
            c.add(f'<circle cx="{r["cx"]}" cy="{r["cy"]}" r="10" fill="#111827"/>')
        elif k in ("final", "altend"):
            c.add(f'<circle cx="{r["cx"]}" cy="{r["cy"]}" r="11" fill="#ffffff" stroke="#111827" stroke-width="1.6"/>')
            c.add(f'<circle cx="{r["cx"]}" cy="{r["cy"]}" r="6.5" fill="#111827"/>')
        elif k == "step":
            c.add(f'<rect x="{r["cx"] - MAINW / 2}" y="{r["top"]}" width="{MAINW}" height="{r["h"]}" rx="11" '
                  f'fill="{NODE_FILL}" stroke="{NODE_STROKE}" stroke-width="1.3"/>')
            c.block(r["cx"], r["cy"], r["lines"], size=12.5, lh=15.5)
        elif k == "alt":
            c.add(f'<rect x="{r["cx"] - ALTW / 2}" y="{r["top"]}" width="{ALTW}" height="{r["h"]}" rx="11" '
                  f'fill="{ALT_FILL}" stroke="{ALT_STROKE}" stroke-width="1.2"/>')
            c.block(r["cx"], r["cy"], r["lines"], size=12, lh=15)
        elif k == "dec":
            x0, y0 = r["cx"], r["cy"]
            c.add(f'<polygon points="{x0},{y0 - 13} {x0 + 13},{y0} {x0},{y0 + 13} {x0 - 13},{y0}" '
                  f'fill="#ffffff" stroke="{LINE}" stroke-width="1.4"/>')
    return c.svg(w, h), w, h
