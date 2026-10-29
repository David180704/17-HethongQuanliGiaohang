import { BaseRepository } from "../../core/BaseRepository.js";
import { PriceTable } from "../../models/PriceTable.js";
// Dang ky model cho populate("serviceTypeId")
import "../../models/ServiceType.js";

export class PriceTableRepository extends BaseRepository {
  constructor() {
    super(PriceTable, { defaultSort: { serviceTypeId: 1, zone: 1, effectiveFrom: -1 } });
  }

  // Man hinh quan tri can ten loai dich vu ngay trong danh sach
  async findPage({ page = 1, limit = 20, search = "", filters = {} } = {}) {
    const query = this.buildQuery({ search, filters });
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort(this.defaultSort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("serviceTypeId", "code name")
        .lean(),
      this.model.countDocuments(query),
    ]);
    return { items, total };
  }

  /**
   * Bang gia dang hieu luc tai thoi diem `at`:
   * isActive, effectiveFrom <= at, effectiveTo trong hoac > at.
   */
  findEffectiveAt(at) {
    return this.model
      .find({
        isActive: true,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
      })
      .select("serviceTypeId zone weightTiers effectiveFrom effectiveTo")
      .populate("serviceTypeId", "code name surchargeRate")
      .sort({ zone: 1 })
      .lean();
  }
}
