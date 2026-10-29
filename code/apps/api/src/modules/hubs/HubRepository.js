import { BaseRepository } from "../../core/BaseRepository.js";
import { Hub } from "../../models/Hub.js";

export class HubRepository extends BaseRepository {
  constructor() {
    super(Hub, { searchFields: ["code", "name", "province", "district"], defaultSort: { type: 1, code: 1 } });
  }

  // Man hinh quan tri can ma/ten hub cap tren cua buu cuc ngay trong danh sach
  async findPage({ page = 1, limit = 20, search = "", filters = {} } = {}) {
    const query = this.buildQuery({ search, filters });
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort(this.defaultSort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("parentHubId", "code name")
        .lean(),
      this.model.countDocuments(query),
    ]);
    return { items, total };
  }
}
