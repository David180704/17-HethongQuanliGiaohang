import { BaseRepository } from "../../core/BaseRepository.js";
import { PickupLocation } from "../../models/PickupLocation.js";

// Moi truy van deu kem customerId: khach chi thay / sua dia diem cua chinh minh.
// Dia diem da xoa (isActive=false) van giu lai cho don cu tro toi.
export class PickupLocationRepository extends BaseRepository {
  constructor() {
    super(PickupLocation, { defaultSort: { isDefault: -1, createdAt: -1 } });
  }

  listActive(customerId) {
    return this.model.find({ customerId, isActive: true }).sort(this.defaultSort).lean();
  }

  countActive(customerId) {
    return this.model.countDocuments({ customerId, isActive: true });
  }

  findActiveOwned(customerId, id) {
    return this.model.findOne({ _id: id, customerId, isActive: true }).lean();
  }

  newestActive(customerId) {
    return this.model.findOne({ customerId, isActive: true }).sort({ createdAt: -1 }).lean();
  }

  /** Bo co mac dinh o moi dia diem khac cua khach (moi khach chi mot dia diem mac dinh). */
  clearDefault(customerId, exceptId) {
    return this.model.updateMany({ customerId, _id: { $ne: exceptId }, isDefault: true }, { isDefault: false });
  }
}
