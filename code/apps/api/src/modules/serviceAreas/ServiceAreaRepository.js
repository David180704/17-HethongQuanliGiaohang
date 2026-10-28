import { BaseRepository } from "../../core/BaseRepository.js";
import { ServiceArea } from "../../models/ServiceArea.js";

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
}
