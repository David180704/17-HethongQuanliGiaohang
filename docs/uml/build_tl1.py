"""Sinh tai lieu UML phan 1 (TL1): so do SVG trong docs/uml/hinh/ va file docs/TaiLieuUML_Phan1.docx.

    python docs/uml/build_tl1.py

Can: python-docx; Node + Playwright cua code/apps/web (npm install trong code/apps/web) de chup SVG thanh PNG."""
import os
import subprocess
import sys
import tempfile

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import svg_uml as S  # noqa: E402
import tl1_data as D  # noqa: E402

DOCS = os.path.dirname(HERE)
OUT_DOCX = os.path.join(DOCS, "TaiLieuUML_Phan1.docx")
SVG_DIR = os.path.join(HERE, "hinh")
PKG_NAME = dict(D.PACKAGES)


# ---------------------------------------------------------------- so do
def build_figures():
    figs = {}  # ten -> (svg, w, h, caption)
    actors = [
        dict(id="kvl", name=D.KVL, x=210, y=110), dict(id="nd", name="Người dùng có tài khoản", x=660, y=110),
        dict(id="nn", name="Người nhận hàng", x=80, y=310), dict(id="kh", name="Khách hàng (cá nhân / shop)", x=320,
                                                                   y=310),
        dict(id="nvk", name=D.NVK, x=520, y=310), dict(id="ngn", name=D.NGN, x=700, y=310),
        dict(id="qt", name=D.QT, x=880, y=310),
        dict(id="gps", name="Thiết bị định vị GPS", x=260, y=520, stereo="thiết bị"),
        dict(id="bank", name="Ngân hàng (VietQR)", x=500, y=520, stereo="hệ thống"),
        dict(id="web", name="Website bán hàng của shop", x=740, y=520, stereo="hệ thống ngoài"),
    ]
    gens = [("nn", "kvl"), ("kh", "kvl"), ("kh", "nd"), ("nvk", "nd"), ("ngn", "nd"), ("qt", "nd")]
    notes = [(20, 30, "Actor chính và quan hệ tổng quát hóa", dict(size=13, anchor="start", weight=700,
                                                                   color="#334155")),
             (20, 440, "Actor phụ (hệ thống, thiết bị bên ngoài)", dict(size=13, anchor="start", weight=700,
                                                                       color="#334155"))]
    svg, w, h = S.actor_tree(actors, gens, 980, 600, notes)
    figs["actor"] = (svg, w, h, "Phân cấp actor của hệ thống EDMS")

    o = D.OVERVIEW
    svg, w, h = S.package_diagram("Hệ thống quản lý giao hàng EDMS", o["packages"], o["actors"], o["links"])
    figs["goi-tong-quan"] = (svg, w, h, "Sơ đồ use case tổng quan theo gói chức năng")

    for pid, spec in D.DIAGRAMS.items():
        svg, w, h = S.usecase_diagram(f"{pid}. {PKG_NAME[pid]}", spec["actors"], spec["ucs"], spec["links"])
        figs[f"usecase-{pid}"] = (svg, w, h, f"Sơ đồ use case gói {pid} — {PKG_NAME[pid]}")

    for u in D.USECASES:
        svg, w, h = S.activity_diagram(u["lanes"], u["main"], u["alts"])
        figs[f"activity-{u['code']}"] = (svg, w, h, f"Sơ đồ activity — {u['code']} {u['name']}")
    return figs


