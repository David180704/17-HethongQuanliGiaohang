import { ErrorCodes } from "../../core/errors.js";
import { FINISHED_ORDER_STATUS, INCIDENT_SOURCE, INCIDENT_TYPE } from "../../constants/enums.js";
import { effectiveStatus } from "../orders/orderStatus.js";

export const INCIDENT_COUNTER = "incidentCode";
export const formatIncidentCode = (seq) => `SC${String(seq).padStart(6, "0")}`;

export const INCIDENT_TYPE_LABELS = {
  LOST: "Thất lạc hàng",
  DAMAGED: "Hư hỏng hàng hóa",
  WRONG_INFO: "Sai thông tin giao nhận",
  SHOP_COMPLAINT: "Khiếu nại của người gửi",
  RECIPIENT_COMPLAINT: "Khiếu nại của người nhận",
  OTHER: "Sự cố khác",
};
export const INCIDENT_STATUS_LABELS = { OPEN: "Mới ghi nhận", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã giải quyết" };
const STAFF = ["HUB_STAFF", "ADMIN"];
const MIN_TEXT = 10;
const text = (value) => String(value ?? "").trim();

/**
 * Su co, khieu nai (US-38, de 02): ghi nhan noi dung, don lien quan, tinh trang xu ly va ket qua giai quyet.
 *   - Ai cung bao duoc tren don cua minh: shop (don cua shop), tai xe (don dang giu), kho (don thuoc kho minh),
 *     quan tri vien. Nguoi nhan bao qua tong dai -> nhan vien ghi voi nguon RECIPIENT.
 *   - O moi thoi diem trong vong doi: don chua ket thuc thi chuyen INCIDENT (dung moi thao tac giao nhan) va tra
 *     lai trang thai cu khi het su co mo; don da ket thuc (giao xong, da hoan, da huy) thi giu nguyen trang thai.
 *   - Kho / quan tri vien xu ly: dang xu ly (ghi tien do) -> giai quyet (ket qua, boi thuong neu co). Boi thuong
 *     dua vao ky doi soat cua shop (US-43).
 */
export class IncidentService {
  constructor({ incidentRepository, orderRepository, userRepository, hubRepository, counterRepository, transactions, orderEvents, clock = () => new Date() }) {
    Object.assign(this, { incidentRepository, orderRepository, userRepository, hubRepository, counterRepository, transactions, orderEvents, clock });
  }

  async #hubIds(user) {
    const staff = await this.userRepository.findById(user.id);
    return staff?.hubId ? this.hubRepository.findFamilyIds(staff.hubId) : [];
  }

  /** Don nguoi dung duoc bao su co. */
  async #orderScope(user) {
    if (user.role === "ADMIN") return {};
    if (user.role === "CUSTOMER") return { customerId: user.id };
    if (user.role === "SHIPPER") return { assignedTo: user.id };
    const ids = await this.#hubIds(user);
    return { $or: [{ pickupHubId: { $in: ids } }, { destHubId: { $in: ids } }, { currentHubId: { $in: ids } }] };
  }

  /** Su co nguoi dung xem duoc. */
  async #scope(user) {
    if (user.role === "ADMIN") return {};
    if (user.role === "CUSTOMER") return { customerId: user.id };
    if (user.role === "SHIPPER") return { reportedBy: user.id };
    return { hubIds: { $in: await this.#hubIds(user) } };
  }

  async #publish(order, from, by) {
    if (!this.orderEvents) return;
    try {
      await this.orderEvents.publish("order.status.changed", {
        orderId: String(order._id),
        trackingCode: order.trackingCode,
        from,
        to: order.status,
        by: by ? String(by) : null,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Khong phat duoc su kien su co don ${order.trackingCode}:`, err.message);
    }
  }

  #view(incident) {
    if (!incident) return incident;
    return {
      ...incident,
      typeLabel: INCIDENT_TYPE_LABELS[incident.type],
      statusLabel: INCIDENT_STATUS_LABELS[incident.status],
      history: (incident.history || []).map((h) => ({ ...h, label: INCIDENT_STATUS_LABELS[h.status] })),
    };
  }

  async create(user, input = {}) {
    const type = text(input.type);
    if (!INCIDENT_TYPE.includes(type)) throw ErrorCodes.VALIDATION_ERROR("Chọn loại sự cố");
    const description = text(input.description);
    if (description.length < MIN_TEXT) throw ErrorCodes.VALIDATION_ERROR("Mô tả sự cố ít nhất 10 ký tự");
    const code = text(input.trackingCode).toUpperCase();
    if (!input.orderId && !code) throw ErrorCodes.VALIDATION_ERROR("Thiếu đơn hàng liên quan (mã vận đơn)");
    const order = await this.orderRepository.findOne({
      ...(input.orderId ? { _id: input.orderId } : { trackingCode: code }),
      ...(await this.#orderScope(user)),
    });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng (hoặc đơn không thuộc phạm vi của bạn)");
    // Nguon: shop tu bao; nhan vien ghi (mac dinh STAFF, ghi ho nguoi nhan / shop goi tong dai)
    let source = user.role === "CUSTOMER" ? "SHOP" : "STAFF";
    if (STAFF.includes(user.role) && INCIDENT_SOURCE.includes(input.source)) source = input.source;

    const at = this.clock();
    const freeze = !FINISHED_ORDER_STATUS.includes(order.status);
    const before = effectiveStatus(order);
    const result = await this.transactions.run(async (session) => {
      const seq = await this.counterRepository.next(INCIDENT_COUNTER, { session, startAfter: async () => 0 });
      const incident = await this.incidentRepository.insert(
        {
          code: formatIncidentCode(seq),
          orderId: order._id,
          trackingCode: order.trackingCode,
          customerId: order.customerId,
          hubIds: [order.pickupHubId, order.destHubId].filter(Boolean),
          type,
          source,
          description,
          status: "OPEN",
          reportedBy: user.id,
          orderStatusBefore: freeze ? before : null,
          history: [{ status: "OPEN", at, by: user.id, note: description }],
        },
        { session },
      );
      let updated = null;
      if (freeze && order.status !== "INCIDENT") {
        updated = await this.orderRepository.updateWhere(
          { _id: order._id, status: order.status },
          {
            $set: { status: "INCIDENT" },
            $push: { statusHistory: { status: "INCIDENT", at, by: user.id, note: `Sự cố ${incident.code}: ${INCIDENT_TYPE_LABELS[type]}` } },
          },
          { session },
        );
        if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, thử lại`);
      }
      return { incident, updated };
    });
    if (result.updated) await this.#publish(result.updated, order.status, user.id);
    return this.#view(result.incident);
  }

  async list(user, query = {}) {
    const filters = { ...(await this.#scope(user)) };
    if (query.status) filters.status = query.status;
    if (query.type) filters.type = query.type;
    if (query.orderId) filters.orderId = query.orderId;
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const { items, total } = await this.incidentRepository.findPage({ page, limit, search: text(query.search), filters });
    return { items: items.map((i) => this.#view(i)), total, page, limit };
  }

  async get(user, id) {
    const incident = await this.incidentRepository.findOne({ _id: id, ...(await this.#scope(user)) });
    if (!incident) throw ErrorCodes.NOT_FOUND("Không tìm thấy sự cố");
    return this.#view(incident);
  }

  async #staffIncident(user, id) {
    if (!STAFF.includes(user.role)) throw ErrorCodes.FORBIDDEN("Chỉ nhân viên kho hoặc quản trị viên xử lý sự cố");
    const incident = await this.incidentRepository.findOne({ _id: id, ...(await this.#scope(user)) });
    if (!incident) throw ErrorCodes.NOT_FOUND("Không tìm thấy sự cố");
    if (incident.status === "RESOLVED") throw ErrorCodes.CONFLICT(`Sự cố ${incident.code} đã giải quyết`);
    return incident;
  }

  /** Ghi tien do xu ly: OPEN/IN_PROGRESS -> IN_PROGRESS. */
  async progress(user, id, input = {}) {
    const incident = await this.#staffIncident(user, id);
    const note = text(input.note);
    if (note.length < 5) throw ErrorCodes.VALIDATION_ERROR("Ghi nội dung xử lý (ít nhất 5 ký tự)");
    const updated = await this.incidentRepository.updateWhere(
      { _id: incident._id, status: { $ne: "RESOLVED" } },
      { $set: { status: "IN_PROGRESS" }, $push: { history: { status: "IN_PROGRESS", at: this.clock(), by: user.id, note } } },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Sự cố ${incident.code} vừa được cập nhật, tải lại để xem`);
    return this.#view(updated);
  }

  /**
   * Giai quyet: ket qua bat buoc, boi thuong (dong, >= 0). Het su co mo tren don -> don tra lai trang thai truoc
   * khi gap su co (cung transaction).
   */
  async resolve(user, id, input = {}) {
    const incident = await this.#staffIncident(user, id);
    const resultText = text(input.result);
    if (resultText.length < MIN_TEXT) throw ErrorCodes.VALIDATION_ERROR("Ghi kết quả giải quyết (ít nhất 10 ký tự)");
    const compensation = input.compensation === undefined || input.compensation === "" ? 0 : Number(input.compensation);
    if (!Number.isInteger(compensation) || compensation < 0 || compensation > 100_000_000) {
      throw ErrorCodes.VALIDATION_ERROR("Bồi thường là số đồng nguyên từ 0 đến 100.000.000");
    }
    const at = this.clock();
    const note = `${resultText}${compensation ? ` — bồi thường ${compensation.toLocaleString("vi-VN")} đ` : ""}`;
    const result = await this.transactions.run(async (session) => {
      const saved = await this.incidentRepository.updateWhere(
        { _id: incident._id, status: { $ne: "RESOLVED" } },
        {
          $set: { status: "RESOLVED", resolution: { result: resultText, compensation, at, by: user.id } },
          $push: { history: { status: "RESOLVED", at, by: user.id, note } },
        },
        { session },
      );
      if (!saved) throw ErrorCodes.CONFLICT(`Sự cố ${incident.code} vừa được cập nhật, tải lại để xem`);
      let restored = null;
      const others = await this.incidentRepository.countOpen(incident.orderId, { exceptId: incident._id, session });
      if (!others && incident.orderStatusBefore) {
        restored = await this.orderRepository.updateWhere(
          { _id: incident.orderId, status: "INCIDENT" },
          {
            $set: { status: incident.orderStatusBefore },
            $push: { statusHistory: { status: incident.orderStatusBefore, at, by: user.id, note: `Đã giải quyết sự cố ${incident.code}: ${resultText}` } },
          },
          { session },
        );
      }
      return { saved, restored };
    });
    if (result.restored) await this.#publish(result.restored, "INCIDENT", user.id);
    return this.#view(result.saved);
  }
}
