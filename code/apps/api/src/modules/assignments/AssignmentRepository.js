import mongoose from "mongoose";
import { BaseRepository } from "../../core/BaseRepository.js";
import { Assignment } from "../../models/Assignment.js";

// Phan cong con chiem nang luc ca: chua lam, da xong hoac that bai (bi thay tay = CANCELLED thi tra cho)
const COUNTED = ["ASSIGNED", "DONE", "FAILED"];

export class AssignmentRepository extends BaseRepository {
  constructor() {
    super(Assignment, { defaultSort: { assignedAt: -1 } });
  }

  /**
   * Tai cua tung nguoi trong mot ca: Map shipperId -> { used, pending }. used = so phan cong tinh vao
   * nang luc; pending = so don con ASSIGNED (chua lay) - tieu chi "it don nhat".
   */
  async shiftLoads(shiftId, type, { session } = {}) {
    const rows = await this.model
      .aggregate([
        { $match: { shiftId: new mongoose.Types.ObjectId(String(shiftId)), type, status: { $in: COUNTED } } },
        {
          $group: {
            _id: "$shipperId",
            used: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ["$status", "ASSIGNED"] }, 1, 0] } },
          },
        },
      ])
      .session(session ?? null);
    return new Map(rows.map((r) => [String(r._id), { used: r.used, pending: r.pending }]));
  }

  async insert(doc, { session }) {
    const [created] = await this.model.create([doc], { session });
    return created.toObject();
  }

  /** Huy phan cong dang hieu luc cua don (dieu chinh tay). */
  cancelActive({ orderId, type, by, at }, { session }) {
    return this.model.updateMany(
      { orderId, type, status: "ASSIGNED" },
      { $set: { status: "CANCELLED", cancelledBy: by, cancelledAt: at } },
      { session },
    );
  }

  /** Ket thuc phan cong dang hieu luc cua tai xe (US-28): DONE hoac FAILED kem thoi gian, toa do, nguyen nhan. */
  finishActive({ orderId, type, shipperId }, fields, { session }) {
    return this.model.updateOne({ orderId, type, shipperId, status: "ASSIGNED" }, { $set: fields }, { session });
  }

  /** Phan cong cua mot nguoi trong ngay (US-27), moi nhat truoc. */
  findForShipper({ shipperId, shiftDate, type }) {
    return this.model
      .find({ shipperId, shiftDate, type, status: { $in: COUNTED } })
      .sort({ assignedAt: 1 })
      .lean();
  }
}
