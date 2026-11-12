import { BaseRepository } from "../../core/BaseRepository.js";
import { Shift } from "../../models/Shift.js";
import "../../models/Route.js";
import "../../models/User.js";

export class ShiftRepository extends BaseRepository {
  constructor() {
    super(Shift, { defaultSort: { shiftDate: 1, startTime: 1 } });
  }

  /** Ca kem ten tuyen va nguoi giao hang (man hinh quan ly ca). */
  findWithPeople(filters) {
    return this.model
      .find(filters)
      .sort(this.defaultSort)
      .populate("routeId", "code name")
      .populate("shipperIds", "fullName phone")
      .lean();
  }

  /** Ca con mo cua tuyen trong ngay (gio ket thuc sau `time`), som nhat truoc - phan cong US-25. */
  findOpen({ routeId, shiftDate, time, shipperId }) {
    return this.model
      .find({ routeId, shiftDate, endTime: { $gt: time }, ...(shipperId && { shipperIds: shipperId }) })
      .sort({ startTime: 1 })
      .lean();
  }

  /** Giu khoa ca trong transaction (xem Shift.assignSeq). */
  lock(id, { session }) {
    return this.model.updateOne({ _id: id }, { $inc: { assignSeq: 1 } }, { session });
  }

  /** Ca kem nguoi giao hang - ho tro mot hoac nhieu tuyen (bang phan cong US-25, ca cua toi US-27). */
  findForRoutes({ routeIds, shiftDate, shipperId }) {
    return this.findWithPeople({
      shiftDate,
      ...(routeIds && { routeId: { $in: routeIds } }),
      ...(shipperId && { shipperIds: shipperId }),
    });
  }

  /** Ca khac cung ngay co chung nguoi giao hang va trung khung gio [startTime, endTime). */
  findOverlap({ shiftDate, startTime, endTime, shipperIds, excludeId }) {
    return this.model
      .findOne({
        shiftDate,
        shipperIds: { $in: shipperIds },
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
        ...(excludeId && { _id: { $ne: excludeId } }),
      })
      .lean();
  }
}
