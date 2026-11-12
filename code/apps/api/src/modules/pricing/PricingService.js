import { ErrorCodes } from "../../core/errors.js";
import { calcZone, calculate, ZONE_LABELS } from "./pricing.js";
import { estimateValidator } from "./pricing.validator.js";

/**
 * Bao gia van chuyen tu du lieu that: tim khu vuc phuc vu hai dau, bang gia dang
 * hieu luc theo (loai dich vu, zone, thoi diem) roi goi pricing.calculate (ham thuan).
 * Doc thang DB, khong qua cache - phi phai theo bang gia moi nhat.
 */
export class PricingService {
  /**
   * @param {object} deps
   * @param {import("../serviceTypes/ServiceTypeRepository.js").ServiceTypeRepository} deps.serviceTypeRepository
   * @param {import("../priceTables/PriceTableRepository.js").PriceTableRepository} deps.priceTableRepository
   * @param {import("../serviceAreas/ServiceAreaRepository.js").ServiceAreaRepository} deps.serviceAreaRepository
   */
  constructor({ serviceTypeRepository, priceTableRepository, serviceAreaRepository }) {
    this.serviceTypeRepository = serviceTypeRepository;
    this.priceTableRepository = priceTableRepository;
    this.serviceAreaRepository = serviceAreaRepository;
  }

  /** Khu vuc phuc vu cua dia chi; side = "gửi" | "nhận" de bao loi ro dau nao ngoai vung. */
  async locate({ province, district }, side, { session } = {}) {
    const area = await this.serviceAreaRepository.findByLocation(province, district, { session });
    if (!area) {
      throw ErrorCodes.OUT_OF_SERVICE_AREA(`Nơi ${side} (${district}, ${province}) chưa thuộc vùng phục vụ`);
    }
    return area;
  }

  async activeServiceType(serviceTypeId) {
    const serviceType = await this.serviceTypeRepository.findOne({ _id: serviceTypeId, isActive: true });
    if (!serviceType) throw ErrorCodes.VALIDATION_ERROR("Loại dịch vụ không tồn tại hoặc đã ngừng");
    return serviceType;
  }

  /**
   * Bao gia MOT loai dich vu giua hai khu vuc phuc vu, theo bang gia hieu luc luc `at`.
   * @returns {{ zone, priceTableId, chargeableWeight, volumetricWeight, flags, fee }}
   */
  async quote({ pickupArea, receiverArea, item, flags, serviceType, at = new Date(), session }) {
    const zone = calcZone(pickupArea, receiverArea);
    const priceTable = await this.priceTableRepository.findEffective(serviceType._id, zone, at, { session });
    if (!priceTable) {
      throw ErrorCodes.PRICE_NOT_AVAILABLE(`Chưa có bảng giá ${serviceType.name} cho tuyến ${ZONE_LABELS[zone]}`);
    }
    return { zone, priceTableId: priceTable._id, ...calculate({ item, flags, serviceType, priceTable }) };
  }

  /**
   * Uoc tinh phi cong khai (US-16): khach vang lai nhap noi gui, noi nhan, kien hang ->
   * phi cua tung loai dich vu dang hoat dong (hoac mot loai neu gui serviceTypeId).
   */
  async estimate(input) {
    const data = estimateValidator(input);
    const [pickupArea, receiverArea] = await Promise.all([
      this.locate(data.pickup, "gửi"),
      this.locate(data.receiver, "nhận"),
    ]);
    const serviceTypes = data.serviceTypeId
      ? [await this.activeServiceType(data.serviceTypeId)]
      : await this.serviceTypeRepository.findActivePublic();

    const quotes = await Promise.all(
      serviceTypes.map(async (serviceType) => ({
        serviceType,
        quote: await this.quote({ pickupArea, receiverArea, item: data.item, flags: data.flags, serviceType }),
      })),
    );
    const [first] = quotes;
    const place = ({ province, district, region }) => ({ province, district, region });
    return {
      zone: first.quote.zone,
      zoneLabel: ZONE_LABELS[first.quote.zone],
      pickupArea: place(pickupArea),
      receiverArea: place(receiverArea),
      chargeableWeight: first.quote.chargeableWeight,
      volumetricWeight: first.quote.volumetricWeight,
      flags: first.quote.flags,
      options: quotes.map(({ serviceType, quote }) => ({
        serviceTypeId: serviceType._id,
        code: serviceType.code,
        name: serviceType.name,
        estimatedDays: serviceType.estimatedDays,
        fee: quote.fee,
      })),
    };
  }
}