def render_png(figs):
    os.makedirs(SVG_DIR, exist_ok=True)
    for name, (svg, *_rest) in figs.items():
        with open(os.path.join(SVG_DIR, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
    tmp = tempfile.mkdtemp(prefix="edms-uml-")
    page = os.path.join(tmp, "figs.html")
    body = "".join(f'<div class="fig" data-name="{n}" style="display:inline-block;margin:4px">{v[0]}</div><br>'
                   for n, v in figs.items())
    with open(page, "w", encoding="utf-8") as f:
        f.write(f'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">{body}</body></html>')
    png_dir = os.path.join(tmp, "png")
    subprocess.run(["node", os.path.join(HERE, "render_svg.mjs"), page, png_dir], check=True)
    return png_dir


# ---------------------------------------------------------------- docx
def set_cell_shading(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def set_font(style, name="Calibri", size=None, bold=None, color=None):
    style.font.name = name
    rpr = style.element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        fonts.set(qn(attr), name)
    if size:
        style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if color:
        style.font.color.rgb = RGBColor.from_string(color)


class Builder:
    def __init__(self, png_dir, figs):
        self.png_dir, self.figs = png_dir, figs
        self.doc = Document()
        self.fig_no = 0
        sec = self.doc.sections[0]
        sec.page_width, sec.page_height = Cm(21), Cm(29.7)
        sec.left_margin = sec.right_margin = Cm(2)
        sec.top_margin = sec.bottom_margin = Cm(1.8)
        st = self.doc.styles
        set_font(st["Normal"], size=11)
        st["Normal"].paragraph_format.space_after = Pt(3)
        set_font(st["Title"], size=20, bold=True, color="1F3864")
        set_font(st["Heading 1"], size=16, bold=True, color="2E74B5")
        set_font(st["Heading 2"], size=13.5, bold=True, color="2E74B5")
        set_font(st["Heading 3"], size=12, bold=True, color="1F3864")
        set_font(st["Table Grid"], size=10)

    def p(self, text="", bold=False, italic=False, align=None, size=None, style=None, indent=None):
        par = self.doc.add_paragraph(style=style)
        if text:
            run = par.add_run(text)
            run.bold, run.italic = bold, italic
            if size:
                run.font.size = Pt(size)
        if align:
            par.alignment = align
        if indent is not None:
            par.paragraph_format.left_indent = Cm(indent)
            par.paragraph_format.first_line_indent = Cm(-0.6)
        return par

    def lp(self, label, body, indent=None):
        par = self.doc.add_paragraph()
        par.add_run(label).bold = True
        par.add_run(body)
        if indent is not None:
            par.paragraph_format.left_indent = Cm(indent)
        return par

    def bullet(self, text, label=None):
        par = self.doc.add_paragraph(style="List Bullet")
        if label:
            par.add_run(label).bold = True
        par.add_run(text)
        return par

    def table(self, rows, widths, header=True, label_col=False, size=10):
        t = self.doc.add_table(rows=len(rows), cols=len(widths))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for r, values in enumerate(rows):
            for c, value in enumerate(values):
                cell = t.cell(r, c)
                cell.width = Cm(widths[c])
                par = cell.paragraphs[0]
                run = par.add_run(str(value))
                run.font.size = Pt(size)
                if (header and r == 0) or (label_col and c == 0):
                    run.bold = True
                    set_cell_shading(cell, "DEEAF6" if header and r == 0 else "F2F2F2")
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    def figure(self, name, max_w=16.5, max_h=22.5, scale=None):
        _svg, w, h, caption = self.figs[name]
        # mac dinh: gian het be ngang trang nhung khong phong to qua 0,025 cm moi px (chu ~9pt)
        width = min(max_w, w * (scale or 0.025))
        prev = self.doc.paragraphs[-1] if self.doc.paragraphs else None
        if prev is not None:  # giu doan dan (va tieu de) di cung hinh, tranh tieu de tro troi cuoi trang
            prev.paragraph_format.keep_with_next = True
        height = width * h / w
        if height > max_h:
            width = max_h * w / h
        par = self.doc.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
        par.paragraph_format.keep_with_next = True
        par.add_run().add_picture(os.path.join(self.png_dir, f"{name}.png"), width=Cm(width))
        self.fig_no += 1
        self.p(f"Hình {self.fig_no}. {caption}", italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=10)

    def save(self):
        self.doc.save(OUT_DOCX)


def relation_notes(code):
    notes = []
    inc = [b for k, a, b, _ in D.RELATIONS if k == "include" and a == code]
    inc_by = [a for k, a, b, _ in D.RELATIONS if k == "include" and b == code]
    ext = [b for k, a, b, _ in D.RELATIONS if k == "extend" and a == code]
    ext_by = [a for k, a, b, _ in D.RELATIONS if k == "extend" and b == code]
    if inc:
        notes.append("include " + ", ".join(inc))
    if inc_by:
        notes.append("được include bởi " + ", ".join(inc_by))
    if ext:
        notes.append("extend " + ", ".join(ext))
    if ext_by:
        notes.append("được mở rộng (extend) bởi " + ", ".join(ext_by))
    return "; ".join(notes) or "—"


def alt_lines(u):
    counter = {}
    out = []
    for a in u["alts"]:
        n = counter.get(a["after"], 0)
        counter[a["after"]] = n + 1
        label = f"{a['after']}{'abcdefgh'[n]}"
        steps = "; ".join(f"{lane}: {text[0].lower() + text[1:]}" for lane, text in a["steps"])
        end = f"quay lại bước {a['then']}" if a["then"] != "end" else "kết thúc use case"
        out.append((label, f"Nếu {a['guard']}: " + (f"{steps} → {end}." if steps else f"{end}.")))
    return out


def build_docx(png_dir, figs):
    b = Builder(png_dir, figs)
    b.p("TÀI LIỆU PHÂN TÍCH THIẾT KẾ UML — PHẦN 1", style="Title", align=WD_ALIGN_PARAGRAPH.CENTER)
    b.p("Actor, sơ đồ use case, đặc tả use case và sơ đồ hoạt động (activity)", italic=True,
        align=WD_ALIGN_PARAGRAPH.CENTER, size=13)
    b.p("Hệ thống quản lý giao hàng EDMS — đáp ứng Case study 02 và Case study 14", bold=True,
        align=WD_ALIGN_PARAGRAPH.CENTER, size=12)
    b.table([
        ("Tài liệu", "TL1 — Sprint 4 (Product Backlog: tài liệu UML theo yêu cầu đề 14, mục 1.2)"),
        ("Phiên bản", f"{D.VERSION} — tạo {D.CREATED}, cập nhật {D.UPDATED}"),
        ("Người thực hiện", "DEV 1 — Đỗ Kim Thành"),
        ("Nguồn", "Product Backlog và Sprint Backlog (ProductBacklog-nhom17.xlsx), ma trận đối chiếu hai đề "
                  "(DoiChieuCaseStudy_MoRong.md), mã nguồn Sprint 1–3, ERD (ERD.md)"),
        ("Phần 2 (TL2, Sprint 5)", "Sơ đồ lớp, sơ đồ tuần tự các luồng chính, sơ đồ trạng thái đơn hàng"),
    ], [4.2, 12.6], header=False, label_col=True)

    b.p("1. Giới thiệu", style="Heading 1")
    b.lp("Mục đích: ", "mô tả các tác nhân (actor) và chức năng (use case) của EDMS theo yêu cầu phần lý thuyết "
         "của đề 14: xác định actor chính và phụ, xác định use case, vẽ sơ đồ use case, đặc tả từng use case kèm sơ "
         "đồ activity, tổ chức use case bằng include, extend, tổng quát hóa và gói (package).")
    b.lp("Phạm vi: ", "toàn bộ chức năng mà hai đề yêu cầu (40 use case, 7 gói). Use case đã làm ở Sprint 1–3 được "
         "đặc tả đúng theo hệ thống đang chạy; use case của Sprint 4–7 đặc tả theo thiết kế đã chốt ở các ngày "
         "phân tích và được cập nhật phiên bản khi làm xong (cột Trạng thái ở mục 3).")
    b.lp("Ký hiệu sơ đồ use case: ", "hình người là actor; hình elip là use case; elip nét đứt là use case thuộc "
         "gói khác được vẽ lại để thấy quan hệ; mũi tên nét đứt «include» là luôn gọi use case đích, «extend» là "
         "use case nguồn chỉ chạy khi thỏa điều kiện; mũi tên tam giác rỗng là tổng quát hóa.")
    b.lp("Ký hiệu sơ đồ activity: ", "mỗi cột (làn) là một bên tham gia; chấm đen là bắt đầu, vòng tròn có chấm là "
         "kết thúc; ô vàng là bước của luồng chính, ô đỏ nhạt là luồng thay thế hoặc lỗi; hình thoi là rẽ nhánh, chữ "
         "trong ngoặc vuông là điều kiện; mũi tên vòng bên phải là quay lại một bước của luồng chính.")
    b.lp("Cách sinh: ", "sơ đồ được sinh bằng script trong docs/uml (python docs/uml/build_tl1.py); sơ đồ activity "
         "sinh trực tiếp từ luồng sự kiện của đặc tả nên hai phần luôn khớp nhau. Bản SVG của mọi sơ đồ nằm ở "
         "docs/uml/hinh.")

    b.p("2. Actor", style="Heading 1")
    b.p("2.1. Danh sách actor", style="Heading 2")
    b.table([("Actor", "Loại", "Mô tả", "Vai trò trong hệ thống", "Ứng dụng")] + [tuple(a) for a in D.ACTORS],
            [3.3, 2.0, 6.6, 2.6, 2.6], size=9.5)
    b.p("2.2. Quan hệ giữa các actor", style="Heading 2")
    b.p("Khách hàng kế thừa khách vãng lai đúng như cây phân quyền của hệ thống (CUSTOMER kế thừa GUEST). Bốn actor "
        "có tài khoản kế thừa actor trừu tượng Người dùng có tài khoản, nên các use case đăng nhập, đăng xuất chỉ cần "
        "nối với actor cha.")
    b.figure("actor", scale=0.0168)
    b.table([("Actor con", "Actor cha", "Ý nghĩa")] + [tuple(g) for g in D.ACTOR_GENS], [4.0, 4.2, 8.6])

    b.p("3. Danh sách use case", style="Heading 1")
    rows = [("Mã", "Use case", "Actor chính", "Actor phụ", "Gói", "Story", "Đề", "Trạng thái")]
    for u in D.USECASES:
        rows.append((u["code"], u["name"], ", ".join(u["actors"]) or "— (dùng chung)", ", ".join(u["secondary"]) or "—",
                     u["pkg"], ", ".join(u["stories"]), u["de"], u["status"]))
    b.table(rows, [1.2, 3.6, 2.6, 2.4, 0.9, 2.0, 1.1, 2.6], size=8.5)

    b.p("4. Sơ đồ use case", style="Heading 1")
    b.p("4.1. Tổng quan theo gói", style="Heading 2")
    b.p("Bảy gói là bảy khối chức năng cấp cao nhất. Actor phía khách hàng và quản trị bên trái, actor phía vận hành "
        "(kho, giao nhận) bên phải; chi tiết từng gói ở các mục sau.")
    b.figure("goi-tong-quan", scale=0.0175)
    for i, (pid, name) in enumerate(D.PACKAGES, 2):
        b.p(f"4.{i}. Gói {pid} — {name}", style="Heading 2")
        rels = [r for r in D.RELATIONS if D.UC[r[1]]["pkg"] == pid or D.UC[r[2]]["pkg"] == pid]
        if rels:
            b.p("Quan hệ trong gói: " + "; ".join(f"{a} «{k}» {c} ({why.lower()})" for k, a, c, why in rels) + ".")
        b.figure(f"usecase-{pid}", scale=0.0185)

    b.p("5. Tổ chức use case", style="Heading 1")
    b.p("5.1. Quan hệ include và extend", style="Heading 2")
    b.table([("Quan hệ", "Use case nguồn", "Use case đích", "Điều kiện / ý nghĩa")]
            + [(f"«{k}»", f"{a} {D.UC[a]['name']}", f"{c} {D.UC[c]['name']}", why) for k, a, c, why in D.RELATIONS],
            [1.8, 5.0, 5.0, 5.0])
    b.p("Include dùng cho phần lặp lại bắt buộc ở nhiều use case (tính phí ở ba nơi, xác định khách ở quầy, phân công "
        "sau khi duyệt). Extend dùng cho hành vi chỉ xảy ra khi thỏa điều kiện (có thu hộ, gửi nhanh, kho đích, lấy "
        "hoặc giao không thành công).")
    b.p("5.2. Gói chức năng", style="Heading 2")
    rows = [("Gói", "Use case", "Actor chính")]
    for pid, name in D.PACKAGES:
        ucs = [u for u in D.USECASES if u["pkg"] == pid]
        actors = sorted({a for u in ucs for a in u["actors"]})
        rows.append((f"{pid}. {name}", ", ".join(f"{u['code']} {u['name']}" for u in ucs), ", ".join(actors)))
    b.table(rows, [3.6, 9.6, 3.6], size=9.5)

    b.p("6. Đặc tả use case và sơ đồ activity", style="Heading 1")
    b.p("Mỗi use case gồm: mô tả tóm tắt (tên, tóm tắt hoạt động, actor, ngày tạo và cập nhật, phiên bản), luồng sự "
        "kiện chính, luồng thay thế và lỗi, điều kiện tiên quyết, hậu điều kiện, yêu cầu giao diện (nếu có) và sơ đồ "
        "activity biểu diễn chính đặc tả đó.")
    for pid, name in D.PACKAGES:
        b.p(f"Gói {pid} — {name}", style="Heading 2")
        for u in [x for x in D.USECASES if x["pkg"] == pid]:
            b.p(f"{u['code']} — {u['name']}", style="Heading 3")
            b.table([
                ("Tên use case", f"{u['code']} {u['name']}"),
                ("Tóm tắt", u["summary"]),
                ("Actor chính", ", ".join(u["actors"]) or "— (use case dùng chung, không có actor trực tiếp)"),
                ("Actor phụ", ", ".join(u["secondary"]) or "—"),
                ("Quan hệ", relation_notes(u["code"])),
                ("Story / đề", f"{', '.join(u['stories'])} · đề {u['de']} · {u['status']}"),
                ("Ngày tạo / cập nhật / phiên bản", f"{D.CREATED} / {D.UPDATED} / {D.VERSION}"),
                ("Điều kiện tiên quyết", u["pre"]),
                ("Hậu điều kiện", u["post"]),
            ], [4.4, 12.4], header=False, label_col=True)
            b.p("Luồng sự kiện chính", bold=True)
            for i, (lane, text) in enumerate(u["main"], 1):
                b.p(f"{i}. {lane}: {text[0].lower() + text[1:]}.", indent=0.9)
            alts = alt_lines(u)
            if alts:
                b.p("Luồng thay thế và lỗi", bold=True)
                for label, text in alts:
                    b.p(f"{label}. {text}", indent=0.9)
            if u.get("ui"):
                b.lp("Yêu cầu giao diện: ", u["ui"])
            b.figure(f"activity-{u['code']}", max_h=21)
    b.save()


def main():
    figs = build_figures()
    png_dir = render_png(figs)
    build_docx(png_dir, figs)
    print(f"Da sinh {len(figs)} so do (SVG trong {SVG_DIR}) va {OUT_DOCX}")


if __name__ == "__main__":
    main()
