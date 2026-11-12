import { ErrorCodes } from "../../core/errors.js";
import { locateArea } from "../serviceAreas/locateArea.js";
import { calcZone, calculate, unavailableReason, ZONE_LABELS } from "./pricing.js";
import { distanceBetween } from "../adminUnits/distance.js";
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
  async locate({ province, ward }, side, { session } = {}) {
    return locateArea(
      this.serviceAreaRepository,
      { province, ward },
      (place) => `Nơi ${side} (${place.ward}, ${place.province}) chưa thuộc vùng phục vụ`,
      { session },
    );
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
    const reason = unavailableReason(serviceType, pickupArea, receiverArea);
    if (reason) throw ErrorCodes.SERVICE_NOT_AVAILABLE(reason);
    const zone = calcZone(pickupArea, receiverArea);
    const priceTable = await this.priceTableRepository.findEffective(serviceType._id, zone, at, { session });
    if (!priceTable) {
      throw ErrorCodes.PRICE_NOT_AVAILABLE(`Chưa có bảng giá ${serviceType.name} cho tuyến ${ZONE_LABELS[zone]}`);
    }
    const distance = distanceBetween(pickupArea, receiverArea);
    return { zone, priceTableId: priceTable._id, distanceKm: distance?.km ?? null, ...calculate({ item, flags, serviceType, priceTable }) };
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

    // Dich vu khong ap dung (giao nhanh lien tinh) van liet ke, kem ly do, de khach biet vi sao khong chon duoc
    const quotes = await Promise.all(
      serviceTypes.map(async (serviceType) => {
        const reason = unavailableReason(serviceType, pickupArea, receiverArea);
        if (reason) return { serviceType, reason };
        return { serviceType, quote: await this.quote({ pickupArea, receiverArea, item: data.item, flags: data.flags, serviceType }) };
      }),
    );
    const available = quotes.filter((q) => q.quote);
    if (!available.length) throw ErrorCodes.SERVICE_NOT_AVAILABLE(quotes[0]?.reason);
    const [first] = available;
    const distance = distanceBetween(pickupArea, receiverArea);
    const place = ({ province, ward, region }) => ({ province, ward, region });
    return {
      zone: first.quote.zone,
      zoneLabel: ZONE_LABELS[first.quote.zone],
      // Duong chim bay giua tam hai xa/phuong; approx = co dau chua co toa do, tinh theo tam tinh
      distanceKm: distance?.km ?? null,
      distanceApprox: distance?.approx ?? false,
      pickupArea: place(pickupArea),
      receiverArea: place(receiverArea),
      chargeableWeight: first.quote.chargeableWeight,
      volumetricWeight: first.quote.volumetricWeight,
      flags: first.quote.flags,
      options: quotes.map(({ serviceType, quote, reason }) => ({
        serviceTypeId: serviceType._id,
        code: serviceType.code,
        name: serviceType.name,
        estimatedDays: serviceType.estimatedDays,
        available: !reason,
        reason: reason ?? null,
        fee: quote?.fee ?? null,
      })),
    };
  }
}
