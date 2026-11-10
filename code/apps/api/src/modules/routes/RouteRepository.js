import { BaseRepository } from "../../core/BaseRepository.js";
import { Route } from "../../models/Route.js";

export class RouteRepository extends BaseRepository {
  constructor() {
    super(Route, { searchFields: ["code", "name"] });
  }

  /** Tuyen do cac hub (va buu cuc) quan ly - pham vi ca lam viec cua nhan vien kho (US-23). */
  findByHubs(hubIds) {
    return this.model.find({ hubId: { $in: hubIds } }).select("code name hubId isActive").sort({ code: 1 }).lean();
  }

  /** Tuyen dang hoat dong, loc theo danh sach id (null = moi tuyen). */
  findActive(ids = null) {
    return this.model
      .find({ isActive: { $ne: false }, ...(ids && { _id: { $in: ids } }) })
      .select("code name hubId maxPickupPerShift maxDeliveryPerShift")
      .sort({ code: 1 })
      .lean();
  }
}
