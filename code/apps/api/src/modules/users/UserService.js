import { BaseCrudService } from "../../core/BaseCrudService.js";
import { userValidator } from "./users.validator.js";

// Quan ly nguoi dung (US-10): tao tai khoan, doi vai tro, khoa/mo. Khong cho xoa
// vi se mo coi du lieu dang tham chieu (orders.customerId, assignments.shipperId...).
export class UserService extends BaseCrudService {
  /** @param {{ repository: object, passwordHasher: { hash(plain): Promise<string> }, events?: object }} deps */
  constructor({ repository, passwordHasher, events }) {
    super({
      resource: "users",
      repository,
      validator: userValidator,
      events,
      filterFields: ["role", "status", "customerType"],
      allowDelete: false,
    });
    this.passwordHasher = passwordHasher;
  }

  async beforeCreate(data) {
    await this.#hashPassword(data);
  }

  async beforeUpdate(_id, data) {
    await this.#hashPassword(data);
  }

  // Khong bao gio luu mat khau tho: doi "password" thanh "passwordHash".
  async #hashPassword(data) {
    if (data.password) data.passwordHash = await this.passwordHasher.hash(data.password);
    delete data.password;
  }
}
