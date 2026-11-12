import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { routeValidator } from "./routes.validator.js";

// Tuyen (US-11): hub quan ly phai la diem co that trong danh muc Hub (US-14) -
// truoc day nhap tay ObjectId nen go sai van luu duoc.
export class RouteService extends BaseCrudService {
  constructor({ repository, hubRepository, events }) {
    super({ resource: "routes", repository, validator: routeValidator, events, filterFields: ["hubId", "isActive"] });
    this.hubRepository = hubRepository;
  }

  async beforeCreate(data) {
    await this.#assertHub(data.hubId);
  }

  async beforeUpdate(_id, data) {
    if (data.hubId !== undefined) await this.#assertHub(data.hubId);
  }

  async #assertHub(hubId) {
    if (!(await this.hubRepository.exists({ _id: hubId }))) {
      throw ErrorCodes.VALIDATION_ERROR("Hub quản lý không tồn tại");
    }
  }
}
