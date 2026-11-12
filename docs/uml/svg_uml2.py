"""Ve so do UML phan 2 thanh SVG thuan: so do lop (class), so do tuan tu (sequence), so do trang thai (state).
Dung lai Canvas, wrap, esc cua svg_uml. Bo cuc khai bao trong du lieu (tl2_data.py). Moi ham tra ve (svg, w, h)."""
import math

from svg_uml import CHAR_W, INK, LINE, MUTED, Canvas, esc, wrap

CLASS_FILL, CLASS_HEAD, CLASS_STROKE = "#ffffff", "#dbeafe", "#1d4ed8"
EMBED_HEAD = "#ecfdf5"
SVC_HEAD = "#fef3c7"
STATE_FILL, STATE_STROKE = "#eef5ff", "#2563eb"
PLAN_FILL, PLAN_STROKE = "#f8fafc", "#94a3b8"
FRAME = "#7c3aed"

EXTRA_DEFS = (
    '<defs>'
    '<marker id="diamond" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto">'
    '<path d="M1,5 L8,1 L15,5 L8,9 z" fill="#374151"/></marker>'
    '<marker id="odiamond" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="14" markerHeight="9" orient="auto">'
    '<path d="M1,5 L8,1 L15,5 L8,9 z" fill="#ffffff" stroke="#374151" stroke-width="1.2"/></marker>'
    '</defs>'
)


def _svg(c, w, h):
    return c.svg(w, h).replace("</defs>", "</defs>" + EXTRA_DEFS, 1)


# ---------------------------------------------------------------- so do lop

LH = 15  # chieu cao mot dong thuoc tinh


def class_box(c, cls):
    """Ve mot lop; tra ve (x, y, w, h). cls: name, x, y, w, attrs, ops, stereo, kind (entity|embedded|service)."""
    x, y, w = cls["x"], cls["y"], cls.get("w", 210)
    attrs, ops = cls.get("attrs", []), cls.get("ops", [])
    head_h = 28 + (13 if cls.get("stereo") else 0)
    h = head_h + 8 + max(1, len(attrs)) * LH + (8 + len(ops) * LH if ops else 0) + 6
    head = {"embedded": EMBED_HEAD, "service": SVC_HEAD}.get(cls.get("kind"), CLASS_HEAD)
    c.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{CLASS_FILL}" stroke="{CLASS_STROKE}" stroke-width="1.4"/>')
    c.add(f'<rect x="{x}" y="{y}" width="{w}" height="{head_h}" fill="{head}" stroke="{CLASS_STROKE}" stroke-width="1.4"/>')
    ty = y + 18
    if cls.get("stereo"):
        c.text(x + w / 2, y + 13, f"«{cls['stereo']}»", size=10, italic=True, color=MUTED)
        ty += 12
    c.text(x + w / 2, ty, cls["name"], size=13, weight=700)
    yy = y + head_h + 4
    for a in attrs:
        yy += LH
        c.text(x + 7, yy - 3, a, size=10.5, anchor="start")
    if ops:
        yy += 6
        c.add(f'<line x1="{x}" y1="{yy}" x2="{x + w}" y2="{yy}" stroke="{CLASS_STROKE}" stroke-width="1"/>')
        for o in ops:
            yy += LH
            c.text(x + 7, yy - 3, o, size=10.5, anchor="start", color="#7c2d12")
    return x, y, w, h


