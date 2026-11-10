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
