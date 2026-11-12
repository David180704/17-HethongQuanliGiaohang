import { ErrorCodes } from "../../core/errors.js";
import { SETTLEABLE_STATUS, orderLine, totals } from "./settlementMath.js";

export const SETTLEMENT_COUNTER = "settlementCode";
export const formatSettlementCode = (seq) => `DS${String(seq).padStart(6, "0")}`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (value) => String(value ?? "").trim();

/** "YYYY-MM-DD" theo gio Viet Nam: dau ngay / cuoi ngay. */
function vnDay(value, label, endOfDay) {
  if (typeof value !== "string" || !DAY.test(value)) throw ErrorCodes.VALIDATION_ERROR(`${label} phải có dạng YYYY-MM-DD`);
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  if (Number.isNaN(date.getTime())) throw ErrorCodes.VALIDATION_ERROR(`${label} không tồn tại`);
  return date;
}

/**
 * Doi soat dinh ky voi shop (de 02):
 *   US-34 quan tri vien chay doi soat cho mot khoang thoi gian: moi shop co don da giao / da hoan trong ky (chua
 *         thuoc ky nao) duoc lap MOT ky, trong MOT transaction: ma DS tang, ghi tung don, gan settlementId cho don
 *         co dieu kien "chua thuoc ky nao" (hai lan chay cung luc thi mot ben that bai -> moi don chi thuoc dung
 *         mot ky). Boi thuong su co da giai quyet (US-38) vao thanh khoan dieu chinh.
 *   US-43 shop xem ky, tung don, khoan dieu chinh, so tien thuc nhan; quan tri vien them khoan dieu chinh khi ky
 *         con cho chi tra, ghi nhan da chi tra vao tai khoan ngan hang da khai bao (US-42) -> ky hoan tat.
 */
export class SettlementService {
  constructor({ settlementRepository, orderRepository, incidentRepository, userRepository, counterRepository, transactions, clock = () => new Date() }) {
    Object.assign(this, { settlementRepository, orderRepository, incidentRepository, userRepository, counterRepository, transactions, clock });
  }

