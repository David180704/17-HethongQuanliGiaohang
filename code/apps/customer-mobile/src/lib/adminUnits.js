// Dia chi 2 cap (tinh/thanh -> xa/phuong) tu 01/07/2025, khong con quan/huyen. Khop ten go tay voi danh
// muc that tu API (/public/provinces, /public/provinces/wards) - cung luat voi server va Web Khach hang:
// go khong dau / thieu chu "Phường", "Xã" van nhan; khong co trong danh muc hoac khong thuoc tinh -> loi.
import { useCachedQuery } from "./useCachedQuery";
import { plainText } from "./orderForm";

const WARD_PREFIX = /^(phường|xã|đặc khu)\s+/i;
const PROVINCE_PREFIX = /^(tỉnh|thành phố|tp\.?)\s+/i;
const exact = (text) => String(text ?? "").normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
const plain = (text) => plainText(String(text ?? "").replace(/\s+/g, " "));
const filled = (text) => String(text ?? "").trim() !== "";
const stripProvince = (text) => String(text ?? "").normalize("NFC").trim().replace(PROVINCE_PREFIX, "");
const stripWard = (text) => String(text ?? "").normalize("NFC").trim().replace(WARD_PREFIX, "");

function pickOne(typed, candidates, strip) {
  const unique = (list) => [...new Map(list.map((c) => [c.key, c])).values()];
  const same = (normalize) => (c) => normalize(c.full) === normalize(typed) || normalize(strip(c.full)) === normalize(strip(typed));
  const withMarks = unique(candidates.filter(same(exact)));
  if (withMarks.length === 1) return withMarks[0];
  const noMarks = unique(candidates.filter(same(plain)));
  return noMarks.length === 1 ? noMarks[0] : null;
}

export function findProvince(provinces, text) {
  if (!filled(text)) return null;
  const candidates = provinces.flatMap((p) => [
    { key: p.name, full: p.name, province: p },
    { key: p.name, full: p.fullName, province: p },
  ]);
  return pickOne(text, candidates, stripProvince)?.province ?? null;
}

export function findWard(wardNames, text) {
  if (!filled(text)) return null;
  return pickOne(text, wardNames.map((name) => ({ key: name, full: name })), stripWard)?.full ?? null;
}

/** Goi y: ten chua chu da go (khong dau), uu tien ten bat dau bang chu do. */
export function suggest(names, text, limit = 4) {
  const typed = plain(stripWard(stripProvince(text)));
  if (typed.length < 2) return [];
  const hits = names.filter((name) => plain(name).includes(typed));
  const starts = (name) => plain(stripWard(stripProvince(name))).startsWith(typed);
  return [...hits.filter(starts), ...hits.filter((n) => !starts(n))].slice(0, limit);
}

/** Kiem dia chi go tay: tinh co that, xa/phuong thuoc tinh va dang phuc vu. */
export function useAddressCheck(provinceText, wardText) {
  const { data: provinceData } = useCachedQuery("/public/provinces", {}, { refreshMs: 10 * 60 * 1000 });
  const provinces = provinceData || [];
  const province = findProvince(provinces, provinceText);
  const { data: wardData } = useCachedQuery(
    "/public/provinces/wards",
    { province: province?.name || "" },
    { enabled: Boolean(province), refreshMs: 10 * 60 * 1000 },
  );
  const wards = province && wardData?.province === province.name ? wardData.wards : null;
  const ward = wards ? findWard(wards.map((w) => w.name), wardText) : null;
  const served = ward ? wards.find((w) => w.name === ward)?.served !== false : false;

  let provinceError = "";
  let wardError = "";
  if (provinceData && filled(provinceText) && !province) {
    provinceError = `Không có tỉnh/thành "${String(provinceText).trim()}" — chọn trong gợi ý (34 tỉnh/thành)`;
  } else if (province && wards && filled(wardText) && !ward) {
    wardError = `"${String(wardText).trim()}" không phải xã/phường của ${province.name} — chọn trong gợi ý`;
  } else if (ward && !served) {
    wardError = `${ward}, ${province.name} chưa thuộc vùng phục vụ`;
  }
  return {
    provinces,
    province,
    wards: wards || [],
    ward,
    provinceError,
    wardError,
    error: provinceError || wardError,
    ready: Boolean(province && ward && served),
    checking: Boolean(province && filled(wardText) && !wards),
  };
}

export function addressProblem(check, value, who = "") {
  if (!filled(value.province) || !filled(value.ward)) return `Chọn tỉnh/thành và xã/phường${who}`;
  if (check.error) return check.error;
  if (check.checking) return "Đang kiểm tra địa chỉ, thử lại sau giây lát";
  if (!check.ready) return `Chọn tỉnh/thành và xã/phường${who} trong gợi ý`;
  return "";
}
