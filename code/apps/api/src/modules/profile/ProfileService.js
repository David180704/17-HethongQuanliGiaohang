import { ErrorCodes } from "../../core/errors.js";
import { parseBankAccount } from "./bankAccount.js";

/**
 * Ho so khach hang - tai khoan ngan hang nhan tien thu ho (US-42, PB#12). Doi soat (Sprint 7) chuyen tien vao tai
 * khoan nay. Ghi xong xoa cache "users" de man hinh quan tri nguoi dung thay ngay.
 */
export class ProfileService {
  constructor({ userRepository, cache }) {
    Object.assign(this, { userRepository, cache });
  }

  #assertCustomer(user) {
    if (user.role !== "CUSTOMER") throw ErrorCodes.FORBIDDEN("Chỉ khách hàng khai báo tài khoản nhận thu hộ");
  }

  async bankAccount(user) {
    this.#assertCustomer(user);
    return (await this.userRepository.findById(user.id))?.bankAccount || null;
  }

  async saveBankAccount(user, input) {
    this.#assertCustomer(user);
    const bankAccount = parseBankAccount(input);
    await this.userRepository.updateById(user.id, { bankAccount });
    await this.cache?.invalidate("users");
    return this.bankAccount(user);
  }

  async removeBankAccount(user) {
    this.#assertCustomer(user);
    await this.userRepository.updateById(user.id, { $unset: { bankAccount: 1 } });
    await this.cache?.invalidate("users");
    return { deleted: true };
  }
}
