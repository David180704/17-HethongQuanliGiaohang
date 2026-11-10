// Chay TOAN BO test API mot lan, gom ket qua theo nhan [US-xx] trong ten test,
// roi sinh bao cao docs/KiemThuTheoStory.md.
//   npm run report:stories
// Can: Docker (Mongo + Redis) dang chay va CSDL local da seed (npm run seed:local).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const reportPath = fileURLToPath(new URL("../../../../docs/KiemThuTheoStory.md", import.meta.url));

// Story Sprint 1-7 theo sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx), ke hoach lap lai
// 05/11/2026 sau khi doi chieu Case study 14: them US-40..44, mo rong tieu chi US-20, 25, 28, 31, 32, 35.
// Thu tu trong moi Sprint = thu tu lam theo PERT (docs/PERT_ToanDuAn.docx).
const STORIES = [
  [1, 1, "Khởi tạo dự án, môi trường Docker và quy ước mã nguồn", 3],
  [2, 1, "Thiết kế mô hình dữ liệu và sơ đồ lớp hệ thống", 5],
  [3, 1, "Xây dựng khung xác thực JWT và phân quyền theo vai trò", 5],
  [4, 1, "Chuẩn hóa response, mã lỗi và tài liệu Swagger", 3],
  [5, 2, "Thiết lập CI pipeline tự động kiểm thử và build", 2],
  [6, 2, "Đăng nhập hệ thống", 2],
  [7, 2, "Đăng ký tài khoản khách hàng", 3],
  [8, 2, "Đăng xuất khỏi hệ thống", 1],
  [9, 2, "Phân quyền truy cập theo vai trò", 3],
  [10, 2, "Quản lý tài khoản người dùng trong hệ thống", 3],
  [11, 2, "Quản lý danh mục tuyến và khu vực phục vụ", 3],
  [12, 2, "Quản lý danh mục loại dịch vụ vận chuyển", 2],
  [13, 2, "Quản lý bảng giá vận chuyển theo khu vực và khối lượng", 5],
  [14, 3, "Quản lý danh mục điểm tập kết và bưu cục", 2],
  [15, 3, "Quản lý danh sách địa điểm lấy hàng", 3],
  [16, 3, "Ước tính phí vận chuyển trước khi gửi hàng", 3],
  [17, 3, "Xem phí vận chuyển dự kiến trước khi xác nhận đơn", 5],
  [18, 3, "Tạo đơn hàng giao mới", 5],
  [19, 3, "Khai báo tiền thu hộ COD và hình thức thanh toán phí", 3],
  [20, 4, "Xem danh sách và chi tiết đơn hàng, toàn bộ hành trình", 4],
  [21, 4, "Hàng đợi sự kiện và consumer ghi nhật ký hành trình đơn", 5],
  [22, 4, "Tra cứu hành trình đơn hàng bằng mã vận đơn", 3],
  [40, 4, "Tiếp nhận hàng tại quầy: kiểm hàng, báo giá, tạo đơn hộ khách", 5],
  [23, 4, "Quản lý ca làm việc và phân công nhân viên vào tuyến", 3],
  [24, 4, "Cấu hình năng lực xử lý tối đa của người giao hàng", 3],
  [25, 4, "Phân công đơn lấy hàng cho người giao hàng", 7],
  [26, 4, "Đăng nhập ứng dụng di động", 2],
  [27, 4, "Xem danh sách đơn cần lấy trong ca làm việc", 3],
  [28, 5, "Xác nhận đã lấy hàng hoặc ghi nhận không lấy được", 4],
  [41, 5, "Quy trình tại kho: nhập kho, phân loại, xuất kho và trung chuyển", 6],
  [29, 5, "Quản lý điểm check-in trên bản đồ", 3],
  [30, 5, "Tự động check-in vị trí khi đi qua điểm đã cài đặt", 5],
  [42, 5, "Khai báo tài khoản ngân hàng nhận tiền thu hộ", 2],
  [35, 6, "Phân công tự động đơn giao hàng cho người giao hàng", 6],
  [31, 6, "Xem danh sách đơn cần giao và phiếu giao hàng có mã QR", 6],
  [32, 6, "Xác nhận giao hàng thành công hoặc ghi nhận giao thất bại", 5],
  [33, 6, "Ghi nhận đã thu tiền COD từ người nhận", 3],
  [36, 6, "Cấu hình chính sách giao lại, giới hạn số lần giao", 2],
  [37, 6, "Quy trình hoàn hàng — phân công theo tuyến, theo dõi đến khi shop xác nhận", 5],
  [44, 7, "Thanh toán phí vận chuyển bằng mã VietQR", 4],
  [34, 7, "Tạo đối soát và tổng hợp số liệu cho khách hàng", 5],
  [43, 7, "Shop xem kỳ đối soát, khoản điều chỉnh; ghi nhận đã chi trả", 5],
  [38, 7, "Ghi nhận sự cố/khiếu nại, theo dõi xử lý và kết quả", 5],
  [39, 7, "Thống kê tổng hợp và dashboard quản trị", 8],
].map(([id, sprint, name, points]) => ({ tag: `US-${String(id).padStart(2, "0")}`, id, sprint, name, points }));

