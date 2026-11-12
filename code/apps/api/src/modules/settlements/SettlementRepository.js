import { BaseRepository } from "../../core/BaseRepository.js";
import { Settlement } from "../../models/Settlement.js";

export class SettlementRepository extends BaseRepository {
  constructor() {
    super(Settlement, { searchFields: ["code", "customerName"] });
  }

  async insert(doc, { session }) {
    const [created] = await this.model.create([doc], { session });
    return created.toObject();
  }

  updateWhere(filter, update, { session } = {}) {
    return this.model.findOneAndUpdate(filter, update, { new: true, session: session ?? null }).lean();
  }
}
