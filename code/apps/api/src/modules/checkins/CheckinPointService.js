import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { checkinPointValidator } from "./checkinPoints.validator.js";

// Diem check-in (US-29): danh muc cua quan tri vien; hub (neu chon) phai co that, ma khong trung.
export class CheckinPointService extends BaseCrudService {
  constructor({ repository, hubRepository, events }) {
    super({ resource: "checkinPoints", repository, validator: checkinPointValidator, events, filterFields: ["hubId", "isActive"] });
    this.hubRepository = hubRepository;
  }

  async beforeCreate(data) {
    await this.#assertHub(data.hubId);
    if (await this.repository.exists({ code: data.code })) throw ErrorCodes.CONFLICT(`Mã điểm ${data.code} đã tồn tại`);
  }

  async beforeUpdate(id, data) {
    await this.#assertHub(data.hubId);
    if (data.code && (await this.repository.exists({ code: data.code, _id: { $ne: id } }))) {
      throw ErrorCodes.CONFLICT(`Mã điểm ${data.code} đã tồn tại`);
    }
  }

  async #assertHub(hubId) {
    if (hubId && !(await this.hubRepository.exists({ _id: hubId }))) throw ErrorCodes.VALIDATION_ERROR("Hub không tồn tại");
  }
}
