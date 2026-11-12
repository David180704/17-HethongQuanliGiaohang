import QRCode from "qrcode";
import { ErrorCodes } from "../../core/errors.js";
import { parseShiftDate } from "../shifts/shifts.validator.js";
import { routeScopeFor } from "../routes/routeScope.js";
import { effectiveCapacity } from "../capacity/capacity.js";
import { expressChecker, expressFirst } from "../orders/priority.js";
import { vnNow } from "../assignments/AssignmentService.js";
import { parseLocation } from "../assignments/pickupOutcome.js";
import {
  COD_METHOD_LABELS,
  DEFAULT_MAX_DELIVERY_ATTEMPTS,
  DELIVERY_FAIL_LABELS,
  afterFailedDelivery,
  amountToCollect,
  parseDelivered,
  parseDeliveryFailed,
  parsePolicy,
  parseScan,
} from "./deliveryPolicy.js";

const same = (a, b) => String(a) === String(b);
const MIN_REASON = 5;
const POLICY_SETTING = "delivery";
// Don cho phan cong giao: vua toi kho dich, hoac cho giao lai sau lan that bai (US-35, US-36)
export const DELIVERY_QUEUE = ["AT_DEST_HUB", "RESCHEDULED"];
// Giao va hoan hang cung tinh vao nang luc giao cua ca
const DELIVERY_TYPES = ["DELIVERY", "RETURN"];
const vnd = (n) => `${Number(n).toLocaleString("vi-VN")} đ`;
const fullAddress = (...parts) => parts.filter(Boolean).join(", ");

/**
 * Chieu giao hang cua de 02 (Sprint 6):
 *   US-35 phan cong giao: don toi kho dich (AT_DEST_HUB) hoac cho giao lai (RESCHEDULED) -> tuyen cua khu
 *         vuc nguoi nhan -> ca hom nay con mo -> nguoi it don nhat chua day nang luc giao (cung thuat toan
 *         chieu lay, khoa ca trong transaction). Gui nhanh duoc phan cong truoc. Kho dieu chinh tay, ghi ly do.
 *   US-31 danh sach don can giao trong ca + phieu giao hang co ma QR chua ma van don.
 *   US-32 quet ma mang di giao (OUT_FOR_DELIVERY) -> giao thanh cong (DELIVERED, ghi GPS) hoac that bai
 *         (bat buoc nguyen nhan, tang so lan giao).
 *   US-33 thu tien nguoi nhan (thu ho + phi neu nguoi nhan tra) trong CUNG transaction voi DELIVERED.
 *   US-36 that bai -> giao lai; tu choi nhan hoac qua so lan cho phep (mac dinh 3) -> hoan hang.
 *   US-37 hoan hang: phan cong theo tuyen lay hang cu (Assignment RETURN), tai xe tra hang cho shop,
 *         shop xac nhan da nhan lai -> RETURNED.
 */
export class DeliveryService {
  constructor({
    assignmentRepository,
    shiftRepository,
    orderRepository,
    routeRepository,
    userRepository,
    hubRepository,
    pickupLocationRepository,
    serviceAreaRepository,
    serviceTypeRepository,
    settingRepository,
    capacityService,
    transactions,
    orderEvents,
    clock = () => new Date(),
  }) {
    Object.assign(this, {
      assignmentRepository,
      shiftRepository,
      orderRepository,
      routeRepository,
      userRepository,
      hubRepository,
      pickupLocationRepository,
      serviceAreaRepository,
      serviceTypeRepository,
      settingRepository,
      capacityService,
      transactions,
      orderEvents,
      clock,
    });
  }

  // ------------------------------------------------------------------ chinh sach (US-36)

  async policy() {
    const saved = await this.settingRepository.get(POLICY_SETTING);
    return { maxDeliveryAttempts: saved?.maxDeliveryAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS };
  }

  async setPolicy(user, input) {
    if (user.role !== "ADMIN") throw ErrorCodes.FORBIDDEN("Chỉ quản trị viên đổi chính sách giao lại");
    await this.settingRepository.set(POLICY_SETTING, { ...parsePolicy(input), updatedBy: user.id });
    return this.policy();
  }

  // ------------------------------------------------------------------ dung chung