def _edge_point(box, tx, ty):
    """Giao diem cua doan tu tam hop toi (tx, ty) voi vien hop."""
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else math.inf
    sy = (h / 2) / abs(dy) if dy else math.inf
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def class_diagram(classes, relations, w, h, title=None):
    """relations: dict(a, b, kind assoc|comp|agg|inherit|dep, la, lb, label, via=[(x,y)], a_side/b_side=(fx, fy))."""
    c = Canvas()
    if title:
        c.text(16, 24, title, size=14, anchor="start", weight=700, color="#334155")
    boxes = {}
    # ve quan he truoc (nam duoi hop)
    tmp = Canvas()
    for cls in classes:
        boxes[cls["id"]] = class_box(tmp, cls)
    labels = Canvas()  # ve sau cung, nam tren hop
    for r in relations:
        A, B = boxes[r["a"]], boxes[r["b"]]

        def anchor(box, side, toward):
            if side:
                bx, by, bw, bh = box
                return bx + bw * side[0], by + bh * side[1]
            return _edge_point(box, *toward)

        via = r.get("via", [])
        ca = (A[0] + A[2] / 2, A[1] + A[3] / 2)
        cb = (B[0] + B[2] / 2, B[1] + B[3] / 2)
        pa = anchor(A, r.get("a_side"), via[0] if via else cb)
        pb = anchor(B, r.get("b_side"), via[-1] if via else ca)
        pts = [pa, *via, pb]
        kind = r.get("kind", "assoc")
        dash = ' stroke-dasharray="6 4"' if kind == "dep" else ""
        start = {"comp": ' marker-start="url(#diamond)"', "agg": ' marker-start="url(#odiamond)"'}.get(kind, "")
        end = {"inherit": ' marker-end="url(#tri)"', "dep": ' marker-end="url(#open)"', "nav": ' marker-end="url(#open)"'}.get(kind, "")
        d = " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
        c.add(f'<polyline points="{d}" fill="none" stroke="{LINE}" stroke-width="1.3"{dash}{start}{end}/>')

        def mult(p, q, text):
            # dat cach dau mut 14 px doc theo duong, lech sang mot ben; can theo huong duong di
            length = max(1.0, math.hypot(q[0] - p[0], q[1] - p[1]))
            ux, uy = (q[0] - p[0]) / length, (q[1] - p[1]) / length
            x, y = p[0] + ux * 16, p[1] + uy * 16
            if abs(ux) >= abs(uy):  # duong ngang: chu phia tren
                labels.text(x, y - 5, text, size=10.5, anchor="start" if ux > 0 else "end", color=LINE)
            else:  # duong doc: chu ben phai
                labels.text(x + 6, y + (4 if uy > 0 else 0), text, size=10.5, anchor="start", color=LINE)

        if r.get("la"):
            mult(pts[0], pts[1], r["la"])
        if r.get("lb"):
            mult(pts[-1], pts[-2], r["lb"])
        if r.get("label"):
            mid = len(pts) // 2
            p, q = pts[mid - 1], pts[mid]
            # doan ngang: nhan xuong duoi duong (chu boi so nam phia tren) de khong de len nhau
            below = 14 if abs(q[0] - p[0]) > abs(q[1] - p[1]) else 0
            labels.tag((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + below, r["label"], size=10)
    for cls in classes:
        class_box(c, cls)
    c.items += labels.items
    return _svg(c, w, h), w, h


# ---------------------------------------------------------------- so do tuan tu

def sequence_diagram(participants, steps, colw=165, top=70, step_h=34, title=None):
    """participants: [(id, ten, loai actor|boundary|control|entity|queue)].
    steps: dict(f, t, text, kind call|return|async|self) hoac dict(frame=alt|loop|opt, label, until=so buoc,
    elses=[(so buoc, nhan)]) dat TRUOC buoc dau cua khung; dict(note=..., at=id)."""
    c = Canvas()
    xs = {pid: 30 + colw / 2 + i * colw for i, (pid, *_r) in enumerate(participants)}
    w = 60 + colw * len(participants)
    if title:
        c.text(16, 22, title, size=14, anchor="start", weight=700, color="#334155")
    head_y = top - 30
    for pid, name, kind in participants:
        x = xs[pid]
        if kind == "actor":
            c.add(f'<circle cx="{x}" cy="{head_y - 18}" r="7" fill="#fff" stroke="{INK}" stroke-width="1.4"/>')
            c.poly([(x, head_y - 11), (x, head_y + 1)], color=INK)
            c.poly([(x - 9, head_y - 6), (x + 9, head_y - 6)], color=INK)
            c.poly([(x - 8, head_y + 11), (x, head_y + 1), (x + 8, head_y + 11)], color=INK)
            lines = wrap(name, colw - 14, 11)
            c.block(x, head_y + 22 + (len(lines) - 1) * 6, lines, size=11, weight=600)
        else:
            lines = wrap(name, colw - 18, 11)
            bh = 14 + len(lines) * 13
            fill = {"queue": "#f3e8ff", "entity": "#ecfdf5", "boundary": "#eef5ff"}.get(kind, "#fffbeb")
            c.add(f'<rect x="{x - colw / 2 + 8}" y="{head_y - 22}" width="{colw - 16}" height="{bh}" rx="5" fill="{fill}" '
                  f'stroke="{LINE}" stroke-width="1.2"/>')
            c.block(x, head_y - 22 + bh / 2, lines, size=11, weight=600)
    y = top + 30
    ys = []  # y cua tung buoc (theo chi so trong steps)
    tops = []  # y dinh (truoc chu) cua tung buoc - de dat vach else
    frames = []
    for i, st in enumerate(steps):
        tops.append(y)
        if "frame" in st:
            frames.append((i, st, y))
            y += 18
            ys.append(y)
            continue
        if "note" in st:
            x = xs[st["at"]]
            lines = wrap(st["note"], colw * 1.4, 10.5)
            nh = 10 + len(lines) * 13
            c.add(f'<rect x="{x + 6}" y="{y - 10}" width="{colw * 1.45}" height="{nh}" fill="#fefce8" stroke="#a16207" stroke-width="1"/>')
            for k, ln in enumerate(lines):
                c.text(x + 12, y + 4 + k * 13, ln, size=10.5, anchor="start", color="#713f12")
            ys.append(y)
            y += nh + 8
            continue
        f, t, kind = st["f"], st.get("t", st["f"]), st.get("kind", "call")
        lines = wrap(st["text"], max(colw * abs(list(xs).index(t) - list(xs).index(f)) - 20, colw - 10), 10.5)
        y += (len(lines) - 1) * 12
        if kind == "self":
            x = xs[f]
            c.poly([(x, y - 6), (x + 34, y - 6), (x + 34, y + 10), (x + 4, y + 10)], marker="arrow")
            for k, ln in enumerate(lines):
                c.text(x + 40, y - 8 + k * 12, ln, size=10.5, anchor="start")
            y += 14
        else:
            x1, x2 = xs[f], xs[t]
            dashed = kind == "return"
            marker = "open" if kind in ("return", "async") else "arrow"
            c.poly([(x1, y), (x2 + (-4 if x2 > x1 else 4), y)], dashed=dashed, marker=marker)
            mx = (x1 + x2) / 2
            for k, ln in enumerate(lines):
                c.text(mx, y - 6 - (len(lines) - 1 - k) * 12, ln, size=10.5, color=MUTED if dashed else INK,
                       italic=dashed)
        ys.append(y)
        y += step_h
    bottom = y + 10
    # lifeline ve sau cung duoi cung: chen vao dau danh sach item
    lifelines = [f'<line x1="{xs[pid]}" y1="{top - 2 if kind != "actor" else top + 4}" x2="{xs[pid]}" y2="{bottom}" '
                 f'stroke="#9ca3af" stroke-width="1" stroke-dasharray="5 4"/>' for pid, _n, kind in participants]
    c.items = lifelines + c.items
    for i, st, fy in frames:
        end_i = st["until"]
        y2 = ys[end_i] + 16 if end_i < len(ys) else bottom - 4
        x1, x2 = 12, w - 12
        c.add(f'<rect x="{x1}" y="{fy - 4}" width="{x2 - x1}" height="{y2 - fy + 4}" fill="none" stroke="{FRAME}" stroke-width="1.2"/>')
        label = st["frame"]
        lw = len(label) * 8 + 16
        c.add(f'<path d="M{x1},{fy - 4} h{lw} v12 l-8,8 h-{lw - 8} z" fill="#f5f3ff" stroke="{FRAME}" stroke-width="1.1"/>')
        c.text(x1 + 6, fy + 10, label, size=11, anchor="start", weight=700, color=FRAME)
        c.text(x1 + lw + 8, fy + 10, st.get("label", ""), size=10.5, anchor="start", italic=True, color=FRAME)
        for k, elabel in st.get("elses", []):
            ey = tops[k] - 14
            c.add(f'<line x1="{x1}" y1="{ey}" x2="{x2}" y2="{ey}" stroke="{FRAME}" stroke-width="1" stroke-dasharray="6 4"/>')
            c.text(x1 + 6, ey + 13, elabel, size=10.5, anchor="start", italic=True, color=FRAME)
    h = bottom + 16
    return _svg(c, w, h), w, h


# ---------------------------------------------------------------- so do trang thai

def state_diagram(states, transitions, w, h, start=None, finals=(), title=None, legend=None):
    """states: dict(id, label, x, y, w=150, planned=False, sub=''). transitions: dict(a, b, label, via=[], a_side, b_side).
    start: (x, y, id dich). finals: [(x, y, id nguon)]."""
    c = Canvas()
    if title:
        c.text(16, 24, title, size=14, anchor="start", weight=700, color="#334155")
    boxes = {}
    for s in states:
        sw = s.get("w", 150)
        lines = wrap(s["label"], sw - 14, 11.5)
        sh = 22 + len(lines) * 14 + (13 if s.get("sub") else 0)
        boxes[s["id"]] = (s["x"] - sw / 2, s["y"] - sh / 2, sw, sh)
    labels = Canvas()
    for t in transitions:
        A, B = boxes[t["a"]], boxes[t["b"]]
        via = t.get("via", [])
        ca = (A[0] + A[2] / 2, A[1] + A[3] / 2)
        cb = (B[0] + B[2] / 2, B[1] + B[3] / 2)

        def anchor(box, side, toward):
            if side:
                return box[0] + box[2] * side[0], box[1] + box[3] * side[1]
            return _edge_point(box, *toward)

        pa = anchor(A, t.get("a_side"), via[0] if via else cb)
        pb = anchor(B, t.get("b_side"), via[-1] if via else ca)
        pts = [pa, *via, pb]
        c.poly(pts, marker="arrow", dashed=t.get("planned", False), width=1.25)
        if t.get("label"):
            seg = t.get("label_seg", len(pts) // 2)
            p, q = pts[seg - 1], pts[seg]
            lx, ly = (p[0] + q[0]) / 2 + t.get("dx", 0), (p[1] + q[1]) / 2 + t.get("dy", 0)
            for k, ln in enumerate(t["label"].split("\n")):
                labels.tag(lx, ly + k * 13, ln, size=9.5)
    if start:
        sx, sy, target = start
        c.add(f'<circle cx="{sx}" cy="{sy}" r="8" fill="{INK}"/>')
        bx = boxes[target]
        c.poly([(sx + 8, sy), _edge_point(bx, sx, sy)], marker="arrow")
    for fx, fy, src in finals:
        c.add(f'<circle cx="{fx}" cy="{fy}" r="10" fill="#fff" stroke="{INK}" stroke-width="1.6"/>'
              f'<circle cx="{fx}" cy="{fy}" r="6" fill="{INK}"/>')
        c.poly([_edge_point(boxes[src], fx, fy), _edge_point((fx - 10, fy - 10, 20, 20), *boxes[src][:2])], marker="arrow")
    for s in states:
        x, y, sw, sh = boxes[s["id"]]
        fill, stroke = (PLAN_FILL, PLAN_STROKE) if s.get("planned") else (STATE_FILL, STATE_STROKE)
        dash = ' stroke-dasharray="6 4"' if s.get("planned") else ""
        c.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{sw}" height="{sh}" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{dash}/>')
        lines = wrap(s["label"], sw - 14, 11.5)
        cy = y + 12 + len(lines) * 7
        c.block(x + sw / 2, cy, lines, size=11.5, weight=700)
        c.text(x + sw / 2, y + sh - 8 - (13 if s.get("sub") else 0) + 0, "", size=9)
        if s.get("sub"):
            c.text(x + sw / 2, y + sh - 7, s["sub"], size=9.5, italic=True, color=MUTED)
    c.items += labels.items
    if legend:
        lx, ly = legend
        c.add(f'<rect x="{lx}" y="{ly}" width="26" height="14" rx="6" fill="{STATE_FILL}" stroke="{STATE_STROKE}" stroke-width="1.4"/>')
        c.text(lx + 32, ly + 11, "đã làm (Sprint 1–5)", size=10, anchor="start")
        c.add(f'<rect x="{lx + 170}" y="{ly}" width="26" height="14" rx="6" fill="{PLAN_FILL}" stroke="{PLAN_STROKE}" '
              f'stroke-width="1.4" stroke-dasharray="4 3"/>')
        c.text(lx + 202, ly + 11, "kế hoạch (Sprint 6–7)", size=10, anchor="start")
    return _svg(c, w, h), w, h


__all__ = ["class_diagram", "sequence_diagram", "state_diagram", "esc", "CHAR_W"]
