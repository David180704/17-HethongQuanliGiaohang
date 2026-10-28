import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { serviceTypeValidator } from "./serviceTypes.validator.js";

// Loai dich vu (US-12). Rang buoc rieng: khong xoa loai dang duoc bang gia dung.
export class ServiceTypeService extends BaseCrudService {
  /** @param {{ repository: object, priceTableRepository: { exists(filter): Promise<boolean> }, events?: object }} deps */
  constructor({ repository, priceTableRepository, events }) {
    super({
      resource: "serviceTypes",
      repository,
      validator: serviceTypeValidator,
      events,
      filterFields: ["code", "isActive"],
    });
    this.priceTableRepository = priceTableRepository;
  }

  async beforeDelete(item) {
    if (await this.priceTableRepository.exists({ serviceTypeId: item._id })) {
      throw ErrorCodes.CONFLICT("Loại dịch vụ đang được dùng trong bảng giá, không thể xóa");
    }
  }
}
