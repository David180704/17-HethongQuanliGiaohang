// Chuan hoa chuoi ket noi MongoDB Atlas nguoi dung dan vao (copy tu nut Connect cua Atlas).
// Ham thuan, khong ket noi mang: de test va de script setup-atlas.js dung.

const SCHEME = /^(mongodb(?:\+srv)?):\/\//;

function encodePart(value) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value); // da ma hoa san thi khong ma hoa 2 lan
  } catch {
    // co "%" le -> coi nhu chua ma hoa
  }
  return encodeURIComponent(decoded);
}

/**
 * @returns {{ uri: string, host: string, dbName: string, changes: string[] }}
 * @throws {Error} message tieng Viet, KHONG chua mat khau
 */
export function normalizeMongoUri(input, { dbName = "edms" } = {}) {
  const raw = String(input ?? "").trim().replace(/^["']|["']$/g, "");
  const scheme = raw.match(SCHEME);
  if (!scheme) throw new Error('Chuỗi kết nối phải bắt đầu bằng "mongodb+srv://" hoặc "mongodb://"');
  if (/<[^>]*>/.test(raw)) {
    throw new Error("Chuỗi kết nối còn chỗ chưa thay, ví dụ <db_password>: thay bằng mật khẩu thật (bỏ cả dấu < >)");
  }

  const rest = raw.slice(scheme[0].length);
  const at = rest.lastIndexOf("@"); // mat khau co the chua "@", may chu thi khong
  if (at < 0) throw new Error("Chuỗi kết nối thiếu tên đăng nhập và mật khẩu (dạng user:matkhau@...)");
  const credentials = rest.slice(0, at);
  const colon = credentials.indexOf(":");
  if (colon <= 0 || colon === credentials.length - 1) {
    throw new Error("Chuỗi kết nối thiếu tên đăng nhập hoặc mật khẩu (dạng user:matkhau@...)");
  }
  const changes = [];
  const user = encodePart(credentials.slice(0, colon));
  const password = encodePart(credentials.slice(colon + 1));
  if (`${user}:${password}` !== credentials) changes.push("mã hóa ký tự đặc biệt trong tên đăng nhập/mật khẩu");

  const afterHost = rest.slice(at + 1);
  const cut = afterHost.search(/[/?]/);
  const host = cut < 0 ? afterHost : afterHost.slice(0, cut);
  if (!host) throw new Error("Chuỗi kết nối thiếu địa chỉ cluster (phần sau dấu @)");
  let tail = cut < 0 ? "" : afterHost.slice(cut); // "/db?query" | "?query" | "/"
  let query = "";
  const q = tail.indexOf("?");
  if (q >= 0) {
    query = tail.slice(q);
    tail = tail.slice(0, q);
  }
  let db = tail.replace(/^\//, "");
  if (!db) {
    db = dbName;
    changes.push(`thêm tên database "/${dbName}"`);
  }

  return { uri: `${scheme[0]}${user}:${password}@${host}/${db}${query}`, host, dbName: db, changes };
}

// Thay dong KEY=... (chua bi comment) trong noi dung file .env, khong co thi them vao cuoi.
export function upsertEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, () => line);
  const base = text === "" || text.endsWith("\n") ? text : `${text}\n`;
  return `${base}${line}\n`;
}
