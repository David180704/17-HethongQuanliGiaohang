"""Sinh tai lieu UML phan 2 (TL2): so do lop, tuan tu, trang thai trong docs/uml/hinh/ va docs/TaiLieuUML_Phan2.docx.

    python docs/uml/build_tl2.py

Dung lai Builder va bo chup PNG cua build_tl1.py (python-docx; Node + Playwright cua code/apps/web)."""
import os
import sys

from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_tl1 as B1  # noqa: E402
import svg_uml2 as S2  # noqa: E402
import tl2_data as D  # noqa: E402

OUT_DOCX = os.path.join(B1.DOCS, "TaiLieuUML_Phan2.docx")


def build_figures():
    figs = {}
    for key, spec, caption in (
        ("lop-danh-muc", D.CATALOG, "Sơ đồ lớp miền — danh mục, người dùng và cấu hình"),
        ("lop-don-hang", D.ORDERS, "Sơ đồ lớp miền — đơn hàng, phân công, ca làm việc và check-in"),
        ("lop-thiet-ke", D.DESIGN, "Sơ đồ lớp thiết kế — tầng service, repository và hạ tầng (API)"),
    ):
        svg, w, h = S2.class_diagram(spec["classes"], spec["relations"], spec["w"], spec["h"])
        figs[key] = (svg, w, h, caption)
    for seq in D.SEQUENCES:
        svg, w, h = S2.sequence_diagram(seq["parts"], seq["steps"])
        figs[f"tuan-tu-{seq['id']}"] = (svg, w, h, f"Sơ đồ tuần tự — {seq['title']}")
    o = D.ORDER_STATES
    svg, w, h = S2.state_diagram(o["states"], o["transitions"], o["w"], o["h"], start=o["start"], finals=o["finals"],
                                 legend=o["legend"])
    figs["trang-thai-don"] = (svg, w, h, "Sơ đồ trạng thái đơn hàng (18 trạng thái)")
    a = D.ASSIGNMENT_STATES
    svg, w, h = S2.state_diagram(a["states"], a["transitions"], a["w"], a["h"], start=a["start"], finals=a["finals"])
    figs["trang-thai-phan-cong"] = (svg, w, h, "Sơ đồ trạng thái phân công (Assignment)")
    return figs


