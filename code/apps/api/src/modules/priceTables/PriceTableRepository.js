import { BaseRepository } from "../../core/BaseRepository.js";
import { PriceTable } from "../../models/PriceTable.js";
// Dang ky model cho populate("serviceTypeId")
import "../../models/ServiceType.js";

export class PriceTableRepository extends BaseRepository {
  constructor() {
    super(PriceTable);
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
