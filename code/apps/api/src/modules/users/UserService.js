import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { userValidator } from "./users.validator.js";

// Quan ly nguoi dung (US-10): tao tai khoan, doi vai tro, khoa/mo. Khong cho xoa
// vi se mo coi du lieu dang tham chieu (orders.customerId, assignments.shipperId...).
export class UserService extends BaseCrudService {
  /**
   * @param {{ repository: object, passwordHasher: { hash(plain): Promise<string> }, events?: object,
   *   hubRepository?: { exists(filter): Promise<boolean> } }} deps
   */
  constructor({ repository, passwordHasher, events, hubRepository }) {
    super({
      resource: "users",
      repository,
      validator: userValidator,
      events,
      filterFields: ["role", "status", "customerType", "hubId"],
      allowDelete: false,
    });
    this.passwordHasher = passwordHasher;
    this.hubRepository = hubRepository;
  }

  async beforeCreate(data) {
    await this.#assertHub(data.hubId);
    await this.#hashPassword(data);
  }

  async beforeUpdate(_id, data) {
    await this.#assertHub(data.hubId);
    await this.#hashPassword(data);
  }

  // Hub phu trach cua HUB_STAFF chon tu danh muc Hub (US-14), khong nhan ObjectId go tay sai
  async #assertHub(hubId) {
    if (!hubId || !this.hubRepository) return;
    if (!(await this.hubRepository.exists({ _id: hubId }))) {
      throw ErrorCodes.VALIDATION_ERROR("Hub phụ trách không tồn tại");
    }
  }

  // Khong bao gio luu mat khau tho: doi "password" thanh "passwordHash".
  async #hashPassword(data) {
    if (data.password) data.passwordHash = await this.passwordHasher.hash(data.password);
    delete data.password;
  }
}
