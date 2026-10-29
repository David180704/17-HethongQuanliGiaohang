import { BaseRepository } from "../../core/BaseRepository.js";
import { ServiceType } from "../../models/ServiceType.js";

export class ServiceTypeRepository extends BaseRepository {
  constructor() {
    super(ServiceType, { searchFields: ["code", "name"] });
  }

  /** Loai dich vu dang hoat dong cho trang cong khai: chi field an toan. */
  findActivePublic() {
    return this.model
      .find({ isActive: true })
      .select("code name surchargeRate estimatedDays")
      .sort({ surchargeRate: 1 })
      .lean();
  }
}
