import { BaseRepository } from "../../core/BaseRepository.js";
import { User } from "../../models/User.js";
// Dang ky model cho populate("hubId"/"routeIds") o findProfile - thieu 2 dong nay
// thi /auth/me loi MissingSchemaError (da gap tren server that).
import "../../models/Hub.js";
import "../../models/Route.js";

// Mac dinh an passwordHash o moi truy van (projection). Rieng dang nhap can
// passwordHash de so mat khau -> co ham rieng, khong dung chung findOne.
export class UserRepository extends BaseRepository {
  constructor() {
    super(User, { searchFields: ["email", "phone", "fullName"], projection: "-passwordHash" });
  }

  /** Co passwordHash - CHI dung cho dang nhap. */
  findForLogin(identifier) {
    return this.model.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: identifier }] }).lean();
  }

  existsByEmail(email) {
    return this.exists({ email: email.toLowerCase() });
  }

  existsByPhone(phone) {
    return this.exists({ phone });
  }

  /** Ho so day du, kem ten hub/tuyen de App Nhan vien hien thi ma khong goi them API. */
  findProfile(id) {
    return this.model
      .findById(id)
      .select(this.projection)
      .populate("hubId", "code name")
      .populate("routeIds", "code name")
      .lean();
  }
}