  #admin(user) {
    if (user.role !== "ADMIN") throw ErrorCodes.FORBIDDEN("Chỉ quản trị viên (kế toán) thực hiện đối soát");
  }

  /** Don cua shop ket thuc trong ky, chua thuoc ky doi soat nao. */
  #eligibleFilter(from, to, customerId) {
    return {
      ...(customerId && { customerId }),
      status: { $in: SETTLEABLE_STATUS },
      settlementId: null,
      statusHistory: { $elemMatch: { status: { $in: SETTLEABLE_STATUS }, at: { $gte: from, $lte: to } } },
    };
  }

  /** Xem truoc: moi shop bao nhieu don, tong tien (chua ghi gi). */
  async preview(user, input = {}) {
    this.#admin(user);
    const from = vnDay(input.from, "Từ ngày", false);
    const to = vnDay(input.to, "Đến ngày", true);
    if (from > to) throw ErrorCodes.VALIDATION_ERROR("Từ ngày phải trước đến ngày");
    const orders = await this.orderRepository.findMany(this.#eligibleFilter(from, to, input.customerId), {
      select: "trackingCode customerId customerName status statusHistory fee cod",
    });
    const byShop = new Map();
    for (const o of orders) {
      const key = String(o.customerId);
      if (!byShop.has(key)) byShop.set(key, { customerId: o.customerId, customerName: o.customerName, lines: [] });
      byShop.get(key).lines.push(orderLine(o));
    }
    // Kem boi thuong su co chua tinh (giong luc lap ky that)
    const result = [];
    for (const s of byShop.values()) {
      const incidents = await this.incidentRepository.findMany(
        { customerId: s.customerId, status: "RESOLVED", "resolution.compensation": { $gt: 0 }, settlementId: null },
        { select: "resolution" },
      );
      const adjustments = incidents.map((i) => ({ amount: i.resolution.compensation }));
      result.push({ customerId: s.customerId, customerName: s.customerName, totals: totals(s.lines, adjustments) });
    }
    return result;
  }

  /** US-34: lap ky doi soat cho tung shop co don trong khoang [from, to]. */
  async run(user, input = {}) {
    this.#admin(user);
    const from = vnDay(input.from, "Từ ngày", false);
    const to = vnDay(input.to, "Đến ngày", true);
    if (from > to) throw ErrorCodes.VALIDATION_ERROR("Từ ngày phải trước đến ngày");
    const orders = await this.orderRepository.findMany(this.#eligibleFilter(from, to, input.customerId), { select: "customerId" });
    const customerIds = [...new Set(orders.map((o) => String(o.customerId)))];
    if (!customerIds.length) throw ErrorCodes.VALIDATION_ERROR("Không có đơn nào đã giao / đã hoàn trong kỳ chưa được đối soát");
    const created = [];
    for (const customerId of customerIds) created.push(await this.#runForShop(user, customerId, from, to));
    return created.map((s) => this.#summary(s));
  }

  async #runForShop(user, customerId, from, to) {
    const at = this.clock();
    return this.transactions.run(async (session) => {
      const orders = await this.orderRepository.findMany(this.#eligibleFilter(from, to, customerId), {
        select: "trackingCode customerId customerName status statusHistory fee cod",
        sort: { trackingCode: 1 },
      });
      const lines = orders.map(orderLine);
      // Boi thuong su co da giai quyet cua shop chua tinh vao ky nao -> khoan dieu chinh (+)
      const incidents = await this.incidentRepository.findMany(
        { customerId, status: "RESOLVED", "resolution.compensation": { $gt: 0 }, settlementId: null },
        { select: "code trackingCode resolution" },
      );
      const adjustments = incidents.map((i) => ({
        kind: "COMPENSATION",
        amount: i.resolution.compensation,
        reason: `Bồi thường sự cố ${i.code} (đơn ${i.trackingCode})`,
        incidentId: i._id,
        by: user.id,
        at,
      }));
      const seq = await this.counterRepository.next(SETTLEMENT_COUNTER, { session, startAfter: async () => 0 });
      const settlement = await this.settlementRepository.insert(
        {
          code: formatSettlementCode(seq),
          customerId,
          customerName: orders[0]?.customerName || "",
          periodFrom: from,
          periodTo: to,
          status: "PENDING",
          lines,
          adjustments,
          totals: totals(lines, adjustments),
          createdBy: user.id,
        },
        { session },
      );
      // Moi don chi thuoc dung mot ky: chi gan don con settlementId = null; thieu don nao -> huy ca ky
      const marked = await this.orderRepository.markSettled(
        orders.map((o) => o._id),
        settlement._id,
        { session },
      );
      if (marked !== orders.length) throw ErrorCodes.CONFLICT("Có đơn vừa được đưa vào kỳ đối soát khác, chạy lại đối soát");
      if (incidents.length) {
        await this.incidentRepository.markSettled(incidents.map((i) => i._id), settlement._id, { session });
      }
      return settlement;
    });
  }

  #summary(s) {
    const { lines, ...rest } = s;
    return { ...rest, orderCount: lines?.length ?? s.totals?.orders ?? 0 };
  }

  #scope(user) {
    if (user.role === "ADMIN") return {};
    if (user.role === "CUSTOMER") return { customerId: user.id };
    throw ErrorCodes.FORBIDDEN("Chỉ shop và quản trị viên xem đối soát");
  }

  /** US-43: danh sach ky (shop: cua minh; admin: tat ca, loc theo shop / trang thai). */
  async list(user, query = {}) {
    const filters = { ...this.#scope(user) };
    if (query.status) filters.status = query.status;
    if (user.role === "ADMIN" && query.customerId) filters.customerId = query.customerId;
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const { items, total } = await this.settlementRepository.findPage({ page, limit, search: text(query.search), filters });
    return { items: items.map((s) => this.#summary(s)), total, page, limit };
  }

  async get(user, id) {
    const settlement = await this.settlementRepository.findOne({ _id: id, ...this.#scope(user) });
    if (!settlement) throw ErrorCodes.NOT_FOUND("Không tìm thấy kỳ đối soát");
    return settlement;
  }

  /** US-43 (PB#76): khoan dieu chinh (+ cong cho shop, - tru) khi ky con cho chi tra; tinh lai so tien. */
  async addAdjustment(user, id, input = {}) {
    this.#admin(user);
    const amount = Number(input.amount);
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000_000) {
      throw ErrorCodes.VALIDATION_ERROR("Số tiền điều chỉnh là số đồng nguyên khác 0 (âm = trừ của shop)");
    }
    const reason = text(input.reason);
    if (reason.length < 5) throw ErrorCodes.VALIDATION_ERROR("Ghi lý do điều chỉnh (ít nhất 5 ký tự)");
    const current = await this.get(user, id);
    if (current.status !== "PENDING") throw ErrorCodes.CONFLICT(`Kỳ ${current.code} đã chi trả, không điều chỉnh được`);
    const adjustment = { kind: "OTHER", amount, reason, incidentId: null, by: user.id, at: this.clock() };
    const adjustments = [...current.adjustments, adjustment];
    const updated = await this.settlementRepository.updateWhere(
      // Khoa lac quan: hai nguoi cung them dieu chinh thi mot nguoi phai tai lai (tong luon dung)
      { _id: current._id, status: "PENDING", updatedAt: current.updatedAt },
      { $push: { adjustments: adjustment }, $set: { totals: totals(current.lines, adjustments) } },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Kỳ ${current.code} vừa được cập nhật, tải lại để xem`);
    return updated;
  }

  /** US-43: ghi nhan da chi tra (chuyen khoan vao tai khoan da khai bao) -> ky hoan tat. */
  async pay(user, id, input = {}) {
    this.#admin(user);
    const current = await this.get(user, id);
    if (current.status !== "PENDING") throw ErrorCodes.CONFLICT(`Kỳ ${current.code} đã chi trả`);
    const txnRef = text(input.txnRef);
    if (txnRef.length < 4) throw ErrorCodes.VALIDATION_ERROR("Nhập mã giao dịch chuyển khoản (ít nhất 4 ký tự)");
    const net = current.totals.netPayable;
    let bank = {};
    if (net > 0) {
      const shop = await this.userRepository.findById(current.customerId);
      const account = shop?.bankAccount;
      if (!account?.accountNumber) {
        throw ErrorCodes.CONFLICT(`${current.customerName} chưa khai báo tài khoản ngân hàng nhận tiền thu hộ`);
      }
      bank = { bankName: account.bankName, accountNumber: account.accountNumber, accountName: account.accountName };
    }
    const updated = await this.settlementRepository.updateWhere(
      { _id: current._id, status: "PENDING" },
      { $set: { status: "PAID", payment: { amount: net, ...bank, txnRef, paidAt: this.clock(), by: user.id } } },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Kỳ ${current.code} vừa được cập nhật, tải lại để xem`);
    return updated;
  }
}
