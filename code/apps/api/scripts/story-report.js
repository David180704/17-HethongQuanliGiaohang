// Chay TOAN BO test API mot lan, gom ket qua theo nhan [US-xx] trong ten test,
// roi sinh bao cao docs/KiemThuTheoStory.md.
//   npm run report:stories
// Can: Docker (Mongo + Redis) dang chay va CSDL local da seed (npm run seed:local).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const reportPath = fileURLToPath(new URL("../../../../docs/KiemThuTheoStory.md", import.meta.url));

// Story Sprint 1-5 theo sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
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
  [13, 3, "Quản lý bảng giá vận chuyển theo khu vực và khối lượng", 5],
  [14, 3, "Quản lý danh mục điểm tập kết và bưu cục", 2],
  [15, 3, "Quản lý danh sách địa điểm lấy hàng", 3],
  [16, 3, "Ước tính phí vận chuyển trước khi gửi hàng", 3],
  [17, 3, "Xem phí vận chuyển dự kiến trước khi xác nhận đơn", 5],
  [18, 3, "Tạo đơn hàng giao mới", 5],
  [19, 3, "Khai báo tiền thu hộ COD và hình thức thanh toán phí", 3],
  [20, 4, "Xem chi tiết đơn hàng và toàn bộ hành trình", 2],
  [21, 4, "Hàng đợi sự kiện và consumer ghi nhật ký hành trình đơn", 5],
  [22, 4, "Tra cứu hành trình đơn hàng bằng mã vận đơn", 3],
  [23, 4, "Quản lý ca làm việc và phân công nhân viên vào tuyến", 3],
  [24, 4, "Cấu hình năng lực xử lý tối đa của người giao hàng", 3],
  [25, 4, "Phân công đơn lấy hàng cho người giao hàng", 5],
  [26, 4, "Đăng nhập ứng dụng di động", 2],
  [27, 4, "Xem danh sách đơn cần lấy trong ca làm việc", 3],
  [28, 5, "Xác nhận đã lấy hàng từ người gửi", 3],
  [29, 5, "Quản lý điểm check-in trên bản đồ", 3],
  [30, 5, "Tự động check-in vị trí khi đi qua điểm đã cài đặt", 5],
  [31, 5, "Xem danh sách đơn cần giao trong ca làm việc", 3],
  [32, 5, "Xác nhận giao hàng thành công cho người nhận", 3],
  [33, 5, "Ghi nhận đã thu tiền COD từ người nhận", 3],
  [34, 5, "Tạo đối soát và tổng hợp số liệu cho khách hàng", 5],
].map(([id, sprint, name, points]) => ({ tag: `US-${String(id).padStart(2, "0")}`, id, sprint, name, points }));

const EXTRA = [
  { tag: "PB-01", name: "Khách vãng lai xem dịch vụ và vùng phục vụ (Product Backlog #1)" },
  { tag: "PB-04", name: "Khách vãng lai xem bảng giá theo khu vực (Product Backlog #4)" },
  { tag: "CACHE", name: "Cache 30 giây: dữ liệu cloud cache xuống Redis, app không gọi API liên tục" },
];

// Bang chung kiem thu giao dien (khong chay trong lenh nay vi can bat server)
const UI_TESTS = {
  "US-06": "Web: từ chối tài khoản nhân viên · App NV: sai mật khẩu · Maestro 02",
  "US-07": "Web: đăng ký doanh nghiệp, email trùng",
  "US-08": "Web + App NV: đăng xuất · Maestro 07",
  "US-09": "Web: guard ngược · App NV: kho/tài xế không thấy menu quản trị · Maestro 04, 05",
  "US-10": "App NV: form người dùng · Liên thiết bị: khóa/mở tài khoản trên máy ảo",
  "US-11": "App NV: CRUD khu vực · Maestro 06 · Liên app + liên thiết bị",
  "US-12": "App NV: chặn trùng mã dịch vụ",
  "US-26": "Maestro 01–07 trên máy ảo Android · App NV: 13 kịch bản",
  "PB-01": "Web: trang chủ, vùng phục vụ",
  "PB-04": "Web: bảng giá đổi theo dịch vụ",
  CACHE: "Web: đếm request (1 lần/30 giây), tự làm mới sau 30 giây",
};

