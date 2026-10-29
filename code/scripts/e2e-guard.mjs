// globalSetup dung chung cho Playwright (apps/web, apps/staff, apps/customer-mobile):
// test giao dien tao/sua/xoa du lieu thu (khu vuc, khoa tai khoan...) nen CHI chay khi API dang
// noi CSDL local. API noi MongoDB Atlas (du lieu that) thi dung ngay, khong chay test nao.
// Bo chot (chi khi chac chan): dat bien moi truong E2E_ALLOW_CLOUD=1.
export default async function assertLocalDatabase() {
  if (process.env.E2E_ALLOW_CLOUD === "1") return;
  const api = process.env.E2E_API_URL || "http://localhost:4044";
  let health;
  try {
    health = await (await fetch(`${api}/health`)).json();
  } catch {
    throw new Error(`Khong goi duoc ${api}/health - API da chay chua? (code/start-dev.ps1 -Local)`);
  }
  const database = health?.data?.database;
  if (database?.cloud) {
    throw new Error(
      `API dang dung CSDL cloud (${database.host}). Test se ghi du lieu thu len Atlas.\n` +
        "Chay API voi CSDL local: code/start-dev.ps1 -Local (hoac MONGO_URI=mongodb://localhost:27018/edms?directConnection=true).",
    );
  }
}
