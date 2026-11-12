import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { hubValidator } from "./hubs.validator.js";

/**
 * Diem tap ket (HUB) va buu cuc (POST_OFFICE) - US-14.
 *   - Buu cuc truc thuoc dung mot HUB (parentHubId); HUB khong co cap tren.
 *   - Moi diem gan voi khu vuc phuc vu cua quan/huyen dat diem: quan/huyen chua
 *     phuc vu thi khong mo diem. Ten tinh/quan luu theo dung ten trong serviceAreas.
 *   - Khong xoa diem con tuyen, nhan vien hoac buu cuc truc thuoc (tat isActive thay vi xoa).
 * Rang buoc doc thang DB qua repository KHONG cache.
 */
export class HubService extends BaseCrudService {
  /**
   * @param {object} deps
   * @param {object} deps.repository              HubRepository co cache (man hinh quan tri)
   * @param {import("./HubRepository.js").HubRepository} deps.hubRepository  ban khong cache
   * @param {import("../serviceAreas/ServiceAreaRepository.js").ServiceAreaRepository} deps.serviceAreaRepository
   * @param {{ exists(filter): Promise<boolean> }} deps.routeRepository
   * @param {{ exists(filter): Promise<boolean> }} deps.userRepository
   */
  constructor({ repository, hubRepository, serviceAreaRepository, routeRepository, userRepository, events }) {
    super({
      resource: "hubs",
      repository,
      validator: hubValidator,
      events,
      filterFields: ["type", "parentHubId", "province", "isActive"],
    });
    this.hubRepository = hubRepository;
    this.serviceAreaRepository = serviceAreaRepository;
    this.routeRepository = routeRepository;
    this.userRepository = userRepository;
  }

  async beforeCreate(data) {
    if (await this.hubRepository.exists({ code: data.code })) {
      throw ErrorCodes.CONFLICT(`Mã điểm ${data.code} đã tồn tại`);
    }
    await this.#assertParent(data);
    Object.assign(data, await this.#locate(data));
  }

  async beforeUpdate(id, data) {
    const current = await this.hubRepository.findById(id);
    if (!current) throw ErrorCodes.NOT_FOUND();
    const type = data.type ?? current.type;
    // Buu cuc doi thanh hub: bo cap tren cu (form an o "cap tren" khi chon HUB)
    if (type === "HUB" && data.parentHubId === undefined) data.parentHubId = null;
    if (current.type === "HUB" && type === "POST_OFFICE" && (await this.hubRepository.exists({ parentHubId: id }))) {
      throw ErrorCodes.CONFLICT("Hub còn bưu cục trực thuộc, không chuyển thành bưu cục được");
    }
    const parentHubId = data.parentHubId !== undefined ? data.parentHubId : current.parentHubId;
    await this.#assertParent({ type, parentHubId }, id);
    if (data.province !== undefined || data.district !== undefined) {
      Object.assign(
        data,
        await this.#locate({ province: data.province ?? current.province, district: data.district ?? current.district }),
      );
    }
  }

  async beforeDelete(hub) {
    const [hasRoutes, hasStaff, hasChildren] = await Promise.all([
      this.routeRepository.exists({ hubId: hub._id }),
      this.userRepository.exists({ hubId: hub._id }),
      this.hubRepository.exists({ parentHubId: hub._id }),
    ]);
    const inUse = [hasRoutes && "tuyến", hasStaff && "nhân viên", hasChildren && "bưu cục trực thuộc"].filter(Boolean);
    if (inUse.length) {
      throw ErrorCodes.CONFLICT(
        `Điểm ${hub.code} còn ${inUse.join(", ")} nên không xóa được. Chuyển sang điểm khác hoặc tắt hoạt động.`,
      );
    }
  }

  async #assertParent({ type, parentHubId }, selfId) {
    if (type === "HUB") {
      if (parentHubId) throw ErrorCodes.VALIDATION_ERROR("Hub (điểm tập kết) không trực thuộc điểm nào");
      return;
    }
    if (!parentHubId) throw ErrorCodes.VALIDATION_ERROR("Bưu cục phải trực thuộc một hub (parentHubId)");
    if (selfId && String(parentHubId) === String(selfId)) {
      throw ErrorCodes.VALIDATION_ERROR("Bưu cục không trực thuộc chính nó");
    }
    const parent = await this.hubRepository.findById(parentHubId);
    if (!parent) throw ErrorCodes.VALIDATION_ERROR("Hub cấp trên không tồn tại");
    if (parent.type !== "HUB") {
      throw ErrorCodes.VALIDATION_ERROR(`${parent.code} là bưu cục — cấp trên của bưu cục phải là hub (điểm tập kết)`);
    }
  }

  // Quan/huyen phai thuoc vung phuc vu; luu lai ten chuan cua tinh/quan theo serviceAreas
  async #locate({ province, district }) {
    const area = await this.serviceAreaRepository.findByLocation(province, district);
    if (!area) {
      throw ErrorCodes.OUT_OF_SERVICE_AREA(
        `${district}, ${province} chưa thuộc vùng phục vụ — thêm khu vực phục vụ trước khi mở điểm`,
      );
    }
    return { province: area.province, district: area.district, serviceAreaId: area._id };
  }
}
