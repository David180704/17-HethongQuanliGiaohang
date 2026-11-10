import { ErrorCodes } from "../../core/errors.js";
import { parseLocation } from "../assignments/pickupOutcome.js";
import { DEDUPE_WINDOW_MS, MANUAL_MAX_DISTANCE_M, distanceM, pointsInRange } from "./geo.js";

// Don tai xe dang cam (dang di lay / da lay / dang giao / dang hoan) - check-in ghi vao hanh trinh cac don nay
export const CARRYING_STATUSES = ["PICKUP_ASSIGNED", "PICKED_UP", "DELIVERY_ASSIGNED", "OUT_FOR_DELIVERY", "RETURNING"];
const MAX_DELAY_MS = 24 * 3600 * 1000;

/**
 * Check-in vi tri (US-30): app tai xe gui vi tri (gia lap) moi khi doi; vi tri nam trong ban kinh mot diem
 * check-in (US-29) thi ghi moc cho tung don dang cam. Cung diem + cung don chi ghi mot lan trong 30 phut.
 * Mat mang: app xep hang doi va gui lai kem thoi gian goc (at) va ma su kien (clientEventId) -> gui lai bao
 * nhieu lan cung khong ghi trung (chi muc unique). Check-in tay la du phong khi GPS lech (cach diem <= 1 km).
 */
export class CheckinService {
  constructor({ checkinPointRepository, checkinLogRepository, orderRepository, orderEvents, clock = () => new Date() }) {
    Object.assign(this, { checkinPointRepository, checkinLogRepository, orderRepository, orderEvents, clock });
  }

  activePoints() {
    return this.checkinPointRepository.findMany({ isActive: { $ne: false } }, { select: "code name address lat lng radiusM hubId", sort: { code: 1 } });
  }

  #eventTime(input) {
    const now = this.clock();
    if (!input.at) return now;
    const at = new Date(input.at);
    if (Number.isNaN(at.getTime())) throw ErrorCodes.VALIDATION_ERROR("Thời điểm check-in không hợp lệ");
    if (at.getTime() > now.getTime() + 60_000 || at.getTime() < now.getTime() - MAX_DELAY_MS) {
      throw ErrorCodes.VALIDATION_ERROR("Thời điểm check-in phải trong vòng 24 giờ qua");
    }
    return at;
  }

  async record(user, input = {}) {
    if (user.role !== "SHIPPER") throw ErrorCodes.FORBIDDEN("Chỉ người giao hàng gửi check-in");
    const position = parseLocation(input);
    const at = this.#eventTime(input);
    const clientEventId = input.clientEventId ? String(input.clientEventId).slice(0, 80) : null;
    const points = await this.activePoints();

    let matched;
    if (input.pointId) {
      const point = points.find((p) => String(p._id) === String(input.pointId));
      if (!point) throw ErrorCodes.NOT_FOUND("Không tìm thấy điểm check-in");
      const d = Math.round(distanceM(position, point));
      if (d > MANUAL_MAX_DISTANCE_M) throw ErrorCodes.VALIDATION_ERROR(`Bạn đang cách ${point.name} ${d} m — quá xa để check-in tay`);
      matched = [{ point, distanceM: d }];
    } else {
      matched = pointsInRange(position, points);
    }
    const source = input.pointId ? "MANUAL" : "AUTO";
    const orders = matched.length
      ? await this.orderRepository.findMany({ assignedTo: user.id, status: { $in: CARRYING_STATUSES } }, { select: "trackingCode status" })
      : [];

    let recorded = 0;
    let duplicates = 0;
    const touched = new Map();
    for (const { point } of matched) {
      for (const order of orders) {
        const recent = await this.checkinLogRepository.exists({
          orderId: order._id,
          pointId: point._id,
          at: { $gt: new Date(at.getTime() - DEDUPE_WINDOW_MS), $lt: new Date(at.getTime() + DEDUPE_WINDOW_MS) },
        });
        if (recent) {
          duplicates += 1;
          continue;
        }
        const inserted = await this.checkinLogRepository.insertOnce({
          pointId: point._id,
          orderId: order._id,
          shipperId: user.id,
          at,
          lat: position.lat,
          lng: position.lng,
          source,
          clientEventId,
        });
        if (inserted) {
          recorded += 1;
          touched.set(String(order._id), order);
        } else {
          duplicates += 1;
        }
      }
    }
    for (const order of touched.values()) await this.#publish(order);
    return {
      at,
      source,
      matched: matched.map(({ point, distanceM: d }) => ({ _id: point._id, code: point.code, name: point.name, distanceM: d })),
      orders: orders.length,
      recorded,
      duplicates,
    };
  }

  /** Moc check-in cua mot don (chi tiet don, hanh trinh cong khai). */
  async forOrder(orderId) {
    const logs = await this.checkinLogRepository.findMany({ orderId }, { sort: { at: 1 } });
    if (!logs.length) return [];
    const points = await this.checkinPointRepository.findMany({ _id: { $in: logs.map((l) => l.pointId) } }, { select: "code name" });
    const byId = new Map(points.map((p) => [String(p._id), p]));
    return logs.map((l) => ({ at: l.at, source: l.source, point: byId.get(String(l.pointId)) || null }));
  }

  async #publish(order) {
    if (!this.orderEvents) return;
    try {
      await this.orderEvents.publish("order.checkin.recorded", { orderId: String(order._id), trackingCode: order.trackingCode });
    } catch (err) {
      console.error(`Khong phat duoc su kien check-in don ${order.trackingCode}:`, err.message);
    }
  }
}
