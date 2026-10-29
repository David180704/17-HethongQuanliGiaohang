import { BaseRepository } from "../../core/BaseRepository.js";
import { toSearchRegex } from "../../core/textSearch.js";
import { ServiceArea } from "../../models/ServiceArea.js";

// Khop TRON ten (khong phai "chua"): "quan 1" khop "Quận 1" nhung khong khop "Quận 10".
const wholeName = (text) => ({ $regex: `^${toSearchRegex(String(text ?? "").trim())}$`, $options: "i" });

// Mo rong BaseRepository bang truy van rieng cho trang cong khai (Open/Closed:
// them ham moi, khong sua lop cha).
export class ServiceAreaRepository extends BaseRepository {
  constructor() {
    super(ServiceArea, { searchFields: ["province", "district"] });
  }

  /** Vung phuc vu cho khach vang lai: chi field an toan, khong lo routeId. */
  searchPublic(search = "") {
    return this.model
      .find(this.buildQuery({ search, filters: {} }))
      .select("province district wards region")
      .sort({ province: 1, district: 1 })
      .lean();
  }

  /**
   * Khu vuc phuc vu cua mot dia chi (tinh + quan/huyen) - dung khi mo diem tap ket,
   * luu dia diem lay hang, tao don. Khong phan biet hoa thuong, go khong dau van ra
   * ("ha noi", "hoan kiem"); tra null neu quan/huyen chua phuc vu.
   */
  findByLocation(province, district, { session } = {}) {
    return this.model
      .findOne({ province: wholeName(province), district: wholeName(district) })
      .session(session ?? null)
      .lean();
  }
}
