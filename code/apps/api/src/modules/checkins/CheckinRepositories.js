import { BaseRepository } from "../../core/BaseRepository.js";
import { CheckinPoint } from "../../models/CheckinPoint.js";
import { CheckinLog } from "../../models/CheckinLog.js";

export class CheckinPointRepository extends BaseRepository {
  constructor() {
    super(CheckinPoint, { searchFields: ["code", "name", "address"], defaultSort: { code: 1 } });
  }
}

export class CheckinLogRepository extends BaseRepository {
  constructor() {
    super(CheckinLog, { defaultSort: { at: -1 } });
  }

  /** Them moc; trung chi muc unique (gui lai cung ma su kien) thi tra null thay vi loi. */
  async insertOnce(doc) {
    try {
      return (await this.model.create(doc)).toObject();
    } catch (err) {
      if (err?.code === 11000) return null;
      throw err;
    }
  }
}
