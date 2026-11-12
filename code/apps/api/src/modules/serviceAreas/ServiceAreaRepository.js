import { BaseRepository } from "../../core/BaseRepository.js";
import { ServiceArea } from "../../models/ServiceArea.js";

// Mo rong BaseRepository bang truy van rieng cho trang cong khai (Open/Closed:
// them ham moi, khong sua lop cha).
export class ServiceAreaRepository extends BaseRepository {
  constructor() {
    super(ServiceArea, { searchFields: ["province", "ward"] });
  }

  /**
   * Vung phuc vu cho khach vang lai: chi field an toan, khong lo routeId. Toi da 50 dong - danh sach
   * day du (3.321 xa/phuong) xem theo tung tinh qua /public/provinces/wards.
   */
  searchPublic(search = "") {
    return this.model
      .find(this.buildQuery({ search, filters: {} }))
      .select("province ward region")
      .sort({ province: 1, ward: 1 })
      .limit(50)
      .lean();
  }

  /** So xa/phuong dang phuc vu cua tung tinh: { "Hà Nội": 126, ... }. */
  async servedCountByProvince() {
    const rows = await this.model.aggregate([{ $group: { _id: "$province", n: { $sum: 1 } } }]);
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  }

  /** Ten xa/phuong dang phuc vu trong mot tinh (ten chuan). */
  async servedWards(province) {
    return (await this.model.find({ province }).select("ward").lean()).map((a) => a.ward);
  }

  /**
   * Khu vuc phuc vu cua mot dia chi da chuan hoa ten (tinh + xa/phuong) - xem locateArea.
   * Tra null neu xa/phuong co that nhung chua phuc vu.
   */
  findByLocation(province, ward, { session } = {}) {
    return this.model
      .findOne({ province, ward })
      .session(session ?? null)
      .lean();
  }
}