def build_docx(png_dir, figs):
    b = B1.Builder(png_dir, figs)
    b.p("TÀI LIỆU PHÂN TÍCH THIẾT KẾ UML — PHẦN 2", style="Title", align=WD_ALIGN_PARAGRAPH.CENTER)
    b.p("Sơ đồ lớp, sơ đồ tuần tự và sơ đồ trạng thái", italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=13)
    b.p("Hệ thống quản lý giao hàng EDMS — đáp ứng Case study 02 và Case study 14", bold=True,
        align=WD_ALIGN_PARAGRAPH.CENTER, size=12)
    b.table([
        ("Tài liệu", "TL2 — Sprint 5 (Product Backlog: tài liệu UML theo yêu cầu đề 14, mục 1.2)"),
        ("Phiên bản", f"{D.VERSION} — tạo {D.CREATED}, cập nhật {D.UPDATED}"),
        ("Người thực hiện", "DEV 1 — Đỗ Kim Thành"),
        ("Nguồn", "Mã nguồn Sprint 1–5 (code/apps/api/src/models, src/modules), ERD (docs/ERD.md), "
                  "TL1 (docs/TaiLieuUML_Phan1.docx: actor, use case, đặc tả, activity)"),
    ], [4.2, 12.6], header=False, label_col=True)

    b.p("1. Giới thiệu", style="Heading 1")
    b.lp("Mục đích: ", "hoàn thành bộ tài liệu UML mà phần lý thuyết đề 14 yêu cầu: sau actor, use case, đặc tả và "
         "activity (TL1) là sơ đồ lớp, sơ đồ tuần tự cho các luồng chính và sơ đồ trạng thái của đơn hàng.")
    b.lp("Phạm vi: ", "lớp miền lấy đúng theo 14 collection của hệ thống (12 collection nghiệp vụ ban đầu và hai "
         "collection check-in của Sprint 5) cùng các đối tượng nhúng; lớp thiết kế lấy theo tầng service, repository, "
         "hạ tầng của API. Sơ đồ tuần tự chọn năm luồng chính đã chạy được; sơ đồ trạng thái vẽ đủ 18 trạng thái, phần "
         "của Sprint 6–7 vẽ nét đứt.")
    b.lp("Ký hiệu: ", "hộp lớp có ba ngăn (tên, thuộc tính, phương thức); đầu nền xanh lá là đối tượng nhúng trong "
         "document cha; «abstract», «decorator», «adapter» là khuôn mẫu thiết kế. Hình thoi đặc là hợp thành "
         "(composition), thoi rỗng là kết tập, tam giác rỗng là kế thừa, nét đứt có mũi tên là phụ thuộc. Trong sơ đồ "
         "tuần tự: mũi tên đặc là lời gọi, nét đứt là kết quả trả về, mũi tên hở là thông điệp bất đồng bộ (hàng đợi); "
         "khung alt / opt / loop / critical là rẽ nhánh, tùy chọn, lặp, transaction.")
    b.lp("Cách sinh: ", "như TL1, mọi sơ đồ sinh bằng script (python docs/uml/build_tl2.py) từ dữ liệu docs/uml/tl2_data.py; "
         "thuộc tính lớp đối chiếu từng file model nên sửa model thì sửa dữ liệu và sinh lại. Bản SVG ở docs/uml/hinh.")

    b.p("2. Sơ đồ lớp", style="Heading 1")
    b.p("2.1. Lớp miền — danh mục và người dùng", style="Heading 2")
    b.p("Người dùng có đúng một vai trò; nhân viên kho làm tại một hub, người giao hàng phụ trách một hoặc nhiều tuyến. "
        "Bưu cục trực thuộc một hub; mỗi tuyến do một hub quản lý, mỗi khu vực phục vụ (quận/huyện) thuộc đúng một "
        "tuyến. Bảng giá gắn với một loại dịch vụ và một vùng. Tài khoản ngân hàng nhận thu hộ là đối tượng nhúng trong "
        "người dùng (US-42). Năng lực mặc định hệ thống nằm ở collection kỹ thuật settings, không vẽ ở đây.")
    b.figure("lop-danh-muc", scale=0.0165)
    b.p("2.2. Lớp miền — đơn hàng và vận hành", style="Heading 2")
    b.p("Đơn hàng là gốc của nhóm: lịch sử trạng thái, phí và thu hộ nhúng trong đơn (đọc một lần là đủ hành trình). "
        "Phân công gắn đơn với người giao hàng và ca làm việc — ca tính năng lực (khóa bằng assignSeq). Mỗi lần người "
        "giao hàng đi qua một điểm check-in khi đang chở đơn, hệ thống ghi một CheckinLog.")
    b.figure("lop-don-hang", scale=0.0155)
    b.p("2.3. Lớp thiết kế", style="Heading 2")
    b.p("Request đi Router → Controller → Service → (Cached)Repository → MongoDB. Chỉ container.js tạo đối tượng và tiêm "
        "phụ thuộc qua constructor; mọi lệnh ghi trong transaction truyền { session } qua MongooseTransactionRunner; "
        "thay đổi trạng thái đơn phát sự kiện lên hàng đợi BullMQ, các consumer (hành trình công khai, phân công tự "
        "động) chạy độc lập và idempotent.")
    b.figure("lop-thiet-ke", scale=0.0145)
    b.table([("Lớp", "File", "Mẫu / ghi chú")] + [tuple(r) for r in D.CODE_MAP], [4.0, 8.2, 4.6], size=9.5)

    b.p("3. Sơ đồ tuần tự", style="Heading 1")
    for i, seq in enumerate(D.SEQUENCES, 1):
        b.p(f"3.{i}. {seq['title']}", style="Heading 2")
        b.lp("Use case: ", seq["uc"])
        b.figure(f"tuan-tu-{seq['id']}", scale=0.0135, max_h=22)

    b.p("4. Sơ đồ trạng thái", style="Heading 1")
    b.p("4.1. Đơn hàng", style="Heading 2")
    b.p("Đơn đi qua 18 trạng thái; khách hàng chỉ thấy 4 nhóm (Chưa nhận, Đã nhận – Chưa giao, Đã nhận – Đang giao, "
        "Đã giao). Mọi chuyển trạng thái là cập nhật có điều kiện theo trạng thái cũ, nên hai người thao tác cùng lúc "
        "thì chỉ một người thành công; mỗi lần chuyển ghi vào lịch sử (ai, lúc nào, ghi chú, tọa độ nếu có) và phát sự "
        "kiện cho hàng đợi.")
    b.figure("trang-thai-don", scale=0.0135)
    b.table([("Từ", "Đến", "Sự kiện", "Ai thực hiện", "Story", "Trạng thái")] + [tuple(r) for r in D.ORDER_TRANSITIONS],
            [2.6, 2.8, 5.0, 2.6, 1.9, 1.9], size=8.5)
    b.p("4.2. Phân công", style="Heading 2")
    b.p("Phân công ASSIGNED tính vào năng lực ca; DONE và FAILED vẫn tính (người đã đi lấy), CANCELLED (bị thay khi kho "
        "điều chỉnh tay) thì trả chỗ trong ca.")
    b.figure("trang-thai-phan-cong", scale=0.0165)
    B1.OUT_DOCX = OUT_DOCX
    b.save()


def main():
    figs = build_figures()
    png_dir = B1.render_png(figs)
    build_docx(png_dir, figs)
    print(f"Da sinh {len(figs)} so do (SVG trong {B1.SVG_DIR}) va {OUT_DOCX}")


if __name__ == "__main__":
    main()