const EXTRA = [
  { tag: "PB-01", name: "Khách vãng lai xem dịch vụ và vùng phục vụ (Product Backlog #1)" },
  { tag: "PB-04", name: "Khách vãng lai xem bảng giá theo khu vực (Product Backlog #4)" },
  { tag: "CACHE", name: "Cache 30 giây: dữ liệu cloud cache xuống Redis, app không gọi API liên tục" },
];

// Bang chung kiem thu giao dien (khong chay trong lenh nay vi can bat server)
const UI_TESTS = {
  "US-06": "Web + App KH: từ chối tài khoản nhân viên, sai mật khẩu · App NV: sai mật khẩu · Maestro NV 02, KH 04, 05",
  "US-07": "Web + App KH: đăng ký doanh nghiệp, email trùng · Maestro KH 06 (cá nhân), 07 (doanh nghiệp)",
  "US-08": "Web + App NV + App KH: đăng xuất · Maestro NV 07, KH 08",
  "US-09": "Web: guard ngược · App NV: kho/tài xế không thấy menu quản trị · Maestro NV 04, 05",
  "US-10": "App NV: form người dùng · Liên thiết bị: khóa/mở tài khoản (máy ảo ↔ web, cả hai chiều)",
  "US-11": "App NV: CRUD khu vực · Maestro NV 06 · Liên app + liên thiết bị (cả hai chiều)",
  "US-12": "App NV: chặn trùng mã dịch vụ",
  "US-13": "App NV: lưới bậc khối lượng, báo chồng lấn và trùng khoảng hiệu lực ngay trên form",
  "US-14": "App NV: mở hub và bưu cục trực thuộc, chặn quận/huyện ngoài vùng phục vụ, tuyến chọn hub từ danh mục · Maestro NV 03",
  "US-15": "Web + App KH: thêm địa điểm (gợi ý quận/huyện), chặn ngoài vùng phục vụ, đặt mặc định, xóa",
  "US-16": "Web + App KH: ước tính phí → Gửi hàng → đăng ký tài khoản mới → tạo đơn điền sẵn dữ liệu · Maestro KH 09*",
  "US-17": "Web + App KH: bước xác nhận tách từng khoản phí, phí tạo đơn bằng phí đã ước tính · Liên app: phí khóa khi kho duyệt",
  "US-18": "Web + App KH: tạo đơn 4 bước, chặn bước sai · App NV: kho duyệt đơn, hub khác không thấy · Liên app Web → App NV · Maestro KH 09*, NV 08*",
  "US-19": "Web + App KH: thu hộ, 3 hình thức trả phí, khấu trừ chỉ khi bật thu hộ, thu hộ nhỏ hơn phí thì không cho xác nhận",
  "US-20": "Web + App KH: lọc 4 nhóm trạng thái, thời gian, mã vận đơn; chi tiết hành trình, phí đã khóa · Maestro KH 10",
  "US-21": "Story kỹ thuật, không có màn hình: hàng đợi thật (BullMQ trên Redis) trong test API; kết quả thấy qua tra cứu công khai (US-22)",
  "US-22": "Web + App KH: tra cứu khi chưa đăng nhập, 4 nhóm, che số · Quy trình 3 app: shop tạo đơn → kho duyệt → người nhận tra cứu · Maestro KH 11",
  "US-40": "App NV: tiếp nhận khách lẻ / shop, gợi ý xe tải, thu tiền mặt · Quy trình: kho tiếp nhận → người nhận tra cứu Web, shop thấy đơn · Maestro NV 09",
  "US-23": "App NV: kho xếp ca → tài xế thấy ca hôm nay; kho HCM chỉ thấy tuyến mình, trùng giờ bị chặn · Maestro NV 10",
  "US-24": "App NV: admin đặt mặc định → kho đặt năng lực riêng tài xế → bỏ ghi đè về theo tuyến · Maestro NV 10",
  "US-25": "App NV: quy trình shop tạo đơn → kho duyệt → tự phân công theo ca/năng lực → hàng chờ → phân công tay có lý do → tài xế thấy đơn · Maestro NV 10",
  "US-26": "Maestro NV 01–07 trên máy ảo Android · App NV: 17 kịch bản",
  "US-27": "App NV: tài xế thấy số đơn cần lấy trên thẻ Ca hôm nay và danh sách theo ca (trong quy trình US-25) · Maestro NV 11",
  "PB-01": "Web + App KH: trang chủ, vùng phục vụ, tìm không dấu · Maestro KH 01, 03",
  "PB-04": "Web + App KH: bảng giá đổi theo dịch vụ · Maestro KH 02",
  CACHE: "Web: đếm request (1 lần/30 giây), tự làm mới sau 30 giây, đổi tài khoản không lộ hồ sơ người trước",
};

