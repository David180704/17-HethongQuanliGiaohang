import { buildPublicJourney } from "./journey.js";

const KEY = (trackingCode) => `journey:${trackingCode}`;
const TTL_SECONDS = 30 * 24 * 3600;

// Hanh trinh cong khai (US-21): consumer cua su kien order.status.changed dung lai ban hanh trinh tu du lieu
// goc trong MongoDB roi ghi vao Redis. Luon dung lai TOAN BO tu don (khong cong don tung su kien) nen chay
// lai bao nhieu lan, theo thu tu nao cung ra cung ket qua (idempotent) - an toan khi hang doi thu lai.
export class JourneyService {
  /**
   * @param {object} deps
   * @param {import("./OrderRepository.js").OrderRepository} deps.orderRepository repository KHONG cache
   * @param {import("ioredis").Redis} deps.redis
   */
  constructor({ orderRepository, redis, checkinsOf = async () => [] }) {
    this.orderRepository = orderRepository;
    this.redis = redis;
    // Moc check-in cua don (US-30) - ham do container truyen vao, test co the thay
    this.checkinsOf = checkinsOf;
  }

  /** Handler cua su kien order.status.changed va order.checkin.recorded. */
  async project({ orderId, trackingCode }) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      // don da bi xoa (vd du lieu thu) -> bo ban hanh trinh cu, khong coi la loi de khoi thu lai vo ich
      if (trackingCode) await this.redis.del(KEY(trackingCode));
      return null;
    }
    const journey = buildPublicJourney(order, await this.checkinsOf(order._id));
    await this.redis.set(KEY(order.trackingCode), JSON.stringify(journey), "EX", TTL_SECONDS);
    return journey;
  }

  /** Doc ban hanh trinh da ghi; chua co (consumer cham, Redis bi xoa) thi dung lai tu MongoDB. */
  async get(trackingCode) {
    const cached = await this.redis.get(KEY(trackingCode));
    if (cached) return JSON.parse(cached);
    const order = await this.orderRepository.findOne({ trackingCode });
    return order ? this.project({ orderId: order._id }) : null;
  }
}
