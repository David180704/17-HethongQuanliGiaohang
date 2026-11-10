import { ErrorCodes } from "../../core/errors.js";
import { routeScopeFor } from "../routes/routeScope.js";
import { DEFAULT_CAPACITY, effectiveCapacity, parseCapacityInput } from "./capacity.js";

export const CAPACITY_SETTING = "capacity";

/**
 * Nang luc toi da moi ca (US-24), 3 cap uu tien: rieng nguoi giao hang -> tuyen -> mac dinh he thong.
 * - Mac dinh he thong: chi quan tri vien doi (collection ky thuat `settings`).
 * - Tuyen va nguoi giao hang: nhan vien kho doi trong pham vi hub minh (+ buu cuc truc thuoc).
 * Phan cong tu dong (US-25) goi capacityOf() de biet con cho hay khong.
 * Doc qua repository KHONG cache; ghi xong xoa cache man hinh quan tri (users / routes).
 */
export class CapacityService {
  constructor({ settingRepository, routeRepository, userRepository, hubRepository, cache }) {
    Object.assign(this, { settingRepository, routeRepository, userRepository, hubRepository, cache });
  }

  async system() {
    const saved = await this.settingRepository.get(CAPACITY_SETTING);
    return {
      maxPickupPerShift: saved?.maxPickupPerShift ?? DEFAULT_CAPACITY.maxPickupPerShift,
      maxDeliveryPerShift: saved?.maxDeliveryPerShift ?? DEFAULT_CAPACITY.maxDeliveryPerShift,
    };
  }

  /** Nang luc hieu luc cua mot nguoi tren mot tuyen: { value, source }. */
  async capacityOf(shipper, route, kind, system) {
    return effectiveCapacity({ shipper, route, system: system ?? (await this.system()) }, kind);
  }

  /** Tong quan: mac dinh he thong + tung tuyen trong pham vi kem nguoi giao hang va nang luc hieu luc. */
  async overview(user) {
    const scope = await routeScopeFor(user, this);
    const [system, routes] = await Promise.all([this.system(), this.routeRepository.findActive(scope)]);
    const shippers = await this.userRepository.findActiveShippers({ routeIds: routes.map((r) => r._id) });
    return {
      system,
      routes: routes.map((route) => ({
        _id: route._id,
        code: route.code,
        name: route.name,
        maxPickupPerShift: route.maxPickupPerShift,
        maxDeliveryPerShift: route.maxDeliveryPerShift,
        shippers: shippers
          .filter((s) => s.routeIds.some((id) => String(id) === String(route._id)))
          .map((s) => ({
            _id: s._id,
            fullName: s.fullName,
            phone: s.phone,
            maxPickupPerShift: s.maxPickupPerShift ?? null,
            maxDeliveryPerShift: s.maxDeliveryPerShift ?? null,
            pickup: effectiveCapacity({ shipper: s, route, system }, "pickup"),
            delivery: effectiveCapacity({ shipper: s, route, system }, "delivery"),
          })),
      })),
    };
  }

  async updateSystem(user, input) {
    const data = parseCapacityInput(input);
    if (!Object.keys(data).length) throw ErrorCodes.VALIDATION_ERROR("Chưa nhập năng lực cần đổi");
    await this.settingRepository.set(CAPACITY_SETTING, { ...data, updatedBy: user.id });
    return this.system();
  }

  async updateRoute(user, routeId, input) {
    const scope = await routeScopeFor(user, this);
    if (scope && !scope.includes(String(routeId))) throw ErrorCodes.NOT_FOUND("Không tìm thấy tuyến thuộc điểm của bạn");
    const data = parseCapacityInput(input);
    if (!Object.keys(data).length) throw ErrorCodes.VALIDATION_ERROR("Chưa nhập năng lực cần đổi");
    const route = await this.routeRepository.updateById(routeId, data);
    if (!route) throw ErrorCodes.NOT_FOUND("Không tìm thấy tuyến");
    await this.cache?.invalidate("routes");
    return route;
  }

  /** Nang luc rieng cua nguoi giao hang; null = bo ghi de (dung nang luc tuyen). */
  async updateShipper(user, shipperId, input) {
    const [shipper] = await this.userRepository.findActiveShippers({ ids: [shipperId] });
    if (!shipper) throw ErrorCodes.NOT_FOUND("Không tìm thấy người giao hàng đang hoạt động");
    const scope = await routeScopeFor(user, this);
    if (scope && !shipper.routeIds.some((id) => scope.includes(String(id)))) {
      throw ErrorCodes.NOT_FOUND("Người giao hàng không thuộc tuyến của điểm bạn");
    }
    const data = parseCapacityInput(input, { allowNull: true });
    if (!Object.keys(data).length) throw ErrorCodes.VALIDATION_ERROR("Chưa nhập năng lực cần đổi");
    await this.userRepository.updateById(shipperId, data);
    await this.cache?.invalidate("users");
    const [saved] = await this.userRepository.findActiveShippers({ ids: [shipperId] });
    return saved;
  }
}
