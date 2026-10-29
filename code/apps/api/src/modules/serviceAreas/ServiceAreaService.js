import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { serviceAreaValidator } from "./serviceAreas.validator.js";

// Khu vuc phuc vu (US-11): mot quan/huyen chi thuoc DUNG MOT tuyen.
export class ServiceAreaService extends BaseCrudService {
  constructor({ repository, events }) {
    super({
      resource: "serviceAreas",
      repository,
      validator: serviceAreaValidator,
      events,
      filterFields: ["region", "province", "routeId"],
    });
  }

  // Chan som bang thong bao ro nghia; unique index (province + district) trong
  // model van la lop phong ngu cuoi neu 2 request trung den cung luc.
  async beforeCreate(data) {
    if (await this.repository.exists({ province: data.province, district: data.district })) {
      throw ErrorCodes.CONFLICT("Quận/huyện này đã thuộc một tuyến khác");
    }
  }
}
