# Tài liệu UML — mã nguồn sơ đồ

Sơ đồ UML của EDMS được **sinh bằng script** từ dữ liệu đặc tả, không vẽ tay, để tài liệu luôn khớp với
hệ thống: sơ đồ activity sinh trực tiếp từ luồng sự kiện chính và luồng thay thế của từng đặc tả use case.

| File | Nội dung |
|---|---|
| `tl1_data.py` | Actor, 40 use case trong 7 gói, quan hệ include / extend / tổng quát hóa, đặc tả từng use case, bố cục sơ đồ |
| `svg_uml.py` | Bộ vẽ SVG: sơ đồ use case, sơ đồ gói, phân cấp actor, activity có làn (swimlane) |
| `render_svg.mjs` | Chụp SVG thành PNG bằng Playwright (dùng `code/apps/web/node_modules`) |
| `build_tl1.py` | Sinh `hinh/*.svg` và `docs/TaiLieuUML_Phan1.docx` |
| `tl2_data.py` | Phần 2: lớp miền (theo `code/apps/api/src/models`), lớp thiết kế, 5 luồng tuần tự, trạng thái đơn và phân công |
| `svg_uml2.py` | Bộ vẽ SVG phần 2: sơ đồ lớp, sơ đồ tuần tự (khung alt/opt/loop/critical), sơ đồ trạng thái |
| `build_tl2.py` | Sinh sơ đồ phần 2 và `docs/TaiLieuUML_Phan2.docx` (dùng lại Builder của `build_tl1.py`) |
| `hinh/` | Bản SVG của mọi sơ đồ (mở trực tiếp trên GitHub hoặc trình duyệt) |

## Sinh lại

```bash
cd code/apps/web && npm install        # một lần, để có Playwright
cd ../../..
python docs/uml/build_tl1.py           # cần python-docx
python docs/uml/build_tl2.py           # phần 2
```

Sửa nội dung thì sửa `tl1_data.py` (tăng `VERSION`, đổi `UPDATED`), rồi chạy lại lệnh trên.

## Phân phần

- **Phần 1 (TL1, Sprint 4)** — `docs/TaiLieuUML_Phan1.docx`: actor chính và phụ, danh sách use case, sơ đồ
  use case theo gói, tổ chức use case (include, extend, tổng quát hóa, package), đặc tả use case kèm sơ đồ
  activity.
- **Phần 2 (TL2, Sprint 5)** — `docs/TaiLieuUML_Phan2.docx`: sơ đồ lớp miền (danh mục; đơn hàng và vận hành),
  sơ đồ lớp thiết kế, 5 sơ đồ tuần tự (tạo đơn, duyệt và phân công, lấy hàng và nhập kho, check-in, tra cứu),
  sơ đồ trạng thái đơn hàng (18 trạng thái, phần Sprint 6–7 nét đứt) và phân công. ERD ở `docs/ERD.md`.

Không dùng PlantUML/Graphviz: máy dự án không có sẵn, và tải công cụ chạy từ nguồn ngoài cần người dùng cho
phép. Bộ vẽ này chỉ dùng Python và trình duyệt có sẵn trong bộ kiểm thử.
