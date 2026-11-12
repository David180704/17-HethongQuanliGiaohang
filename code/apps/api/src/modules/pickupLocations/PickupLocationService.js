import { ErrorCodes } from "../../core/errors.js";
import { locateArea } from "../serviceAreas/locateArea.js";
import { FINISHED_ORDER_STATUS } from "../../constants/enums.js";
import { pickupLocationValidator } from "./pickupLocations.validator.js";

export const MAX_PICKUP_LOCATIONS = 10;
const ADDRESS_FIELDS = ["address", "province", "ward"];

/**
 * Dia diem lay hang cua khach hang (US-15):
 *   - toi da 10 dia diem dang dung moi khach, luon co dung mot dia diem mac dinh;
 *   - tu xac dinh khu vuc phuc vu tu tinh + xa/phuong, ngoai vung phuc vu thi chan;
 *   - con don chua hoan tat thi khong xoa, khong doi dia chi (shipper dang toi do).
 * Moi ham nhan customerId tu token: khach khong cham duoc dia diem cua nguoi khac.
 */
export class PickupLocationService {
  /**
   * @param {object} deps
   * @param {import("./PickupLocationRepository.js").PickupLocationRepository} deps.repository
   * @param {import("../serviceAreas/ServiceAreaRepository.js").ServiceAreaRepository} deps.serviceAreaRepository
   * @param {{ exists(filter): Promise<boolean> }} deps.orderRepository
   */
  constructor({ repository, serviceAreaRepository, orderRepository, validator = pickupLocationValidator }) {
    this.repository = repository;
    this.serviceAreaRepository = serviceAreaRepository;
    this.orderRepository = orderRepository;
    this.validator = validator;
  }

  list(customerId) {
    return this.repository.listActive(customerId);
  }

  async get(customerId, id) {
    const location = await this.repository.findActiveOwned(customerId, id);
    if (!location) throw ErrorCodes.NOT_FOUND("Không tìm thấy địa điểm lấy hàng");
    return location;
  }

  // Hai request tao cung luc khi dang co 9 dia diem co the vuot 10 mot chut - chap
  // nhan duoc voi thao tac tay cua mot khach, khong can transaction.
  async create(customerId, input) {
    const data = this.validator.create(input);
    const count = await this.repository.countActive(customerId);
    if (count >= MAX_PICKUP_LOCATIONS) throw ErrorCodes.PICKUP_LOCATION_LIMIT();
    Object.assign(data, await this.#locate(data));
    data.isDefault = data.isDefault || count === 0; // dia diem dau tien luon la mac dinh
    const location = await this.repository.create({ ...data, customerId, isActive: true });
    if (location.isDefault) await this.repository.clearDefault(customerId, location._id);
    return location;
  }

  async update(customerId, id, input) {
    const current = await this.get(customerId, id);
    const data = this.validator.update(input);
    if (data.isDefault === false && current.isDefault) {
      throw ErrorCodes.VALIDATION_ERROR("Luôn cần một địa điểm mặc định — hãy đặt địa điểm khác làm mặc định");
    }
    if (ADDRESS_FIELDS.some((field) => data[field] !== undefined && data[field] !== current[field])) {
      if (await this.#hasOpenOrders(id)) {
        throw ErrorCodes.CONFLICT(
          "Địa điểm đang có đơn chưa hoàn tất nên không đổi được địa chỉ — chỉ sửa tên gợi nhớ, người liên hệ",
        );
      }
      Object.assign(data, await this.#locate({ ...current, ...data }));
    }
    const location = await this.repository.updateById(id, data);
    if (data.isDefault) await this.repository.clearDefault(customerId, id);
    return location;
  }

  // Xoa mem (isActive=false): don cu van tro toi dia diem nay de xem lai lich su
  async remove(customerId, id) {
    const current = await this.get(customerId, id);
    if (await this.#hasOpenOrders(id)) {
      throw ErrorCodes.CONFLICT("Địa điểm còn đơn hàng chưa hoàn tất nên chưa xóa được");
    }
    await this.repository.updateById(id, { isActive: false, isDefault: false });
    if (current.isDefault) {
      const next = await this.repository.newestActive(customerId);
      if (next) await this.repository.updateById(next._id, { isDefault: true });
    }
  }

  #hasOpenOrders(pickupLocationId) {
    return this.orderRepository.exists({ pickupLocationId, status: { $nin: FINISHED_ORDER_STATUS } });
  }

  // Khu vuc phuc vu tu tinh + xa/phuong (xa/phuong phai thuoc dung tinh). Luu ten chuan.
  async #locate({ province, ward }) {
    const area = await locateArea(
      this.serviceAreaRepository,
      { province, ward },
      (place) => `${place.ward}, ${place.province} chưa thuộc vùng phục vụ — Express chưa lấy hàng tại đây`,
    );
    return { province: area.province, ward: area.ward, serviceAreaId: area._id };
  }
}
