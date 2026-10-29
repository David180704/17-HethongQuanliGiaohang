import { BaseRepository } from "../../core/BaseRepository.js";
import { OrderDraft, DRAFT_TTL_SECONDS } from "../../models/OrderDraft.js";

export class OrderDraftRepository extends BaseRepository {
  constructor() {
    super(OrderDraft);
  }

  // TTL index chi quet ~60 giay/lan: nhap qua 24 gio ma chua bi xoa van coi nhu het han
  findLive(draftToken, { session } = {}) {
    const bornAfter = new Date(Date.now() - DRAFT_TTL_SECONDS * 1000);
    return this.model
      .findOne({ draftToken, createdAt: { $gt: bornAfter } })
      .session(session ?? null)
      .lean();
  }

  /** Tao don tu nhap xong thi xoa nhap - chay trong transaction tao don (US-18). */
  async consume(draftToken, customerId, { session }) {
    const draft = await this.findLive(draftToken, { session });
    if (!draft || (draft.customerId && String(draft.customerId) !== String(customerId))) return false;
    await this.model.deleteOne({ _id: draft._id }, { session });
    return true;
  }

  expiresAt(draft) {
    return new Date(new Date(draft.createdAt).getTime() + DRAFT_TTL_SECONDS * 1000);
  }
}
