import { Setting } from "../../models/Setting.js";

/** Cau hinh he thong (collection ky thuat `settings`, _id = ten cau hinh). */
export class SettingRepository {
  get(name) {
    return Setting.findById(name).lean();
  }

  set(name, data) {
    return Setting.findOneAndUpdate({ _id: name }, { $set: data }, { upsert: true, new: true }).lean();
  }
}
