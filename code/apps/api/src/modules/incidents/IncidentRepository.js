import { BaseRepository } from "../../core/BaseRepository.js";
import { Incident } from "../../models/Incident.js";

export class IncidentRepository extends BaseRepository {
  constructor() {
    super(Incident, { searchFields: ["code", "trackingCode", "description"] });
  }

  async insert(doc, { session }) {
    const [created] = await this.model.create([doc], { session });
    return created.toObject();
  }

  updateWhere(filter, update, { session } = {}) {
    return this.model.findOneAndUpdate(filter, update, { new: true, session: session ?? null }).lean();
  }

  /** Boi thuong da tinh vao ky doi soat (US-43). */
  markSettled(ids, settlementId, { session } = {}) {
    return this.model.updateMany({ _id: { $in: ids }, settlementId: null }, { $set: { settlementId } }, { session: session ?? null });
  }

  /** Con su co chua giai quyet cua don (tru su co dang xu ly). */
  countOpen(orderId, { exceptId, session } = {}) {
    return this.model
      .countDocuments({ orderId, status: { $ne: "RESOLVED" }, ...(exceptId && { _id: { $ne: exceptId } }) })
      .session(session ?? null);
  }
}
