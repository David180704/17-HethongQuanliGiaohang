// Dinh dang hien thi - cung noi dung voi apps/web/src/lib/format.js. Tu dinh dang so thay
// vi toLocaleString: Hermes tren mot so may Android khong co du lieu Intl "vi-VN".

export const REGION_LABELS = { BAC: "Miền Bắc", TRUNG: "Miền Trung", NAM: "Miền Nam" };

export const CUSTOMER_TYPE_LABELS = { INDIVIDUAL: "Cá nhân", BUSINESS: "Doanh nghiệp / shop" };

export const ZONES = [
  { code: "INNER_DISTRICT", label: "Nội quận", hint: "Cùng quận/huyện" },
  { code: "INNER_PROVINCE", label: "Nội tỉnh", hint: "Cùng tỉnh, khác quận/huyện" },
  { code: "INTER_PROVINCE", label: "Liên tỉnh", hint: "Khác tỉnh, cùng miền" },
  { code: "INTER_REGION", label: "Liên miền", hint: "Khác miền" },
];

// Bac cuoi cung trong seed dung toGram rat lon de coi nhu "khong gioi han"
const UNBOUNDED_GRAM = 100000000;

/** 15000 -> "15.000" (dau cham ngan cach hang nghin kieu Viet Nam) */
export function groupThousands(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatVnd(amount) {
  return `${groupThousands(amount)} ₫`;
}

function formatWeight(gram) {
  if (gram < 1000) return `${gram} g`;
  return `${String(gram / 1000).replace(".", ",")} kg`;
}

// Bac khoi luong [fromGram, toGram): "0 – 500 g", "500 g – 1 kg", "Trên 5 kg"
export function formatTier({ fromGram, toGram }) {
  if (toGram >= UNBOUNDED_GRAM) return `Trên ${formatWeight(fromGram)}`;
  return `${fromGram === 0 ? "0" : formatWeight(fromGram)} – ${formatWeight(toGram)}`;
}

export function tierAllowsExtraSteps({ fromGram, toGram }) {
  return toGram - fromGram > 500;
}

export function formatSurcharge(rate) {
  if (!rate) return "Không phụ phí dịch vụ";
  return `Phụ phí dịch vụ +${Math.round(rate * 100)}%`;
}

/** Gio:phut:giay cua lan lay du lieu gan nhat */
export function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Ten nguoi Viet: ten goi nam o tu cuoi ("Khách Hàng 1" -> "1", "Chủ Shop" -> "S")
export function avatarLetter(fullName = "") {
  const words = fullName.trim().split(" ").filter(Boolean);
  return (words[words.length - 1]?.[0] || "?").toUpperCase();
}
