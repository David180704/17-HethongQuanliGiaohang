import { ErrorCodes } from "../../core/errors.js";
import { shiftValidator, parseShiftDate } from "./shifts.validator.js";

const pad = (n) => String(n).padStart(2, "0");
/** Ngay theo gio Viet Nam "YYYYMMDD" de dat ma ca. */
function vnDay(date) {
  const d = new Date(date.getTime() + 7 * 3600e3);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/**
 * Ca lam viec (US-23): moi ca thuoc mot tuyen, mot ngay, mot khung gio, gan cac nguoi giao hang phu trach
 * tuyen do. Nhan vien kho chi quan ly ca cua cac tuyen thuoc hub minh va buu cuc truc thuoc; quan tri
 * vien quan ly tat ca. Mot nguoi khong duoc o hai ca trung gio trong cung ngay.
 * Doc tuyen / nguoi dung qua repository KHONG cache (rang buoc can so lieu moi nhat).
 */
export class ShiftService {
  constructor({ shiftRepository, routeRepository, userRepository, hubRepository, validator = shiftValidator }) {
    Object.assign(this, { shiftRepository, routeRepository, userRepository, hubRepository, validator });
  }

  /** Cac tuyen nguoi dung duoc quan ly; null = moi tuyen (quan tri vien). */
  async #routeScope(user) {
    if (user.role === "ADMIN") return null;
    const staff = await this.userRepository.findById(user.id);
    if (!staff?.hubId) return [];
    const hubIds = await this.hubRepository.findFamilyIds(staff.hubId);
    const routes = await this.routeRepository.findByHubs(hubIds);
    return routes.map((r) => String(r._id));
  }

  async #assertRoute(user, routeId) {
    const scope = await this.#routeScope(user);
    if (scope && !scope.includes(String(routeId))) throw ErrorCodes.NOT_FOUND("Không tìm thấy tuyến thuộc điểm của bạn");
    const route = await this.routeRepository.findById(routeId);
    if (!route || route.isActive === false) throw ErrorCodes.NOT_FOUND("Tuyến không tồn tại hoặc đã ngừng");
    return route;
  }

  async #assertShippers(route, data, excludeId) {
    if (!data.shipperIds.length) return;
    const shippers = await this.userRepository.findActiveShippers({ ids: data.shipperIds });
    if (shippers.length !== data.shipperIds.length) {
      throw ErrorCodes.VALIDATION_ERROR("Có người không phải người giao hàng đang hoạt động");
    }
    const outside = shippers.filter((s) => !(s.routeIds || []).some((id) => String(id) === String(route._id)));
    if (outside.length) {
      throw ErrorCodes.VALIDATION_ERROR(`${outside.map((s) => s.fullName).join(", ")} không phụ trách tuyến ${route.code}`);
    }
    const clash = await this.shiftRepository.findOverlap({ ...data, excludeId });
    if (clash) {
      const busy = shippers.filter((s) => clash.shipperIds.some((id) => String(id) === String(s._id)));
      throw ErrorCodes.CONFLICT(
        `${busy.map((s) => s.fullName).join(", ")} đã có ca "${clash.name}" ${clash.startTime}–${clash.endTime} cùng ngày`,
      );
    }
  }

  /** Danh sach ca theo ngay (mac dinh hom nay) va tuyen. */
  async list(user, query = {}) {
    const scope = await this.#routeScope(user);
    const filters = {};
    if (query.date) filters.shiftDate = parseShiftDate(query.date);
    if (query.routeId) {
      if (scope && !scope.includes(String(query.routeId))) return [];
      filters.routeId = query.routeId;
    } else if (scope) {
      filters.routeId = { $in: scope };
    }
    return this.shiftRepository.findWithPeople(filters);
  }

  /** Ca cua chinh nguoi giao hang trong mot ngay (mac dinh hom nay theo gio Viet Nam). */
  async mine(user, query = {}) {
    if (user.role !== "SHIPPER") throw ErrorCodes.FORBIDDEN("Chỉ người giao hàng xem ca của mình");
    const date = query.date || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    return this.shiftRepository.findWithPeople({ shiftDate: parseShiftDate(date), shipperIds: user.id });
  }

  /** Lua chon cho form: tuyen trong pham vi va nguoi giao hang dang phu trach tung tuyen. */
  async options(user) {
    const scope = await this.#routeScope(user);
    const routes = await this.routeRepository.findActive(scope);
    const shippers = await this.userRepository.findActiveShippers({ routeIds: routes.map((r) => r._id) });
    return {
      routes: routes.map((r) => ({
        _id: r._id,
        code: r.code,
        name: r.name,
        shippers: shippers
          .filter((s) => s.routeIds.some((id) => String(id) === String(r._id)))
          .map(({ _id, fullName, phone }) => ({ _id, fullName, phone })),
      })),
    };
  }

  async create(user, input) {
    const data = this.validator.create(input);
    const route = await this.#assertRoute(user, data.routeId);
    await this.#assertShippers(route, data);
    const code = `${route.code}-${vnDay(data.shiftDate)}-${data.startTime.replace(":", "")}`;
    if (await this.shiftRepository.exists({ code })) {
      throw ErrorCodes.CONFLICT(`Tuyến ${route.code} đã có ca bắt đầu ${data.startTime} ngày này`);
    }
    const created = await this.shiftRepository.create({ ...data, code });
    return this.shiftRepository.findWithPeople({ _id: created._id }).then(([shift]) => shift);
  }

  async update(user, id, input) {
    const current = await this.#findInScope(user, id);
    const data = this.validator.update({
      routeId: String(current.routeId),
      name: current.name,
      startTime: current.startTime,
      endTime: current.endTime,
      shiftDate: new Date(current.shiftDate.getTime() + 7 * 3600e3).toISOString().slice(0, 10),
      shipperIds: current.shipperIds.map(String),
      ...input,
    });
    const route = await this.#assertRoute(user, data.routeId);
    await this.#assertShippers(route, data, current._id);
    await this.shiftRepository.updateById(id, data);
    return this.shiftRepository.findWithPeople({ _id: current._id }).then(([shift]) => shift);
  }

  async remove(user, id) {
    await this.#findInScope(user, id);
    await this.shiftRepository.deleteById(id);
  }

  async #findInScope(user, id) {
    const shift = await this.shiftRepository.findById(id);
    const scope = shift ? await this.#routeScope(user) : null;
    if (!shift || (scope && !scope.includes(String(shift.routeId)))) throw ErrorCodes.NOT_FOUND("Không tìm thấy ca làm việc");
    return shift;
  }
}
