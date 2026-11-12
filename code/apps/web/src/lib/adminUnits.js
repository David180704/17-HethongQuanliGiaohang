// Dia chi 2 cap (tinh/thanh -> xa/phuong) tu 01/07/2025, khong con quan/huyen. Khop ten go tay voi
// danh muc that tu API (/public/provinces, /public/provinces/wards) - cung luat voi server:
// go khong dau / thieu chu "Phường", "Xã" van nhan; khong co trong danh muc hoac khong thuoc tinh -> loi.
import { useEffect, useState } from "react";
import { queryCache } from "./queryCache.js";
import { useCachedQuery } from "./useCachedQuery.js";
import { plainText } from "./format.js";

const WARD_PREFIX = /^(phường|xã|đặc khu)\s+/i;
const PROVINCE_PREFIX = /^(tỉnh|thành phố|tp\.?)\s+/i;
const exact = (text) => String(text ?? "").normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
const plain = (text) => plainText(String(text ?? "").replace(/\s+/g, " "));
const filled = (text) => String(text ?? "").trim() !== "";

function pickOne(typed, candidates, strip) {
  const unique = (list) => [...new Map(list.map((c) => [c.key, c])).values()];
  const same = (normalize) => (c) => normalize(c.full) === normalize(typed) || normalize(strip(c.full)) === normalize(strip(typed));
  const withMarks = unique(candidates.filter(same(exact)));
  if (withMarks.length === 1) return withMarks[0];
  const noMarks = unique(candidates.filter(same(plain)));
  return noMarks.length === 1 ? noMarks[0] : null;
}

const stripProvince = (text) => String(text ?? "").normalize("NFC").trim().replace(PROVINCE_PREFIX, "");
const stripWard = (text) => String(text ?? "").normalize("NFC").trim().replace(WARD_PREFIX, "");

/** provinces: [{ name, fullName }] -> tinh khop ten go tay (null neu khong co / mo ho). */
export function findProvince(provinces, text) {
  if (!filled(text)) return null;
  const candidates = provinces.flatMap((p) => [
    { key: p.name, full: p.name, province: p },
    { key: p.name, full: p.fullName, province: p },
  ]);
  return pickOne(text, candidates, stripProvince)?.province ?? null;
}

/** wardNames: ten chuan cua tinh -> ten chuan khop ten go tay (null neu khong thuoc tinh). */
export function findWard(wardNames, text) {
  if (!filled(text)) return null;
  return pickOne(text, wardNames.map((name) => ({ key: name, full: name })), stripWard)?.full ?? null;
}

/**
 * Kiem dia chi go tay ngay tren form.
 * @returns {{ provinces, province, wards, ward, provinceError, wardError, error, ready, checking }}
 *   ready = tinh + xa/phuong deu co that, xa/phuong thuoc tinh va dang phuc vu.
 */
export function useAddressCheck(provinceText, wardText) {
  const { data: provinceData } = useCachedQuery("/public/provinces", {}, { refreshMs: 10 * 60 * 1000 });
  const provinces = provinceData || [];
  const province = findProvince(provinces, provinceText);
  const provinceName = province?.name || "";
  const [loaded, setLoaded] = useState({ province: "", wards: null });

  useEffect(() => {
    if (!provinceName) return undefined;
    let alive = true;
    queryCache
      .get("/public/provinces/wards", { province: provinceName })
      .then(({ body }) => alive && setLoaded({ province: provinceName, wards: body.data.wards }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [provinceName]);

  const wards = provinceName && loaded.province === provinceName ? loaded.wards : null;
  const ward = wards ? findWard(wards.map((w) => w.name), wardText) : null;
  const served = ward ? wards.find((w) => w.name === ward)?.served !== false : false;

  let provinceError = "";
  let wardError = "";
  if (provinceData && filled(provinceText) && !province) {
    provinceError = `Không có tỉnh/thành "${String(provinceText).trim()}" — chọn trong danh sách gợi ý (34 tỉnh/thành)`;
  } else if (province && wards && filled(wardText) && !ward) {
    wardError = `"${String(wardText).trim()}" không phải xã/phường của ${province.name} — chọn trong danh sách gợi ý`;
  } else if (ward && !served) {
    wardError = `${ward}, ${province.name} chưa thuộc vùng phục vụ`;
  }
  const ready = Boolean(province && ward && served);
  return {
    provinces,
    province,
    wards: wards || [],
    ward,
    provinceError,
    wardError,
    error: provinceError || wardError,
    ready,
    checking: Boolean(provinceName && filled(wardText) && !wards),
  };
}

/** Thong bao chan buoc tiep theo khi dia chi chua hop le (rong = hop le). */
export function addressProblem(check, value, who = "") {
  if (!filled(value.province) || !filled(value.ward)) return `Chọn tỉnh/thành và xã/phường${who}`;
  if (check.error) return check.error;
  if (check.checking) return "Đang kiểm tra địa chỉ, thử lại sau giây lát";
  if (!check.ready) return `Chọn tỉnh/thành và xã/phường${who} trong danh sách gợi ý`;
  return "";
}
