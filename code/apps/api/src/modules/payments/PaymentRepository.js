import { BaseRepository } from "../../core/BaseRepository.js";
import { Payment } from "../../models/Payment.js";

export class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment, { searchFields: ["txnRef", "trackingCode"] });
  }

  async insert(doc) {
    const created = await this.model.create(doc);
    return created.toObject();
  }

  findByTxnRef(txnRef) {
    return this.model.findOne({ txnRef }).lean();
  }

  /** Cap nhat co dieu kien (chi giao dich con PENDING) trong transaction; null = da xu ly truoc do. */
  updateWhere(filter, update, { session } = {}) {
    return this.model.findOneAndUpdate(filter, update, { new: true, session: session ?? null }).lean();
  }

  listByOrder(orderId) {
    return this.model.find({ orderId }).sort({ createdAt: -1 }).lean();
  }
}