console.log("Dang chay toan bo test API (mat khoang 10-20 giay)...");
const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], {
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

const bySprint = [1, 2, 3, 4, 5].map((sprint) => {
  const items = STORIES.filter((s) => s.sprint === sprint);
  const ok = items.filter((s) => verdict(results[s.tag]).includes("Đạt"));
  return `| Sprint ${sprint} | ${ok.length}/${items.length} | ${ok.reduce((a, s) => a + s.points, 0)}/${items.reduce((a, s) => a + s.points, 0)} |`;
});

const failures = Object.entries(results)
  .filter(([, r]) => r.fail > 0)
  .flatMap(([tag, r]) => r.failed.map((t) => `- **${tag}**: ${t}`));

const today = new Date().toLocaleDateString("vi-VN");
const markdown = `# Kiểm thử theo story — Sprint 1 đến Sprint 5

> Sinh tự động ngày ${today} bởi \`npm run report:stories\` (thư mục \`code/apps/api\`).
> Chạy lại lệnh này sau mỗi lần sửa code để cập nhật. Chạy riêng một story:
> \`npm run test:story -- 6\` (story US-06).

## Tổng quan

| | Số story |
|---|---|
| 🟢 Đạt (mọi tiêu chí có test và pass) | ${passedStories.length} |
| 🔴 Lỗi (có test fail) | ${failedStories.length} |
| ⚪ Chưa làm (chưa có code, tiêu chí ghi dạng todo) | ${doneStories.length} |

Điểm story đạt: **${pointsDone}/${pointsTotal}** điểm của Sprint 1–5.

| Sprint | Story đạt | Điểm đạt |
|---|---|---|
${bySprint.join("\n")}

## Chi tiết từng story

Cột *Test API* = số test pass / tổng số test của story (nhãn \`[US-xx]\` trong tên test).
Cột *Kiểm thử giao diện* là các kịch bản Playwright (web, App Nhân viên) và Maestro (máy ảo
Android) đã chạy — cần bật server nên không nằm trong lệnh này.

| Sprint | Story | Tên | Điểm | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|---|---|
${rows.join("\n")}

## Ngoài Sprint Backlog

| Mã | Nội dung | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|
${EXTRA.map((e) => `| ${e.tag} | ${e.name} | ${verdict(results[e.tag])} | ${cell(results[e.tag])} | ${UI_TESTS[e.tag] || ""} |`).join("\n")}
${failures.length ? `\n## Test đang fail\n\n${failures.join("\n")}\n` : ""}
## Lưu ý cho Sprint Review

- **Tài liệu Sprint Planning 3 ghi US-13 (bảng giá) và US-14 (hub) là "Done", nhưng chưa có
  code nào cho hai story này.** Cần sửa lại trạng thái trong tài liệu hoặc làm xong code trước
  buổi review.
- Hôm nay đang ở Sprint 5 (26/10 – 06/11/2026) nhưng phần code mới hoàn thành Sprint 1–2,
  cộng US-26 của Sprint 4. Sprint 3 là nút thắt: US-13, US-17 (tính phí) chặn phần lớn các
  story sau, nên làm trước.
- US-05 (CI) chỉ kiểm tra được file workflow có đủ bước lint → test → build; kết quả chạy
  thật xem trên tab Actions của GitHub.
`;

writeFileSync(reportPath, markdown, "utf8");
console.log(`Da ghi bao cao: ${reportPath}`);
console.log(`Dat: ${passedStories.length} story | Loi: ${failedStories.length} | Chua lam: ${doneStories.length}`);
console.log(`Diem dat: ${pointsDone}/${pointsTotal}`);
process.exit(failedStories.length > 0 ? 1 : 0);
