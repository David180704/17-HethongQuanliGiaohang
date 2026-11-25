export const REGION_LABELS = { BAC: "Miền Bắc", TRUNG: "Miền Trung", NAM: "Miền Nam" };

export const ZONES = [
  { code: "INNER_WARD", label: "Nội xã/phường", hint: "Cùng xã/phường" },
  { code: "INNER_PROVINCE", label: "Nội tỉnh", hint: "Cùng tỉnh, khác xã/phường" },
  { code: "INTER_PROVINCE", label: "Liên tỉnh", hint: "Khác tỉnh, cùng miền" },
  { code: "INTER_REGION", label: "Liên miền", hint: "Khác miền" },
];

// Bac cuoi cung trong seed dung toGram rat lon de coi nhu "khong gioi han"
const UNBOUNDED_GRAM = 100000000;

// "Hà Nội" -> "ha noi": so sanh ten dia danh khi nguoi dung go khong dau
export function plainText(text = "") {
  return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}

export function formatVnd(amount) {
  return `${Math.round(amount).toLocaleString("vi-VN")} ₫`;
}

function formatWeight(gram) {
  if (gram < 1000) return `${gram} g`;
  return `${(gram / 1000).toLocaleString("vi-VN")} kg`;
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

/** "12,3 km (đường chim bay)"; approx = mot dau chua co toa do xa/phuong, tinh theo tam tinh. */
export function distanceText({ distanceKm, distanceApprox }) {
  if (distanceKm === null || distanceKm === undefined) return "";
  if (distanceKm === 0) return "cùng xã/phường";
  const km = distanceKm.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return `khoảng ${km} km (đường chim bay${distanceApprox ? ", ước theo tâm tỉnh" : ""})`;
}
