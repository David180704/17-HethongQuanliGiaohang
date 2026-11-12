// Danh muc don vi hanh chinh 2 cap (tinh/thanh -> xa/phuong/dac khu) sau sap xep 01/07/2025:
// 34 tinh/thanh, 3.321 xa/phuong. Khong con cap quan/huyen. Nguon: src/data/donViHanhChinh.json.
// Ham thuan, khong DB: kiem dia chi khach go tay co dung la don vi co that va xa/phuong co thuoc
// dung tinh do khong; tra ve TEN CHUAN de luu (go "ba dinh" -> "Phường Ba Đình").
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const data = JSON.parse(readFileSync(new URL("../../data/donViHanhChinh.json", import.meta.url), "utf8"));

export const SOURCE = data.source;
export const PROVINCES = data.provinces.map(({ code, name, fullName, wards }) => ({ code, name, fullName, wards }));

const WARD_PREFIX = /^(phường|xã|đặc khu)\s+/i;
const PROVINCE_PREFIX = /^(tỉnh|thành phố|tp\.?)\s+/i;

/** Bo dau, ve chu thuong, gom khoang trang: "Phường  Ba Đình" -> "phuong ba dinh". */
export function plain(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const exact = (text) => String(text ?? "").normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
const stripWard = (text) => String(text ?? "").normalize("NFC").trim().replace(WARD_PREFIX, "");
const stripProvince = (text) => String(text ?? "").normalize("NFC").trim().replace(PROVINCE_PREFIX, "");

// Chon mot ung vien: khop co dau (dung chinh ta) truoc, roi moi toi khong dau. Khong dau ma
// ra hai ten (vd "Xã Văn Lang" / "Xã Văn Lăng") thi coi la mo ho -> null, bat go du dau.
function pickOne(typed, candidates, strip) {
  // Mot don vi co the khop qua nhieu cach viet (ten ngan / ten day du) -> gom theo key
  const unique = (list) => [...new Map(list.map((c) => [c.key, c])).values()];
  const withMarks = unique(candidates.filter((c) => exact(c.full) === exact(typed) || exact(strip(c.full)) === exact(strip(typed))));
  if (withMarks.length === 1) return withMarks[0];
  const noMarks = unique(candidates.filter((c) => plain(c.full) === plain(typed) || plain(strip(c.full)) === plain(strip(typed))));
  return noMarks.length === 1 ? noMarks[0] : null;
}

/** Tinh/thanh theo ten go tay: "Hà Nội", "ha noi", "Thành phố Hà Nội", "Hồ Chí Minh", "TP HCM" khong nhan. */
export function findProvince(text) {
  if (!String(text ?? "").trim()) return null;
  const candidates = PROVINCES.flatMap((p) => [
    { key: p.code, full: p.name, province: p },
    { key: p.code, full: p.fullName, province: p },
  ]);
  return pickOne(text, candidates, stripProvince)?.province ?? null;
}

/** Ten chuan cua xa/phuong trong tinh; null neu khong co hoac go mo ho. */
export function findWard(province, text) {
  if (!province || !String(text ?? "").trim()) return null;
  const candidates = province.wards.map((ward) => ({ key: ward, full: ward }));
  return pickOne(text, candidates, stripWard)?.full ?? null;
}

/**
 * Kiem mot dia chi (tinh + xa/phuong) go tay.
 * @returns {{ ok: true, province: string, ward: string } | { ok: false, field: "province"|"ward", message: string }}
 */
export function checkAddress(provinceText, wardText) {
  const province = findProvince(provinceText);
  if (!province) {
    return { ok: false, field: "province", message: `Tỉnh/thành "${String(provinceText ?? "").trim()}" không có trong danh mục 34 tỉnh/thành` };
  }
  const ward = findWard(province, wardText);
  if (!ward) {
    return {
      ok: false,
      field: "ward",
      message: `Xã/phường "${String(wardText ?? "").trim()}" không thuộc ${province.name} — chọn đúng xã/phường trong danh sách`,
    };
  }
  return { ok: true, province: province.name, ward };
}
