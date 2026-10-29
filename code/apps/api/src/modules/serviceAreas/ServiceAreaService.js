import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { serviceAreaValidator } from "./serviceAreas.validator.js";

// Khu vuc phuc vu (US-11): mot quan/huyen chi thuoc DUNG MOT tuyen.
export class ServiceAreaService extends BaseCrudService {
  /** hubRepository: chan xoa khu vuc con diem tap ket/buu cuc gan vao (US-14). */
  constructor({ repository, events, hubRepository }) {
    super({
      resource: "serviceAreas",
      repository,
      validator: serviceAreaValidator,
      events,
      filterFields: ["region", "province", "routeId"],
    });
    this.hubRepository = hubRepository;
  }

  // Chan som bang thong bao ro nghia; unique index (province + district) trong
  // model van la lop phong ngu cuoi neu 2 request trung den cung luc.
  async beforeCreate(data) {
    if (await this.repository.exists({ province: data.province, district: data.district })) {
      throw ErrorCodes.CONFLICT("Quận/huyện này đã thuộc một tuyến khác");
    }
  }

  async beforeDelete(area) {
    if (this.hubRepository && (await this.hubRepository.exists({ serviceAreaId: area._id }))) {
      throw ErrorCodes.CONFLICT(`${area.district} còn điểm tập kết/bưu cục nên không xóa được khỏi vùng phục vụ`);
    }
  }
}