console.log("Dang chay toan bo test API (mat khoang 40 giay)...");
// Tuan tu tung file nhu npm test: nhieu file cung tao don, chay song song se chen nhau
const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=tap"], {
  cwd: apiRoot,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const results = {};
const resultLine = /^\s*(not ok|ok) \d+ - \[([A-Z]+-?\d*)\] (.*?)(?: # (TODO|SKIP)\b.*)?$/;
for (const line of run.stdout.split(/\r?\n/)) {
  const match = line.match(resultLine);
  if (!match) continue;
  const [, status, tag, title, directive] = match;
  const bucket = (results[tag] ??= { pass: 0, fail: 0, todo: 0, failed: [] });
  if (directive === "TODO") bucket.todo += 1;
  else if (status === "ok") bucket.pass += 1;
  else {
    bucket.fail += 1;
    bucket.failed.push(title);
  }
}

function verdict(r) {
  if (!r) return "⚪ Chưa có test";
  if (r.fail > 0) return "🔴 Lỗi";
  if (r.pass > 0 && r.todo === 0) return "🟢 Đạt";
  if (r.pass > 0) return "🟡 Một phần";
  return "⚪ Chưa làm";
}

const cell = (r) => (r ? `${r.pass}/${r.pass + r.fail}${r.todo ? ` · còn ${r.todo} tiêu chí` : ""}` : "—");

const rows = STORIES.map((s) => {
  const r = results[s.tag];
  return `| ${s.sprint} | ${s.tag} | ${s.name} | ${s.points} | ${verdict(r)} | ${cell(r)} | ${UI_TESTS[s.tag] || ""} |`;
});
const passedStories = STORIES.filter((s) => verdict(results[s.tag]).includes("Đạt"));
const doneStories = STORIES.filter((s) => verdict(results[s.tag]).includes("Chưa làm"));
const failedStories = STORIES.filter((s) => verdict(results[s.tag]).includes("Lỗi"));
const pointsDone = passedStories.reduce((sum, s) => sum + s.points, 0);
const pointsTotal = STORIES.reduce((sum, s) => sum + s.points, 0);

const SPRINT_NUMBERS = [...new Set(STORIES.map((s) => s.sprint))];
const bySprint = SPRINT_NUMBERS.map((sprint) => {
  const items = STORIES.filter((s) => s.sprint === sprint);
  const ok = items.filter((s) => verdict(results[s.tag]).includes("Đạt"));
  return `| Sprint ${sprint} | ${ok.length}/${items.length} | ${ok.reduce((a, s) => a + s.points, 0)}/${items.reduce((a, s) => a + s.points, 0)} |`;
});

const failures = Object.entries(results)
  .filter(([, r]) => r.fail > 0)
  .flatMap(([tag, r]) => r.failed.map((t) => `- **${tag}**: ${t}`));

const today = new Date().toLocaleDateString("vi-VN");
const markdown = `# Kiểm thử theo story — Sprint 1 đến Sprint ${Math.max(...SPRINT_NUMBERS)}

> Sinh tự động ngày ${today} bởi \`npm run report:stories\` (thư mục \`code/apps/api\`).
> Chạy lại lệnh này sau mỗi lần sửa code để cập nhật. Chạy riêng một story:
> \`npm run test:story -- 6\` (story US-06).

## Tổng quan

| | Số story |
|---|---|
| 🟢 Đạt (mọi tiêu chí có test và pass) | ${passedStories.length} |
| 🔴 Lỗi (có test fail) | ${failedStories.length} |
| ⚪ Chưa làm (chưa có code, tiêu chí ghi dạng todo) | ${doneStories.length} |

Điểm story đạt: **${pointsDone}/${pointsTotal}** điểm của Sprint 1–${Math.max(...SPRINT_NUMBERS)} \
(${STORIES.length} story theo kế hoạch lập lại ngày 05/11/2026).

| Sprint | Story đạt | Điểm đạt |
|---|---|---|
${bySprint.join("\n")}

## Chi tiết từng story

Cột *Test API* = số test pass / tổng số test của story (nhãn \`[US-xx]\` trong tên test).
Cột *Kiểm thử giao diện* là các kịch bản Playwright (Web Khách hàng, App Nhân viên, App Khách
hàng) và Maestro trên máy ảo Android (NV = App Nhân viên, KH = App Khách hàng) đã chạy — cần bật
server nên không nằm trong lệnh này.

| Sprint | Story | Tên | Điểm | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|---|---|
${rows.join("\n")}

## Ngoài Sprint Backlog

| Mã | Nội dung | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|
${EXTRA.map((e) => `| ${e.tag} | ${e.name} | ${verdict(results[e.tag])} | ${cell(results[e.tag])} | ${UI_TESTS[e.tag] || ""} |`).join("\n")}
${failures.length ? `\n## Test đang fail\n\n${failures.join("\n")}\n` : ""}
## Lưu ý cho Sprint Review

- Lịch lấy từ docs/PERT_ToanDuAn.docx: Sprint 2 kéo dài đến 30/10/2026 để xong đủ 9 story (gồm US-13).
  Cả 9 story Sprint 2 xong ngày 29/10/2026 nên Sprint 3 (US-14 → US-19) bắt đầu ngay 29/10/2026,
  sớm hơn lịch PERT (02/11/2026), và đóng Sprint ngày 05/11/2026 (không dùng ngày dự phòng).
  Story chỉ ghi "Done" khi chuyển sang 🟢 Đạt ở bảng trên.
- Kế hoạch lập lại 05/11/2026 sau khi đối chiếu Case study 02 và 14 (docs/DoiChieuCaseStudy_MoRong.md):
  thêm US-40 → US-44 (tiếp nhận tại quầy, quy trình tại kho, tài khoản ngân hàng, đối soát phía shop,
  VietQR), mở rộng tiêu chí US-20, 25, 28, 31, 32, 35 và thêm Sprint 7. Sprint 4: 06/11 – 01/12/2026,
  Sprint 5: 02/12 – 18/12/2026, Sprint 6: 21/12/2026 – 11/01/2027, Sprint 7: 12/01 – 02/02/2027.
- Thứ tự thực tế Sprint 3: T4 (lõi tính phí US-17) làm trước T3 vì API ước tính phí (US-16) dùng nó;
  API thu hộ (T7, US-19) làm trước màn hình tạo đơn (T6) để màn hình có đủ luật thu hộ.
- \\* Flow Maestro KH 09 và NV 08 đã viết nhưng chưa chạy trên máy ảo: máy dev chỉ còn khoảng 3 GB
  bộ nhớ ảo, bật máy ảo dễ làm sập tiến trình. Cùng mã nguồn đã chạy bằng Playwright (bản web).
- US-26 (Sprint 4) đã xong sớm cùng App Nhân viên.
- US-05 (CI) chỉ kiểm tra được file workflow có đủ bước lint → test → build; kết quả chạy
  thật xem trên tab Actions của GitHub.
`;

writeFileSync(reportPath, markdown, "utf8");
console.log(`Da ghi bao cao: ${reportPath}`);
console.log(`Dat: ${passedStories.length} story | Loi: ${failedStories.length} | Chua lam: ${doneStories.length}`);
console.log(`Diem dat: ${pointsDone}/${pointsTotal}`);
process.exit(failedStories.length > 0 ? 1 : 0);
