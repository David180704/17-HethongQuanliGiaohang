import { ErrorCodes } from "../../core/errors.js";
import { parseShiftDate } from "../shifts/shifts.validator.js";
import { routeScopeFor } from "../routes/routeScope.js";
import { effectiveCapacity } from "../capacity/capacity.js";

/** Ngay "YYYY-MM-DD" va gio "HH:mm" theo gio Viet Nam. */
export function vnNow(date) {
  const iso = new Date(date.getTime() + 7 * 3600e3).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const same = (a, b) => String(a) === String(b);
const MIN_REASON = 5;

/**
 * Phan cong lay hang (US-25) va danh sach don can lay cua nguoi giao hang (US-27).
 *
 * Tu dong: don vua CONFIRMED (consumer thu hai cua su kien order.status.changed) -> tuyen cua dia diem
 * lay hang -> cac ca hom nay cua tuyen con mo (som nhat truoc) -> chon nguoi trong ca co it don chua lay
 * nhat ma chua day nang luc (US-24) -> tao Assignment AUTO, don PICKUP_ASSIGNED. Khong co ca / moi nguoi
 * da day -> don o lai CONFIRMED trong hang cho, ghi ly do (unassignedReason).
 * Chong vuot nang luc: moi lan gan, trong CUNG transaction, tang Shift.assignSeq (khoa ca) roi moi dem tai.
 *
 * Dieu chinh tay: nhan vien kho trong pham vi hub chon nguoi khac, BAT BUOC ghi ly do; phan cong cu
 * CANCELLED; duoc vuot nang luc (qua tai, don uu tien) nhung tra ve canh bao overCapacity.
 */
export class AssignmentService {
  constructor({
    assignmentRepository,
    shiftRepository,
    orderRepository,
    routeRepository,
    userRepository,
    hubRepository,
    pickupLocationRepository,
    serviceAreaRepository,
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
      capacityService,
      transactions,
      orderEvents,
      clock,
    });
  }

  // ------------------------------------------------------------------ dung chung

  /** Tuyen lay hang cua tung don: Map orderId -> route (qua dia diem lay hang -> khu vuc -> tuyen). */
  async #pickupRoutes(orders) {
    const locationIds = [...new Set(orders.map((o) => String(o.pickupLocationId)).filter((id) => id !== "null"))];
    if (!locationIds.length) return new Map();
    const locations = await this.pickupLocationRepository.findMany({ _id: { $in: locationIds } }, { select: "serviceAreaId" });
    const areas = await this.serviceAreaRepository.findMany(
      { _id: { $in: locations.map((l) => l.serviceAreaId) } },
      { select: "routeId" },
    );
    const routes = await this.routeRepository.findMany(
      { _id: { $in: areas.map((a) => a.routeId) } },
      { select: "code name hubId maxPickupPerShift maxDeliveryPerShift" },
    );
    const routeById = new Map(routes.map((r) => [String(r._id), r]));
    const routeByArea = new Map(areas.map((a) => [String(a._id), routeById.get(String(a.routeId))]));
    const routeByLocation = new Map(locations.map((l) => [String(l._id), routeByArea.get(String(l.serviceAreaId))]));
    return new Map(orders.map((o) => [String(o._id), routeByLocation.get(String(o.pickupLocationId)) || null]));
  }

  async #pickupRoute(order) {
    return (await this.#pickupRoutes([order])).get(String(order._id));
  }

  async #hubScope(user) {
    if (user.role === "ADMIN") return {};
    const staff = await this.userRepository.findById(user.id);
    if (!staff?.hubId) return { _id: null };
    return { pickupHubId: { $in: await this.hubRepository.findFamilyIds(staff.hubId) } };
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
      console.error(`Khong phat duoc su kien phan cong don ${order.trackingCode}:`, err.message);
    }
  }

  async #queue(order, reason) {
    await this.orderRepository.updateWhere(
      { _id: order._id, status: "CONFIRMED", assignedTo: null },
      { $set: { unassignedReason: reason } },
    );
    return { status: "UNASSIGNED", trackingCode: order.trackingCode, reason };
  }

  // ------------------------------------------------------------------ tu dong

  /** Consumer su kien: chi xu ly don vua sang CONFIRMED. Idempotent (chay lai khi BullMQ thu lai). */
  onOrderStatusChanged(event) {
    if (event?.to !== "CONFIRMED") return null;
    return this.autoAssignPickup(event.orderId);
  }

  async autoAssignPickup(orderId, { by = null } = {}) {
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.status !== "CONFIRMED" || order.assignedTo || order.channel === "COUNTER") {
      return { status: "SKIPPED" };
    }
    const route = await this.#pickupRoute(order);
    if (!route) return this.#queue(order, "Không xác định được tuyến lấy hàng");
    const { day, time } = vnNow(this.clock());
    const shifts = await this.shiftRepository.findOpen({ routeId: route._id, shiftDate: parseShiftDate(day), time });
    const shippers = shifts.length
      ? await this.userRepository.findActiveShippers({ ids: shifts.flatMap((s) => s.shipperIds), routeIds: [route._id] })
      : [];
    if (!shippers.length) return this.#queue(order, `Tuyến ${route.code} chưa có người trực ca còn lại hôm nay`);
    const system = await this.capacityService.system();

    const result = await this.transactions.run(async (session) => {
      for (const shift of shifts) {
        const people = shippers.filter((s) => shift.shipperIds.some((id) => same(id, s._id)));
        if (!people.length) continue;
        await this.shiftRepository.lock(shift._id, { session });
        const loads = await this.assignmentRepository.shiftLoads(shift._id, "PICKUP", { session });
        const candidates = people
          .map((s) => ({
            shipper: s,
            capacity: effectiveCapacity({ shipper: s, route, system }, "pickup").value,
            ...(loads.get(String(s._id)) || { used: 0, pending: 0 }),
          }))
          .filter((c) => c.used < c.capacity)
          .sort((a, b) => a.pending - b.pending || a.used - b.used || a.shipper.fullName.localeCompare(b.shipper.fullName));
        if (!candidates.length) continue;
        const pick = candidates[0];
        const at = this.clock();
        const updated = await this.orderRepository.updateWhere(
          { _id: order._id, status: "CONFIRMED", assignedTo: null },
          {
            $set: { status: "PICKUP_ASSIGNED", assignedTo: pick.shipper._id, unassignedReason: null },
            $push: {
              statusHistory: {
                status: "PICKUP_ASSIGNED",
                at,
                by,
                note: `Phân công tự động: ${pick.shipper.fullName} (${shift.name} ${shift.startTime}–${shift.endTime})`,
              },
            },
          },
          { session },
        );
        if (!updated) return { status: "SKIPPED" };
        await this.assignmentRepository.insert(
          {
            orderId: order._id,
            shipperId: pick.shipper._id,
            type: "PICKUP",
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
    if (!result) return this.#queue(order, `Tuyến ${route.code}: người trực ca đã đủ năng lực`);
    if (result.status === "ASSIGNED") {
      await this.#publish(result.order, "CONFIRMED", by);
      delete result.order;
    }
    return result;
  }

  /** Chay lai phan cong tu dong cho hang cho trong pham vi (vd vua them ca / tang nang luc). */
  async runQueue(user) {
    const orders = await this.orderRepository.findMany(
      { ...(await this.#hubScope(user)), status: "CONFIRMED", assignedTo: null, channel: { $ne: "COUNTER" } },
      { select: "_id", sort: { createdAt: 1 } },
    );
    const results = [];
    for (const { _id } of orders) results.push(await this.autoAssignPickup(_id, { by: user.id }));
    return {
      assigned: results.filter((r) => r.status === "ASSIGNED").length,
      unassigned: results.filter((r) => r.status === "UNASSIGNED").length,
      results,
    };
  }

  // ------------------------------------------------------------------ dieu chinh tay

  async assignPickupManually(user, input = {}) {
    const reason = String(input.reason || "").trim();
    if (reason.length < MIN_REASON) throw ErrorCodes.VALIDATION_ERROR("Điều chỉnh phân công phải ghi lý do (ít nhất 5 ký tự)");
    if (!input.orderId || !input.shipperId) throw ErrorCodes.VALIDATION_ERROR("Thiếu đơn hoặc người giao hàng");
    const order = await this.orderRepository.findOne({ _id: input.orderId, ...(await this.#hubScope(user)) });
    if (!order) throw ErrorCodes.NOT_FOUND("Không tìm thấy đơn hàng");
    if (!["CONFIRMED", "PICKUP_ASSIGNED"].includes(order.status)) {
      throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} không còn ở bước chờ lấy hàng`);
    }
    if (order.assignedTo && same(order.assignedTo, input.shipperId)) {
      throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} đã được giao cho người này`);
    }
    const route = await this.#pickupRoute(order);
    if (!route) throw ErrorCodes.CONFLICT("Không xác định được tuyến lấy hàng của đơn");
    const [shipper] = await this.userRepository.findActiveShippers({ ids: [input.shipperId], routeIds: [route._id] });
    if (!shipper) throw ErrorCodes.VALIDATION_ERROR(`Người được chọn không phụ trách tuyến ${route.code} hoặc đã ngừng`);

    const { day, time } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const [shift] = await this.shiftRepository.findOpen({ routeId: route._id, shiftDate, time, shipperId: shipper._id });
    const system = await this.capacityService.system();
    const capacity = effectiveCapacity({ shipper, route, system }, "pickup").value;

    const result = await this.transactions.run(async (session) => {
      let used = 0;
      if (shift) {
        await this.shiftRepository.lock(shift._id, { session });
        used = (await this.assignmentRepository.shiftLoads(shift._id, "PICKUP", { session })).get(String(shipper._id))?.used || 0;
      }
      const overCapacity = Boolean(shift) && used >= capacity;
      const at = this.clock();
      const note = `Điều chỉnh phân công: ${shipper.fullName} — lý do: ${reason}${overCapacity ? " (vượt năng lực ca)" : ""}${shift ? "" : " (ngoài ca)"}`;
      const updated = await this.orderRepository.updateWhere(
        { _id: order._id, status: order.status, assignedTo: order.assignedTo ?? null },
        {
          $set: { status: "PICKUP_ASSIGNED", assignedTo: shipper._id, unassignedReason: null },
          $push: { statusHistory: { status: "PICKUP_ASSIGNED", at, by: user.id, note } },
        },
        { session },
      );
      if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được người khác phân công, tải lại để xem`);
      await this.assignmentRepository.cancelActive({ orderId: order._id, type: "PICKUP", by: user.id, at }, { session });
      await this.assignmentRepository.insert(
        {
          orderId: order._id,
          shipperId: shipper._id,
          type: "PICKUP",
          shiftDate: shift?.shiftDate ?? shiftDate,
          shiftId: shift?._id ?? null,
          method: "MANUAL",
          assignedBy: user.id,
          assignedAt: at,
          reason,
        },
        { session },
      );
      return { order: updated, overCapacity, load: shift ? used + 1 : null, capacity };
    });
    if (order.status === "CONFIRMED") await this.#publish(result.order, "CONFIRMED", user.id);
    return {
      trackingCode: result.order.trackingCode,
      status: result.order.status,
      shipper: { _id: shipper._id, fullName: shipper.fullName },
      shift: shift ? { _id: shift._id, code: shift.code, name: shift.name } : null,
      overCapacity: result.overCapacity,
      load: result.load,
      capacity: result.capacity,
    };
  }

  // ------------------------------------------------------------------ bang phan cong (kho)

  /** Hang cho, don da phan cong va tai tung nguoi trong cac ca hom nay cua tuyen trong pham vi. */
  async pickupBoard(user) {
    const scope = await this.#hubScope(user);
    const routeIds = await routeScopeFor(user, this);
    const { day } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const [queue, assigned, shifts, system] = await Promise.all([
      this.orderRepository.findMany(
        { ...scope, status: "CONFIRMED", assignedTo: null, channel: { $ne: "COUNTER" } },
        { select: "trackingCode customerName pickupWard pickupLocationId createdAt unassignedReason", sort: { createdAt: 1 } },
      ),
      this.orderRepository.findMany(
        { ...scope, status: "PICKUP_ASSIGNED" },
        { select: "trackingCode customerName pickupWard pickupLocationId assignedTo updatedAt", sort: { updatedAt: -1 } },
      ),
      this.shiftRepository.findForRoutes({ routeIds, shiftDate }),
      this.capacityService.system(),
    ]);
    const routes = await this.#pickupRoutes([...queue, ...assigned]);
    const routeDocs = await this.routeRepository.findActive(routeIds);
    const routeById = new Map(routeDocs.map((r) => [String(r._id), r]));
    const people = await this.userRepository.findActiveShippers({ routeIds: routeDocs.map((r) => r._id) });
    const personById = new Map(people.map((p) => [String(p._id), p]));
    const view = (o) => {
      const route = routes.get(String(o._id));
      return { ...o, route: route ? { _id: route._id, code: route.code } : null };
    };

    const shiftViews = [];
    for (const shift of shifts) {
      const route = routeById.get(String(shift.routeId?._id));
      const loads = await this.assignmentRepository.shiftLoads(shift._id, "PICKUP");
      shiftViews.push({
        _id: shift._id,
        code: shift.code,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        route: shift.routeId,
        shippers: shift.shipperIds.map((s) => {
          const person = personById.get(String(s._id)) || s;
          const load = loads.get(String(s._id)) || { used: 0, pending: 0 };
          return {
            _id: s._id,
            fullName: s.fullName,
            phone: s.phone,
            ...load,
            capacity: route ? effectiveCapacity({ shipper: person, route, system }, "pickup").value : null,
          };
        }),
      });
    }
    return {
      queue: queue.map(view),
      assigned: assigned.map((o) => ({ ...view(o), assignedTo: personById.get(String(o.assignedTo)) ? { _id: o.assignedTo, fullName: personById.get(String(o.assignedTo)).fullName } : { _id: o.assignedTo } })),
      shifts: shiftViews,
      // Lua chon cho dieu chinh tay: nguoi giao hang theo tuyen
      shippersByRoute: routeDocs.map((r) => ({
        _id: r._id,
        code: r.code,
        shippers: people.filter((p) => p.routeIds.some((id) => same(id, r._id))).map(({ _id, fullName }) => ({ _id, fullName })),
      })),
    };
  }

  // ------------------------------------------------------------------ nguoi giao hang (US-27)

  /** Don can lay cua chinh nguoi giao hang trong ngay, mac dinh loc theo ca hien tai (hoac shiftId). */
  async myPickups(user, query = {}) {
    if (user.role !== "SHIPPER") throw ErrorCodes.FORBIDDEN("Chỉ người giao hàng xem đơn cần lấy của mình");
    const { day, time } = vnNow(this.clock());
    const shiftDate = parseShiftDate(day);
    const shifts = await this.shiftRepository.findForRoutes({ shiftDate, shipperId: user.id });
    const current =
      shifts.find((s) => s.startTime <= time && time < s.endTime) || shifts.find((s) => s.endTime > time) || null;
    const selected = query.shiftId === "all" ? null : query.shiftId || (current ? String(current._id) : null);

    const assignments = (await this.assignmentRepository.findForShipper({ shipperId: user.id, shiftDate, type: "PICKUP" }))
      .filter((a) => !selected || same(a.shiftId, selected));
    const orders = await this.orderRepository.findMany(
      { _id: { $in: assignments.map((a) => a.orderId) }, assignedTo: user.id },
      { select: "trackingCode customerName pickupLocationId pickupWard item cod status statusHistory" },
    );
    const locations = await this.pickupLocationRepository.findMany(
      { _id: { $in: orders.map((o) => o.pickupLocationId) } },
      { select: "contactName contactPhone address ward district province" },
    );
    const locationById = new Map(locations.map((l) => [String(l._id), l]));
    const orderById = new Map(orders.map((o) => [String(o._id), o]));
    const items = assignments
      .filter((a) => orderById.has(String(a.orderId)))
      .map((a) => {
        const o = orderById.get(String(a.orderId));
        const loc = locationById.get(String(o.pickupLocationId));
        return {
          assignmentId: a._id,
          assignmentStatus: a.status,
          method: a.method,
          shiftId: a.shiftId,
          orderId: o._id,
          trackingCode: o.trackingCode,
          status: o.status,
          customerName: o.customerName,
          pickup: loc
            ? { contactName: loc.contactName, contactPhone: loc.contactPhone, address: [loc.address, loc.ward, loc.district, loc.province].filter(Boolean).join(", ") }
            : { address: o.pickupWard },
          item: { name: o.item?.name, weightGram: o.item?.weightGram },
          cod: o.cod?.enabled ? o.cod.amount : 0,
        };
      });
    return {
      shifts: shifts.map((s) => ({ _id: s._id, code: s.code, name: s.name, startTime: s.startTime, endTime: s.endTime, route: s.routeId })),
      currentShiftId: current?._id ?? null,
      selectedShiftId: selected,
      counts: {
        total: items.length,
        toPick: items.filter((i) => i.assignmentStatus === "ASSIGNED").length,
        done: items.filter((i) => i.assignmentStatus === "DONE").length,
        failed: items.filter((i) => i.assignmentStatus === "FAILED").length,
      },
      orders: items,
    };
  }
}