  /** Tuyen giao: khu vuc phuc vu cua xa/phuong nguoi nhan -> tuyen. */
  async #deliveryRoute(order) {
    const area = await this.serviceAreaRepository.findByLocation(order.receiver?.province, order.receiver?.ward);
    return area ? this.routeRepository.findById(area.routeId) : null;
  }

  /** Tuyen hoan hang: tuyen cua dia diem lay hang cu (don tai quay: khu vuc cua diem tiep nhan). */
  async #returnRoute(order) {
    let areaId = null;
    if (order.pickupLocationId) {
      areaId = (await this.pickupLocationRepository.findById(order.pickupLocationId))?.serviceAreaId;
    } else if (order.pickupHubId) {
      areaId = (await this.hubRepository.findById(order.pickupHubId))?.serviceAreaId;
    }
    const area = areaId ? await this.serviceAreaRepository.findById(areaId) : null;
    return area ? this.routeRepository.findById(area.routeId) : null;
  }

  #routeFor(order, kind) {
    return kind === "RETURN" ? this.#returnRoute(order) : this.#deliveryRoute(order);
  }

  async #familyIds(user) {
    if (user.role === "ADMIN") return null;
    const staff = await this.userRepository.findById(user.id);
    return staff?.hubId ? this.hubRepository.findFamilyIds(staff.hubId) : [];
  }

  /** Pham vi kho: giao -> kho dich thuoc hub minh; hoan -> kho lay hang thuoc hub minh. */
  async #scopes(user) {
    const ids = await this.#familyIds(user);
    if (ids === null) return { delivery: {}, ret: {} };
    return { delivery: { destHubId: { $in: ids } }, ret: { pickupHubId: { $in: ids } } };
  }

  async #isExpress() {
    const express = await this.serviceTypeRepository.findMany({ code: "EXPRESS" }, { select: "_id" });
    return expressChecker(express.map((s) => s._id));
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
      console.error(`Khong phat duoc su kien giao hang don ${order.trackingCode}:`, err.message);
    }
  }

  /** Dieu kien "don dang cho phan cong" cua tung loai (dung trong updateWhere - chong gan trung). */
  #waitingFilter(order, kind) {
    return kind === "RETURN"
      ? { _id: order._id, status: "RETURNING", assignedTo: null, returnHandedAt: null }
      : { _id: order._id, status: order.status };
  }

  #isWaiting(order, kind) {
    if (kind === "RETURN") return order.status === "RETURNING" && !order.assignedTo && !order.returnHandedAt;
    return DELIVERY_QUEUE.includes(order.status);
  }

  async #queue(order, kind, reason) {
    await this.orderRepository.updateWhere(this.#waitingFilter(order, kind), { $set: { unassignedReason: reason } });
    return { status: "UNASSIGNED", trackingCode: order.trackingCode, kind, reason };
  }

  /** Tai giao (giao + hoan) va nang luc giao cua tung nguoi trong mot ca. */
  async #candidates(shift, people, route, system, session) {
    await this.shiftRepository.lock(shift._id, { session });
    const loads = await this.assignmentRepository.shiftLoads(shift._id, DELIVERY_TYPES, { session });
    return people
      .map((s) => ({
        shipper: s,
        capacity: effectiveCapacity({ shipper: s, route, system }, "delivery").value,
        ...(loads.get(String(s._id)) || { used: 0, pending: 0 }),
      }))
      .sort((a, b) => a.pending - b.pending || a.used - b.used || a.shipper.fullName.localeCompare(b.shipper.fullName));
  }

  #assignedUpdate(kind, shipper, at, by, note) {
    const status = kind === "RETURN" ? "RETURNING" : "DELIVERY_ASSIGNED";
    return {
      $set: { status, assignedTo: shipper._id, unassignedReason: null },
      $push: { statusHistory: { status, at, by, note } },
    };
  }

  // ------------------------------------------------------------------ phan cong tu dong (US-35, US-37)

  /** Consumer su kien: don toi kho dich / cho giao lai -> phan cong giao; dang hoan -> phan cong hoan. */
  onOrderStatusChanged(event) {
    if (DELIVERY_QUEUE.includes(event?.to)) return this.autoAssign(event.orderId, "DELIVERY");
    if (event?.to === "RETURNING") return this.autoAssign(event.orderId, "RETURN");
    return null;
  }

  async autoAssign(orderId, kind = "DELIVERY", { by = null } = {}) {
    const order = await this.orderRepository.findById(orderId);
    if (!order || !this.#isWaiting(order, kind)) return { status: "SKIPPED" };
    const route = await this.#routeFor(order, kind);
    const what = kind === "RETURN" ? "hoàn hàng" : "giao hàng";
    if (!route) return this.#queue(order, kind, `Không xác định được tuyến ${what}`);
    const { day, time } = vnNow(this.clock());
    const shifts = await this.shiftRepository.findOpen({ routeId: route._id, shiftDate: parseShiftDate(day), time });
    const shippers = shifts.length
      ? await this.userRepository.findActiveShippers({ ids: shifts.flatMap((s) => s.shipperIds), routeIds: [route._id] })
      : [];
    if (!shippers.length) return this.#queue(order, kind, `Tuyến ${route.code} chưa có người trực ca còn lại hôm nay`);
    const system = await this.capacityService.system();

    const result = await this.transactions.run(async (session) => {
      for (const shift of shifts) {
        const people = shippers.filter((s) => shift.shipperIds.some((id) => same(id, s._id)));
        if (!people.length) continue;
        const [pick] = (await this.#candidates(shift, people, route, system, session)).filter((c) => c.used < c.capacity);
        if (!pick) continue;
        const at = this.clock();
        const note = `Phân công ${what} tự động: ${pick.shipper.fullName} (${shift.name} ${shift.startTime}–${shift.endTime})`;
        const updated = await this.orderRepository.updateWhere(
          this.#waitingFilter(order, kind),
          this.#assignedUpdate(kind, pick.shipper, at, by, note),
          { session },
        );
        if (!updated) return { status: "SKIPPED" };
        await this.assignmentRepository.insert(
          {
            orderId: order._id,
            shipperId: pick.shipper._id,
            type: kind,
            shiftDate: shift.shiftDate,
            shiftId: shift._id,
            method: "AUTO",
            assignedBy: by,
            assignedAt: at,
          },
          { session },
        );
        return {
          status: "ASSIGNED",
          kind,
          order: updated,
          trackingCode: updated.trackingCode,
          shipper: { _id: pick.shipper._id, fullName: pick.shipper.fullName },
          shift: { _id: shift._id, code: shift.code, name: shift.name },
          load: pick.used + 1,
          capacity: pick.capacity,
        };
      }
      return null;
    });
    if (!result) return this.#queue(order, kind, `Tuyến ${route.code}: người trực ca đã đủ năng lực giao`);
    if (result.status === "ASSIGNED") {
      // Hoan hang giu trang thai RETURNING nhung van phat su kien de cap nhat hanh trinh cong khai
      await this.#publish(result.order, order.status, by);
      delete result.order;
    }
    return result;
  }

  async #queueOrders(user) {
    const { delivery, ret } = await this.#scopes(user);
    const [toDeliver, toReturn] = await Promise.all([
      this.orderRepository.findMany(
        { ...delivery, status: { $in: DELIVERY_QUEUE } },
        { select: "trackingCode customerName receiver serviceTypeId status deliveryAttempts unassignedReason updatedAt", sort: { updatedAt: 1 } },
      ),
      this.orderRepository.findMany(
        { ...ret, status: "RETURNING", assignedTo: null, returnHandedAt: null },
        { select: "trackingCode customerName pickupWard pickupLocationId pickupHubId serviceTypeId status returnReason unassignedReason updatedAt", sort: { updatedAt: 1 } },
      ),
    ]);
    return { toDeliver, toReturn };
  }

  /** Chay lai phan cong tu dong cho hang cho giao / hoan trong pham vi (gui nhanh truoc). */
  async runQueue(user) {
    const { toDeliver, toReturn } = await this.#queueOrders(user);
    const isExpress = await this.#isExpress();
    const results = [];
    for (const { _id } of expressFirst(toDeliver, isExpress)) results.push(await this.autoAssign(_id, "DELIVERY", { by: user.id }));
    for (const { _id } of toReturn) results.push(await this.autoAssign(_id, "RETURN", { by: user.id }));
    return {
      assigned: results.filter((r) => r.status === "ASSIGNED").length,
      unassigned: results.filter((r) => r.status === "UNASSIGNED").length,
      results,
    };
  }

  // ------------------------------------------------------------------ dieu chinh tay (de 02)

  async assignManually(user, input = {}) {
    const reason = String(input.reason || "").trim();
    if (reason.length < MIN_REASON) throw ErrorCodes.VALIDATION_ERROR("Điều chỉnh phân công phải ghi lý do (ít nhất 5 ký tự)");
    if (!input.orderId || !input.shipperId) throw ErrorCodes.VALIDATION_ERROR("Thiếu đơn hoặc người giao hàng");
    const { delivery, ret } = await this.#scopes(user);
    const order = await this.orderRepository.findOne({ _id: input.orderId, $or: [delivery, ret] });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng");
    const kind = order.status === "RETURNING" ? "RETURN" : "DELIVERY";
    if (kind === "DELIVERY" && ![...DELIVERY_QUEUE, "DELIVERY_ASSIGNED"].includes(order.status)) {
      throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} không ở bước chờ giao (đang giao thì không đổi người)`);
    }
    if (kind === "RETURN" && order.returnHandedAt) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã trả cho người gửi`);
    if (order.assignedTo && same(order.assignedTo, input.shipperId) && (order.status === "DELIVERY_ASSIGNED" || kind === "RETURN")) {
      throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã được giao cho người này`);
    }
    const route = await this.#routeFor(order, kind);
    if (!route) throw ErrorCodes.CONFLICT("Không xác định được tuyến của đơn");
    const [shipper] = await this.userRepository.findActiveShippers({ ids: [input.shipperId], routeIds: [route._id] });
    if (!shipper) throw ErrorCodes.VALIDATION_ERROR(`Người được chọn không phụ trách tuyến ${route.code} hoặc đã ngừng`);

    const { day, time } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const [shift] = await this.shiftRepository.findOpen({ routeId: route._id, shiftDate, time, shipperId: shipper._id });
    const system = await this.capacityService.system();
    const capacity = effectiveCapacity({ shipper, route, system }, "delivery").value;

    const result = await this.transactions.run(async (session) => {
      let used = 0;
      if (shift) {
        await this.shiftRepository.lock(shift._id, { session });
        used = (await this.assignmentRepository.shiftLoads(shift._id, DELIVERY_TYPES, { session })).get(String(shipper._id))?.used || 0;
      }
      const overCapacity = Boolean(shift) && used >= capacity;
      const at = this.clock();
      const what = kind === "RETURN" ? "hoàn hàng" : "giao hàng";
      const note = `Điều chỉnh phân công ${what}: ${shipper.fullName} — lý do: ${reason}${overCapacity ? " (vượt năng lực ca)" : ""}${shift ? "" : " (ngoài ca)"}`;
      const updated = await this.orderRepository.updateWhere(
        { _id: order._id, status: order.status, assignedTo: order.assignedTo ?? null },
        this.#assignedUpdate(kind, shipper, at, user.id, note),
        { session },
      );
      if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được người khác cập nhật, tải lại để xem`);
      await this.assignmentRepository.cancelActive({ orderId: order._id, type: kind, by: user.id, at }, { session });
      await this.assignmentRepository.insert(
        {
          orderId: order._id,
          shipperId: shipper._id,
          type: kind,
          shiftDate: shift?.shiftDate ?? shiftDate,
          shiftId: shift?._id ?? null,
          method: "MANUAL",
          assignedBy: user.id,
          assignedAt: at,
          reason,
        },
        { session },
      );
      return { order: updated, overCapacity, load: shift ? used + 1 : null };
    });
    if (order.status !== result.order.status) await this.#publish(result.order, order.status, user.id);
    return {
      trackingCode: result.order.trackingCode,
      status: result.order.status,
      kind,
      shipper: { _id: shipper._id, fullName: shipper.fullName },
      shift: shift ? { _id: shift._id, code: shift.code, name: shift.name } : null,
      overCapacity: result.overCapacity,
      load: result.load,
      capacity,
    };
  }

  // ------------------------------------------------------------------ tai xe: giao hang (US-32, US-33)

  async #mine(user, orderId, statuses, action) {
    if (user.role !== "SHIPPER") throw ErrorCodes.FORBIDDEN(`Chỉ người giao hàng được giao đơn này mới ${action}`);
    const order = await this.orderRepository.findOne({ _id: orderId, assignedTo: user.id });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn được giao cho bạn");
    if (!statuses.includes(order.status)) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} không ở bước để ${action}`);
    return order;
  }

  /** Quet ma kien va mang di giao: DELIVERY_ASSIGNED -> OUT_FOR_DELIVERY. */
  async startDelivery(user, orderId, input = {}) {
    const order = await this.#mine(user, orderId, ["DELIVERY_ASSIGNED"], "mang đi giao");
    const { location } = parseScan(input, order.trackingCode);
    const at = this.clock();
    const updated = await this.orderRepository.updateWhere(
      { _id: order._id, status: "DELIVERY_ASSIGNED", assignedTo: user.id },
      {
        $set: { status: "OUT_FOR_DELIVERY" },
        $push: { statusHistory: { status: "OUT_FOR_DELIVERY", at, by: user.id, note: "Người giao hàng đã nhận kiện, đang đi giao", location } },
      },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, tải lại để xem`);
    await this.#publish(updated, "DELIVERY_ASSIGNED", user.id);
    return { trackingCode: updated.trackingCode, status: updated.status, at };
  }

  /**
   * Giao thanh cong (US-32) + thu tien (US-33) trong MOT transaction: don DELIVERED kem GPS, cod.collected,
   * phi da thu neu nguoi nhan tra, phan cong DONE. DELIVERED la trang thai cuoi - khong doi duoc nua.
   */
  async confirmDelivered(user, orderId, input = {}) {
    const order = await this.#mine(user, orderId, ["OUT_FOR_DELIVERY"], "xác nhận giao");
    const { location, collected } = parseDelivered(input, order);
    const at = this.clock();
    const money = amountToCollect(order);
    const set = { status: "DELIVERED", unassignedReason: null };
    if (collected) {
      Object.assign(set, {
        "cod.collected": true,
        "cod.collectedAt": at,
        "cod.method": collected.method,
        "cod.txnRef": collected.txnRef,
      });
      if (order.cod?.feePayer === "RECIPIENT_PAID") Object.assign(set, { "cod.feePaid": true, "cod.feePaidAt": at });
    }
    const note = collected
      ? `Giao thành công — đã thu ${vnd(collected.amount)} (${COD_METHOD_LABELS[collected.method]}${collected.txnRef ? ` · mã GD ${collected.txnRef}` : ""})`
      : "Giao thành công";
    const updated = await this.transactions.run(async (session) => {
      const saved = await this.orderRepository.updateWhere(
        { _id: order._id, status: "OUT_FOR_DELIVERY", assignedTo: user.id },
        { $set: set, $push: { statusHistory: { status: "DELIVERED", at, by: user.id, note, location } } },
        { session },
      );
      if (!saved) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, tải lại để xem`);
      await this.assignmentRepository.finishActive(
        { orderId: order._id, type: "DELIVERY", shipperId: user.id },
        { status: "DONE", doneAt: at, location },
        { session },
      );
      return saved;
    });
    await this.#publish(updated, "OUT_FOR_DELIVERY", user.id);
    return {
      trackingCode: updated.trackingCode,
      status: updated.status,
      at,
      collected: collected ? { ...collected, cod: money.cod, fee: money.fee } : null,
    };
  }

  /**
   * Giao that bai (US-32): bat buoc nguyen nhan, tang so lan giao; theo chinh sach (US-36) don cho giao lai
   * (RESCHEDULED) hoac chuyen hoan hang (RETURNING) - ca hai deu vao lai hang cho phan cong.
   */
  async failDelivery(user, orderId, input = {}) {
    const order = await this.#mine(user, orderId, ["OUT_FOR_DELIVERY"], "báo giao không thành công");
    const { reason, note, location } = parseDeliveryFailed(input);
    const attempts = (order.deliveryAttempts || 0) + 1;
    const { maxDeliveryAttempts } = await this.policy();
    const { next, why } = afterFailedDelivery({ reason, attempts, maxAttempts: maxDeliveryAttempts });
    const at = this.clock();
    const label = DELIVERY_FAIL_LABELS[reason];
    const updated = await this.transactions.run(async (session) => {
      const saved = await this.orderRepository.updateWhere(
        { _id: order._id, status: "OUT_FOR_DELIVERY", assignedTo: user.id },
        {
          $set: {
            status: next,
            deliveryAttempts: attempts,
            assignedTo: null,
            unassignedReason: null,
            ...(next === "RETURNING" && { returnReason: why, returnHandedAt: null }),
          },
          $push: {
            statusHistory: {
              $each: [
                { status: "DELIVERY_FAILED", at, by: user.id, note: `Giao không thành công lần ${attempts}: ${label}${note ? ` — ${note}` : ""}`, location },
                { status: next, at, by: user.id, note: why },
              ],
            },
          },
        },
        { session },
      );
      if (!saved) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, tải lại để xem`);
      await this.assignmentRepository.finishActive(
        { orderId: order._id, type: "DELIVERY", shipperId: user.id },
        { status: "FAILED", doneAt: at, location, failReason: reason, failNote: note },
        { session },
      );
      return saved;
    });
    await this.#publish(updated, "OUT_FOR_DELIVERY", user.id);
    return { trackingCode: updated.trackingCode, status: updated.status, attempts, maxAttempts: maxDeliveryAttempts, next: why };
  }

  // ------------------------------------------------------------------ hoan hang (US-37)

  /** Tai xe hoan hang da tra kien cho nguoi gui: ghi thoi gian, GPS; cho nguoi gui xac nhan. */
  async handBack(user, orderId, input = {}) {
    const order = await this.#mine(user, orderId, ["RETURNING"], "trả hàng cho người gửi");
    if (order.returnHandedAt) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã ghi nhận trả cho người gửi`);
    const location = parseLocation(input);
    const at = this.clock();
    const updated = await this.transactions.run(async (session) => {
      const saved = await this.orderRepository.updateWhere(
        { _id: order._id, status: "RETURNING", assignedTo: user.id, returnHandedAt: null },
        {
          $set: { returnHandedAt: at },
          $push: { statusHistory: { status: "RETURNING", at, by: user.id, note: "Đã trả hàng cho người gửi — chờ người gửi xác nhận", location } },
        },
        { session },
      );
      if (!saved) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, tải lại để xem`);
      await this.assignmentRepository.finishActive(
        { orderId: order._id, type: "RETURN", shipperId: user.id },
        { status: "DONE", doneAt: at, location },
        { session },
      );
      return saved;
    });
    await this.#publish(updated, "RETURNING", user.id);
    return { trackingCode: updated.trackingCode, status: updated.status, returnHandedAt: at };
  }

  /** Nguoi gui (chu don) xac nhan da nhan lai hang -> RETURNED (ket thuc theo doi hoan hang). */
  async confirmReturned(user, orderId) {
    const filter = { _id: orderId, ...(user.role === "ADMIN" ? {} : { customerId: user.id }) };
    if (!["CUSTOMER", "ADMIN"].includes(user.role)) throw ErrorCodes.FORBIDDEN("Chỉ người gửi xác nhận đã nhận lại hàng");
    const order = await this.orderRepository.findOne(filter);
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng của bạn");
    if (order.status !== "RETURNING" || !order.returnHandedAt) {
      throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} chưa được trả lại cho bạn`);
    }
    const at = this.clock();
    const updated = await this.orderRepository.updateWhere(
      { _id: order._id, status: "RETURNING" },
      {
        $set: { status: "RETURNED" },
        $push: { statusHistory: { status: "RETURNED", at, by: user.id, note: "Người gửi xác nhận đã nhận lại hàng" } },
      },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được cập nhật, tải lại để xem`);
    await this.#publish(updated, "RETURNING", user.id);
    return { trackingCode: updated.trackingCode, status: updated.status, at };
  }

  // ------------------------------------------------------------------ danh sach, phieu giao (US-31)

  /** Don can giao / can hoan cua chinh tai xe trong ngay, mac dinh theo ca hien tai (hoac shiftId, "all"). */
  async myDeliveries(user, query = {}) {
    if (user.role !== "SHIPPER") throw ErrorCodes.FORBIDDEN("Chỉ người giao hàng xem đơn cần giao của mình");
    const { day, time } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const shifts = await this.shiftRepository.findForRoutes({ shiftDate, shipperId: user.id });
    const current = shifts.find((s) => s.startTime <= time && time < s.endTime) || shifts.find((s) => s.endTime > time) || null;
    const selected = query.shiftId === "all" ? null : query.shiftId || (current ? String(current._id) : null);
    const assignments = (await this.assignmentRepository.findForShipper({ shipperId: user.id, shiftDate, type: DELIVERY_TYPES })).filter(
      (a) => !selected || same(a.shiftId, selected),
    );
    const orders = await this.orderRepository.findMany(
      { _id: { $in: assignments.map((a) => a.orderId) } },
      { select: "trackingCode customerName pickupLocationId pickupWard receiver item cod fee status deliveryAttempts serviceTypeId returnReason returnHandedAt" },
    );
    const orderById = new Map(orders.map((o) => [String(o._id), o]));
    const locations = await this.pickupLocationRepository.findMany(
      { _id: { $in: orders.map((o) => o.pickupLocationId).filter(Boolean) } },
      { select: "contactName contactPhone address ward province" },
    );
    const locationById = new Map(locations.map((l) => [String(l._id), l]));
    const isExpress = await this.#isExpress();
    const { maxDeliveryAttempts } = await this.policy();
    const items = assignments
      .filter((a) => orderById.has(String(a.orderId)))
      .map((a) => {
        const o = orderById.get(String(a.orderId));
        const shop = locationById.get(String(o.pickupLocationId));
        const isReturn = a.type === "RETURN";
        return {
          assignmentId: a._id,
          assignmentStatus: a.status,
          type: a.type,
          shiftId: a.shiftId,
          orderId: o._id,
          trackingCode: o.trackingCode,
          status: o.status,
          express: isExpress(o),
          // Giao: nguoi nhan; hoan: tra ve nguoi gui (dia diem lay hang)
          to: isReturn
            ? {
                name: shop?.contactName || o.customerName,
                phone: shop?.contactPhone || null,
                address: shop ? fullAddress(shop.address, shop.ward, shop.province) : o.pickupWard,
              }
            : { name: o.receiver?.name, phone: o.receiver?.phone, address: fullAddress(o.receiver?.address, o.receiver?.ward, o.receiver?.province) },
          collect: isReturn ? { cod: 0, fee: 0, total: 0 } : amountToCollect(o),
          item: { name: o.item?.name, weightGram: o.item?.weightGram, note: o.item?.note || null },
          attempts: o.deliveryAttempts || 0,
          maxAttempts: maxDeliveryAttempts,
          returnReason: isReturn ? o.returnReason : null,
          returnHandedAt: isReturn ? o.returnHandedAt : null,
        };
      })
      .sort((x, y) => Number(y.express) - Number(x.express));
    return {
      shifts: shifts.map((s) => ({ _id: s._id, code: s.code, name: s.name, startTime: s.startTime, endTime: s.endTime, route: s.routeId })),
      currentShiftId: current?._id ?? null,
      selectedShiftId: selected,
      counts: {
        total: items.length,
        toDeliver: items.filter((i) => i.type === "DELIVERY" && i.assignmentStatus === "ASSIGNED").length,
        toReturn: items.filter((i) => i.type === "RETURN" && i.assignmentStatus === "ASSIGNED").length,
        done: items.filter((i) => i.assignmentStatus === "DONE").length,
        failed: items.filter((i) => i.assignmentStatus === "FAILED").length,
        // Tien mat phai nop lai kho cuoi ca: tong da thu cua don giao thanh cong
        toCollect: items.filter((i) => i.assignmentStatus === "ASSIGNED").reduce((sum, i) => sum + i.collect.total, 0),
      },
      orders: items,
    };
  }

  /**
   * Phieu giao hang (de 14): dia chi, xa/phuong, so dien thoai, tien phai thu va ma QR chua ma van don.
   * Tai xe dang giu don, nhan vien kho trong pham vi hoac quan tri vien moi xem/in duoc.
   */
  async slip(user, orderId) {
    let order;
    if (user.role === "SHIPPER") {
      order = await this.orderRepository.findOne({ _id: orderId, assignedTo: user.id });
    } else if (["HUB_STAFF", "ADMIN"].includes(user.role)) {
      const { delivery, ret } = await this.#scopes(user);
      order = await this.orderRepository.findOne({ _id: orderId, $or: [delivery, ret] });
    }
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng");
    const isExpress = await this.#isExpress();
    const qr = await QRCode.toDataURL(order.trackingCode, { margin: 1, width: 240, errorCorrectionLevel: "M" });
    return {
      trackingCode: order.trackingCode,
      qr,
      status: order.status,
      serviceName: order.serviceName,
      express: isExpress(order),
      sender: { name: order.customerName, ward: order.pickupWard },
      receiver: {
        name: order.receiver?.name,
        phone: order.receiver?.phone,
        address: order.receiver?.address,
        ward: order.receiver?.ward,
        province: order.receiver?.province,
      },
      item: {
        name: order.item?.name,
        weightGram: order.item?.weightGram,
        size: `${order.item?.length}×${order.item?.width}×${order.item?.height} cm`,
        note: order.item?.note || null,
        fragile: Boolean(order.flags?.fragile),
      },
      collect: amountToCollect(order),
      attempts: order.deliveryAttempts || 0,
      printedAt: this.clock(),
    };
  }

  // ------------------------------------------------------------------ bang phan cong giao (kho)

  async board(user) {
    const { delivery, ret } = await this.#scopes(user);
    const routeIds = await routeScopeFor(user, this);
    const { day } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const [{ toDeliver, toReturn }, assigned, awaitingShop, shifts, system, policy] = await Promise.all([
      this.#queueOrders(user),
      this.orderRepository.findMany(
        { $or: [{ ...delivery, status: { $in: ["DELIVERY_ASSIGNED", "OUT_FOR_DELIVERY"] } }, { ...ret, status: "RETURNING", assignedTo: { $ne: null }, returnHandedAt: null }] },
        { select: "trackingCode customerName receiver pickupWard pickupLocationId pickupHubId status assignedTo deliveryAttempts serviceTypeId updatedAt", sort: { updatedAt: -1 } },
      ),
      this.orderRepository.findMany(
        { ...ret, status: "RETURNING", returnHandedAt: { $ne: null } },
        { select: "trackingCode customerName returnHandedAt returnReason", sort: { returnHandedAt: -1 } },
      ),
      this.shiftRepository.findForRoutes({ routeIds, shiftDate }),
      this.capacityService.system(),
      this.policy(),
    ]);
    const routeDocs = await this.routeRepository.findActive(routeIds);
    const routeById = new Map(routeDocs.map((r) => [String(r._id), r]));
    const people = await this.userRepository.findActiveShippers({ routeIds: routeDocs.map((r) => r._id) });
    const personById = new Map(people.map((p) => [String(p._id), p]));
    const isExpress = await this.#isExpress();
    const who = (id) => (personById.get(String(id)) ? { _id: id, fullName: personById.get(String(id)).fullName } : { _id: id });
    const shiftViews = [];
    for (const shift of shifts) {
      const route = routeById.get(String(shift.routeId?._id));
      const loads = await this.assignmentRepository.shiftLoads(shift._id, DELIVERY_TYPES);
      shiftViews.push({
        _id: shift._id,
        code: shift.code,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        route: shift.routeId,
        shippers: shift.shipperIds.map((s) => ({
          _id: s._id,
          fullName: s.fullName,
          ...(loads.get(String(s._id)) || { used: 0, pending: 0 }),
          capacity: route ? effectiveCapacity({ shipper: personById.get(String(s._id)) || s, route, system }, "delivery").value : null,
        })),
      });
    }
    // Tuyen cua tung don (giao: theo nguoi nhan; hoan: theo dia diem lay) - kho chon nguoi cung tuyen khi dieu chinh
    const routeOf = new Map();
    for (const o of [...toDeliver, ...toReturn, ...assigned]) {
      const kind = o.status === "RETURNING" ? "RETURN" : "DELIVERY";
      const route = await this.#routeFor(o, kind);
      routeOf.set(String(o._id), route ? { _id: route._id, code: route.code } : null);
    }
    const brief = (o) => ({
      _id: o._id,
      route: routeOf.get(String(o._id)) ?? null,
      trackingCode: o.trackingCode,
      customerName: o.customerName,
      status: o.status,
      to: o.receiver ? `${o.receiver.ward}, ${o.receiver.province}` : o.pickupWard,
      attempts: o.deliveryAttempts || 0,
      express: isExpress(o),
      unassignedReason: o.unassignedReason ?? null,
    });
    return {
      policy,
      queue: [
        ...expressFirst(toDeliver, isExpress).map((o) => ({ ...brief(o), kind: "DELIVERY" })),
        ...toReturn.map((o) => ({ ...brief(o), kind: "RETURN", returnReason: o.returnReason })),
      ],
      assigned: assigned.map((o) => ({ ...brief(o), kind: o.status === "RETURNING" ? "RETURN" : "DELIVERY", assignedTo: who(o.assignedTo) })),
      awaitingShop: awaitingShop.map((o) => ({ _id: o._id, trackingCode: o.trackingCode, customerName: o.customerName, returnHandedAt: o.returnHandedAt, returnReason: o.returnReason })),
      shifts: shiftViews,
      shippersByRoute: routeDocs.map((r) => ({
        _id: r._id,
        code: r.code,
        shippers: people.filter((p) => p.routeIds.some((id) => same(id, r._id))).map(({ _id, fullName }) => ({ _id, fullName })),
      })),
    };
  }
}
