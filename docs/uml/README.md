# Tài liệu UML — mã nguồn sơ đồ

Sơ đồ UML của EDMS được **sinh bằng script** từ dữ liệu đặc tả, không vẽ tay, để tài liệu luôn khớp với
hệ thống: sơ đồ activity sinh trực tiếp từ luồng sự kiện chính và luồng thay thế của từng đặc tả use case.

| File | Nội dung |
|---|---|
| `tl1_data.py` | Actor, 40 use case trong 7 gói, quan hệ include / extend / tổng quát hóa, đặc tả từng use case, bố cục sơ đồ |
| `svg_uml.py` | Bộ vẽ SVG: sơ đồ use case, sơ đồ gói, phân cấp actor, activity có làn (swimlane) |
| `render_svg.mjs` | Chụp SVG thành PNG bằng Playwright (dùng `code/apps/web/node_modules`) |
| `build_tl1.py` | Sinh `hinh/*.svg` và `docs/TaiLieuUML_Phan1.docx` |
| `hinh/` | Bản SVG của mọi sơ đồ (mở trực tiếp trên GitHub hoặc trình duyệt) |

## Sinh lại

```bash
cd code/apps/web && npm install        # một lần, để có Playwright
cd ../../..
python docs/uml/build_tl1.py           # cần python-docx
```

Sửa nội dung thì sửa `tl1_data.py` (tăng `VERSION`, đổi `UPDATED`), rồi chạy lại lệnh trên.

## Phân phần

- **Phần 1 (TL1, Sprint 4)** — `docs/TaiLieuUML_Phan1.docx`: actor chính và phụ, danh sách use case, sơ đồ
  use case theo gói, tổ chức use case (include, extend, tổng quát hóa, package), đặc tả use case kèm sơ đồ
  activity.
- **Phần 2 (TL2, Sprint 5)**: sơ đồ lớp, sơ đồ tuần tự các luồng chính, sơ đồ trạng thái đơn hàng. ERD ở
  `docs/ERD.md`.

Không dùng PlantUML/Graphviz: máy dự án không có sẵn, và tải công cụ chạy từ nguồn ngoài cần người dùng cho
phép. Bộ vẽ này chỉ dùng Python và trình duyệt có sẵn trong bộ kiểm thử.
