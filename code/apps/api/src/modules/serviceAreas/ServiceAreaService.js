import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { serviceAreaValidator } from "./serviceAreas.validator.js";

// Khu vuc phuc vu (US-11): mot xa/phuong chi thuoc DUNG MOT tuyen.
export class ServiceAreaService extends BaseCrudService {
  /** hubRepository, pickupLocationRepository: chan xoa khu vuc con diem tap ket (US-14), dia diem lay hang (US-15). */
  constructor({ repository, events, hubRepository, pickupLocationRepository }) {
    super({
      resource: "serviceAreas",
      repository,
      validator: serviceAreaValidator,
      events,
      filterFields: ["region", "province", "routeId"],
    });
    this.hubRepository = hubRepository;
    this.pickupLocationRepository = pickupLocationRepository;
  }

  // Chan som bang thong bao ro nghia; unique index (province + ward) trong
  // model van la lop phong ngu cuoi neu 2 request trung den cung luc.
  async beforeCreate(data) {
    if (await this.repository.exists({ province: data.province, ward: data.ward })) {
      throw ErrorCodes.CONFLICT(`${data.ward}, ${data.province} đã thuộc một tuyến khác`);
    }
  }

  async beforeDelete(area) {
    if (this.hubRepository && (await this.hubRepository.exists({ serviceAreaId: area._id }))) {
      throw ErrorCodes.CONFLICT(`${area.ward} còn điểm tập kết/bưu cục nên không xóa được khỏi vùng phục vụ`);
    }
    if (
      this.pickupLocationRepository &&
      (await this.pickupLocationRepository.exists({ serviceAreaId: area._id, isActive: true }))
    ) {
      throw ErrorCodes.CONFLICT(`${area.ward} còn địa điểm lấy hàng của khách nên không xóa được khỏi vùng phục vụ`);
    }
  }
}
