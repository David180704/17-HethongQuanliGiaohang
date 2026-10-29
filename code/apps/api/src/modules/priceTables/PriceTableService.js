import { BaseCrudService } from "../../core/BaseCrudService.js";
import { ErrorCodes } from "../../core/errors.js";
import { priceTableValidator } from "./priceTables.validator.js";

/**
 * Bang gia (US-13). Rang buoc rieng ngoai validator:
 *  - hai bang gia cung serviceTypeId + zone khong trung khoang hieu luc
 *  - bang gia da dung cho don hang: khong xoa, khong sua bac/ngay bat dau, chi lui effectiveTo
 * Kiem tra rang buoc doc thang CSDL (khong qua cache) de luon thay du lieu moi nhat.
 */
export class PriceTableService extends BaseCrudService {
  /**
   * @param {object} deps
   * @param {object} deps.repository             repository co cache cho man hinh quan tri
   * @param {object} deps.priceTableRepository   ban doc thang CSDL
   * @param {{ exists(filter): Promise<boolean> }} deps.serviceTypeRepository
   * @param {{ exists(filter): Promise<boolean> }} deps.orderRepository
   */
  constructor({ repository, priceTableRepository, serviceTypeRepository, orderRepository, events }) {
    super({
      resource: "priceTables",
      repository,
      validator: priceTableValidator,
      events,
      filterFields: ["serviceTypeId", "zone", "isActive"],
    });
    this.priceTableRepository = priceTableRepository;
    this.serviceTypeRepository = serviceTypeRepository;
    this.orderRepository = orderRepository;
  }

  async beforeCreate(data) {
    if (!(await this.serviceTypeRepository.exists({ _id: data.serviceTypeId }))) {
      throw ErrorCodes.VALIDATION_ERROR("Loại dịch vụ không tồn tại");
    }
    await this.assertNoOverlap(data);
  }

  async beforeUpdate(id, data) {
    const current = await this.priceTableRepository.findById(id);
    if (!current) throw ErrorCodes.NOT_FOUND();
    const next = { ...current, ...data };
    if (next.effectiveTo && next.effectiveTo <= next.effectiveFrom) {
      throw ErrorCodes.VALIDATION_ERROR("effectiveTo phải sau effectiveFrom");
    }
    if (await this.isUsed(current)) {
      const tiersChanged =
        data.weightTiers !== undefined && JSON.stringify(data.weightTiers) !== JSON.stringify(current.weightTiers);
      const fromChanged =
        data.effectiveFrom !== undefined && new Date(data.effectiveFrom).getTime() !== new Date(current.effectiveFrom).getTime();
      const changesHistory = tiersChanged || fromChanged;
      const extendsEnd =
        data.effectiveTo !== undefined &&
        (data.effectiveTo === null || (current.effectiveTo && data.effectiveTo > current.effectiveTo));
      if (changesHistory || extendsEnd) {
        throw ErrorCodes.CONFLICT("Bảng giá đã dùng cho đơn hàng: chỉ được lùi ngày hết hiệu lực (effectiveTo)");
      }
    }
    await this.assertNoOverlap(next, id);
  }

  async beforeDelete(item) {
    if (await this.isUsed(item)) {
      throw ErrorCodes.CONFLICT("Bảng giá đã dùng cho đơn hàng, không xóa được — hãy lùi ngày hết hiệu lực");
    }
  }

  // Khoang [from, to) giao nhau khi from_A < to_B va from_B < to_A (to = null la vo han)
  async assertNoOverlap({ serviceTypeId, zone, effectiveFrom, effectiveTo }, excludeId) {
    const filter = {
      serviceTypeId,
      zone,
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: effectiveFrom } }],
    };
    if (effectiveTo) filter.effectiveFrom = { $lt: effectiveTo };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await this.priceTableRepository.exists(filter)) {
      throw ErrorCodes.CONFLICT("Trùng khoảng hiệu lực với một bảng giá khác cùng dịch vụ và vùng");
    }
  }

  // Don hang khong luu id bang gia: coi bang gia da dung khi co don cung loai dich vu tao
  // trong khoang hieu luc cua no (cach hieu than trong, khong xoa nham bang dang dung).
  isUsed({ serviceTypeId, effectiveFrom, effectiveTo }) {
    const createdAt = { $gte: effectiveFrom };
    if (effectiveTo) createdAt.$lt = effectiveTo;
    return this.orderRepository.exists({ serviceTypeId, createdAt });
  }
}
