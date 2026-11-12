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
  constructor({ repository, passwordHasher, events, hubRepository, routeRepository, checkinPointRepository }) {
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
    this.routeRepository = routeRepository;
    this.checkinPointRepository = checkinPointRepository;
  }

  async beforeCreate(data) {
    await this.#assertHub(data.hubId);
    await this.#assertRoutesOneRegion(data.routeIds);
    await this.#assertCheckinPoint(data.checkinPointId, data.routeIds);
    await this.#hashPassword(data);
  }

  async beforeUpdate(id, data) {
    await this.#assertHub(data.hubId);
    await this.#assertRoutesOneRegion(data.routeIds);
    if (data.checkinPointId || data.routeIds) {
      const current = await this.repository.findById(id);
      await this.#assertCheckinPoint(data.checkinPointId ?? current?.checkinPointId, data.routeIds ?? current?.routeIds);
    }
    await this.#hashPassword(data);
  }

  /** Hub goc (hub cap tren neu la buu cuc) cua danh sach hub id. */
  async #roots(hubIds) {
    const hubs = await this.hubRepository.findMany({ _id: { $in: hubIds } }, { select: "name parentHubId" });
    return new Map(hubs.map((h) => [String(h._id), String(h.parentHubId || h._id)]));
  }

  /** Diem check-in dang ky phai co that, dang dung, va cung vung (hub goc) voi tuyen cua nguoi giao hang. */
  async #assertCheckinPoint(pointId, routeIds) {
    if (!pointId || !this.checkinPointRepository) return;
    const [point] = await this.checkinPointRepository.findMany({ _id: pointId }, { select: "code name hubId isActive" });
    if (!point || point.isActive === false) throw ErrorCodes.VALIDATION_ERROR("Điểm check-in không tồn tại hoặc đã ngừng");
    if (!point.hubId || !Array.isArray(routeIds) || routeIds.length === 0) return;
    const routes = await this.routeRepository.findMany({ _id: { $in: routeIds } }, { select: "code hubId" });
    const roots = await this.#roots([point.hubId, ...routes.map((r) => r.hubId)]);
    const pointRoot = roots.get(String(point.hubId));
    if (routes.some((r) => roots.get(String(r.hubId)) !== pointRoot)) {
      throw ErrorCodes.VALIDATION_ERROR(`Điểm check-in ${point.name} không cùng vùng với tuyến của người giao hàng`);
    }
  }

  /**
   * Nguoi giao hang chi phu trach cac tuyen cung mot hub goc (hub + buu cuc truc thuoc) - tranh shipper Ha Noi
   * duoc xep ca / phan cong o Sai Gon (yeu cau 12/11/2026). Ca lam viec va phan cong da bat shipper phai phu
   * trach tuyen, nen chan tu goc o day la du.
   */
  async #assertRoutesOneRegion(routeIds) {
    if (!Array.isArray(routeIds) || routeIds.length === 0 || !this.routeRepository) return;
    const routes = await this.routeRepository.findMany({ _id: { $in: routeIds } }, { select: "code hubId" });
    if (routes.length !== new Set(routeIds.map(String)).size) throw ErrorCodes.VALIDATION_ERROR("Có tuyến không tồn tại");
    const hubs = await this.hubRepository.findMany({ _id: { $in: routes.map((r) => r.hubId) } }, { select: "name parentHubId" });
    const hubById = new Map(hubs.map((h) => [String(h._id), h]));
    const rootOf = (route) => {
      const hub = hubById.get(String(route.hubId));
      return String(hub?.parentHubId || hub?._id || route.hubId);
    };
    const roots = new Set(routes.map(rootOf));
    if (roots.size > 1) {
      const rootNames = await this.hubRepository.findMany({ _id: { $in: [...roots] } }, { select: "name" });
      const nameOf = new Map(rootNames.map((h) => [String(h._id), h.name]));
      const detail = routes.map((r) => `${r.code} (${nameOf.get(rootOf(r)) || "?"})`).join(", ");
      throw ErrorCodes.VALIDATION_ERROR(`Người giao hàng chỉ phụ trách tuyến thuộc cùng một hub: ${detail}`);
    }
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
