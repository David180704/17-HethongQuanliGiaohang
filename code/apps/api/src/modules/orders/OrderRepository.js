import { BaseRepository } from "../../core/BaseRepository.js";
import { Order } from "../../models/Order.js";

export class OrderRepository extends BaseRepository {
  constructor() {
    super(Order, { searchFields: ["trackingCode", "shopOrderCode", "receiver.name", "receiver.phone"] });
  }

  /** Them don trong transaction (Model.create can mang khi truyen session). */
  async insert(doc, { session }) {
    const [created] = await this.model.create([doc], { session });
    return created.toObject();
  }

  /** So trong ma van don lon nhat dang co (ma EXP + 10 chu so sap theo chu = theo so). */
  async maxTrackingNumber({ session } = {}) {
    const last = await this.model
      .findOne({ trackingCode: /^EXP\d{10}$/ })
      .sort({ trackingCode: -1 })
      .select("trackingCode")
      .session(session ?? null)
      .lean();
    return last ? Number(last.trackingCode.slice(3)) : 999_999_999;
  }

  /** Cap nhat co dieu kien trong transaction (phan cong US-25); null = don da doi trang thai. */
  updateWhere(filter, update, { session } = {}) {
    return this.model.findOneAndUpdate(filter, update, { new: true, session: session ?? null }).lean();
  }

  /** Doi trang thai CO DIEU KIEN: hai nguoi cung bam thi chi mot nguoi thanh cong. */
  transition(id, fromStatus, update) {
    return this.model.findOneAndUpdate({ _id: id, status: fromStatus }, update, { new: true }).lean();
  }
}
