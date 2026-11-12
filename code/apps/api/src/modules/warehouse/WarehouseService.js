import { ErrorCodes } from "../../core/errors.js";
import { STATUS_LABELS } from "../orders/orderStatus.js";
import { ITEM_CATEGORY_LABELS, WAREHOUSE_ACTIONS, currentHubOf, nextWarehouseAction, parseCategory } from "./warehouse.js";
import { expressChecker, expressFirst } from "../orders/priority.js";

const TRACKING = /^EXP\d{10}$/;
const STOCK_STATUSES = ["AT_HUB", "SORTED", "AT_DEST_HUB"];

/**
 * Quy trinh tai kho (US-41, de 02 + 14): nhan vien kho nhap ma van don (quet) -> nhan vao kho (AT_HUB, hoac
 * AT_DEST_HUB neu la kho dich) -> phan loai theo loai hang va tuyen (SORTED) -> xuat kho len chang sau
 * (IN_TRANSIT). Moi buoc ghi nhan vien, thoi gian, kho vao hanh trinh; chi thao tac don cua hub minh (va buu cuc
 * truc thuoc). Doi trang thai CO DIEU KIEN (status cu) nen hai nguoi cung quet thi chi mot nguoi thanh cong.
 */
export class WarehouseService {
  constructor({ orderRepository, userRepository, hubRepository, serviceAreaRepository, routeRepository, serviceTypeRepository, orderEvents, clock = () => new Date() }) {
    Object.assign(this, { orderRepository, userRepository, hubRepository, serviceAreaRepository, routeRepository, serviceTypeRepository, orderEvents, clock });
  }

  async #isExpress() {
    const express = this.serviceTypeRepository ? await this.serviceTypeRepository.findMany({ code: "EXPRESS" }, { select: "_id" }) : [];
    return expressChecker(express.map((s) => s._id));
  }

  async #staff(user) {
    if (user.role !== "HUB_STAFF") throw ErrorCodes.FORBIDDEN("Chỉ nhân viên kho thao tác nhập / xuất kho");
    const staff = await this.userRepository.findById(user.id);
    if (!staff?.hubId) throw ErrorCodes.FORBIDDEN("Bạn chưa được gán điểm phụ trách");
    const [hub] = await this.hubRepository.findMany({ _id: staff.hubId }, { select: "code name" });
    return { staff, hub, familyIds: await this.hubRepository.findFamilyIds(staff.hubId) };
  }

  /** Kho dich: luu luc tao don; don cu thi tinh tu khu vuc nguoi nhan -> tuyen -> hub. */
  async #destHubId(order) {
    if (order.destHubId) return order.destHubId;
    const area = await this.serviceAreaRepository.findByLocation(order.receiver?.province, order.receiver?.district);
    const route = area ? await this.routeRepository.findById(area.routeId) : null;
    return route?.hubId ?? null;
  }

  async #findByCode(code) {
    const trackingCode = String(code || "").trim().toUpperCase();
    if (!TRACKING.test(trackingCode)) throw ErrorCodes.VALIDATION_ERROR("Mã vận đơn dạng EXP + 10 chữ số");
    const order = await this.orderRepository.findOne({ trackingCode });
    if (!order) throw ErrorCodes.NOT_FOUND(`Không tìm thấy đơn ${trackingCode}`);
    return order;
  }

  async #hubNames(ids) {
    const hubs = await this.hubRepository.findMany({ _id: { $in: ids.filter(Boolean) } }, { select: "code name" });
    return new Map(hubs.map((h) => [String(h._id), h]));
  }

  #view(order, { action, reason }, hubs, destHubId) {
    const hub = (id) => (id ? hubs.get(String(id)) || null : null);
    return {
      _id: order._id,
      trackingCode: order.trackingCode,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      customerName: order.customerName,
      receiver: { district: order.receiver?.district, province: order.receiver?.province },
      item: { name: order.item?.name, weightGram: order.item?.weightGram },
      serviceName: order.serviceName,
      // Gui nhanh: uu tien xu ly / xuat kho truoc
      express: Boolean(order.express),
      itemCategory: order.itemCategory,
      itemCategoryLabel: order.itemCategory ? ITEM_CATEGORY_LABELS[order.itemCategory] : null,
      pickupHub: hub(order.pickupHubId),
      currentHub: hub(currentHubOf(order)),
      destHub: hub(destHubId),
      action,
      actionLabel: action ? WAREHOUSE_ACTIONS[action].label : null,
      reason: reason ?? null,
    };
  }

  /** Quet ma: thong tin don va buoc ke tiep nhan vien nay lam duoc. */
  async lookup(user, code) {
    const { familyIds } = await this.#staff(user);
    const order = await this.#findByCode(code);
    const destHubId = await this.#destHubId(order);
    const next = nextWarehouseAction(order, familyIds, destHubId);
    const hubs = await this.#hubNames([order.pickupHubId, currentHubOf(order), destHubId]);
    const isExpress = await this.#isExpress();
    return this.#view({ ...order, express: isExpress(order) }, next, hubs, destHubId);
  }

  async #advance(user, input, expected) {
    const { staff, hub, familyIds } = await this.#staff(user);
    const order = await this.#findByCode(input.trackingCode);
    const destHubId = await this.#destHubId(order);
    const { action, reason } = nextWarehouseAction(order, familyIds, destHubId);
    if (!expected.includes(action)) {
      throw ErrorCodes.CONFLICT(`${order.trackingCode}: ${reason || `bước tiếp theo là "${WAREHOUSE_ACTIONS[action].label}"`} (${STATUS_LABELS[order.status]})`);
    }
    const to = WAREHOUSE_ACTIONS[action].to;
    const at = this.clock();
    const hubs = await this.#hubNames([destHubId]);
    const set = { status: to };
    let note;
    if (action === "RECEIVE" || action === "RECEIVE_DEST") {
      set.currentHubId = staff.hubId;
      if (!order.destHubId && destHubId) set.destHubId = destHubId;
      note = `${action === "RECEIVE" ? "Nhập kho" : "Đến kho giao"} ${hub.name}`;
    } else if (action === "SORT") {
      const category = parseCategory(input.category);
      if (!category) throw ErrorCodes.VALIDATION_ERROR("Chọn loại hàng để phân loại");
      set.itemCategory = category;
      note = `Phân loại tại ${hub.name}: ${ITEM_CATEGORY_LABELS[category]}, chuyển tới ${hubs.get(String(destHubId))?.name || "kho giao"}`;
    } else {
      note = `Xuất kho ${hub.name} đi ${hubs.get(String(destHubId))?.name || "kho giao"}`;
    }
    const updated = await this.orderRepository.updateWhere(
      { _id: order._id, status: order.status },
      { $set: set, $push: { statusHistory: { status: to, at, by: staff._id, note } } },
    );
    if (!updated) throw ErrorCodes.CONFLICT(`Đơn ${order.trackingCode} vừa được người khác cập nhật`);
    await this.#publish(updated, order.status, staff._id);
    const after = nextWarehouseAction(updated, familyIds, destHubId);
    const names = await this.#hubNames([updated.pickupHubId, currentHubOf(updated), destHubId]);
    return { ...this.#view(updated, after, names, destHubId), done: { action, note } };
  }

  receive(user, input = {}) {
    return this.#advance(user, input, ["RECEIVE", "RECEIVE_DEST"]);
  }

  sort(user, input = {}) {
    return this.#advance(user, input, ["SORT"]);
  }

  dispatch(user, input = {}) {
    return this.#advance(user, input, ["DISPATCH"]);
  }

  /** Ton kho cua nhom hub: hang dang giu (theo trang thai, loai hang) va hang sap toi. */
  async stock(user) {
    const { familyIds } = await this.#staff(user);
    const select = "trackingCode status customerName receiver item itemCategory pickupHubId currentHubId destHubId serviceTypeId serviceName updatedAt";
    const [held, legacy, incoming] = await Promise.all([
      this.orderRepository.findMany({ currentHubId: { $in: familyIds }, status: { $in: STOCK_STATUSES } }, { select, sort: { updatedAt: -1 } }),
      // Don cu chua co currentHubId: coi nhu dang o kho lay hang
      this.orderRepository.findMany({ currentHubId: null, pickupHubId: { $in: familyIds }, status: { $in: ["AT_HUB", "SORTED"] } }, { select, sort: { updatedAt: -1 } }),
      this.orderRepository.findMany(
        { $or: [{ status: "PICKED_UP", pickupHubId: { $in: familyIds } }, { status: "IN_TRANSIT", destHubId: { $in: familyIds } }] },
        { select, sort: { updatedAt: -1 } },
      ),
    ]);
    const isExpress = await this.#isExpress();
    const mark = (list) => expressFirst(list, isExpress).map((o) => ({ ...o, express: isExpress(o) }));
    const orders = mark([...held, ...legacy]);
    const incomingSorted = mark(incoming);
    const hubs = await this.#hubNames([...orders, ...incoming].flatMap((o) => [o.pickupHubId, currentHubOf(o), o.destHubId]));
    const row = (o) => this.#view(o, nextWarehouseAction(o, familyIds), hubs, o.destHubId);
    const count = (status) => orders.filter((o) => o.status === status).length;
    const byCategory = {};
    for (const o of orders.filter((x) => x.itemCategory)) byCategory[o.itemCategory] = (byCategory[o.itemCategory] || 0) + 1;
    return {
      counts: { AT_HUB: count("AT_HUB"), SORTED: count("SORTED"), AT_DEST_HUB: count("AT_DEST_HUB"), incoming: incoming.length },
      byCategory: Object.entries(byCategory).map(([code, total]) => ({ code, label: ITEM_CATEGORY_LABELS[code], total })),
      orders: orders.map(row),
      incoming: incomingSorted.map(row),
    };
  }

  async #publish(order, from, by) {
    if (!this.orderEvents) return;
    try {
      await this.orderEvents.publish("order.status.changed", {
        orderId: String(order._id),
        trackingCode: order.trackingCode,
        from,
        to: order.status,
        by: String(by),
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Khong phat duoc su kien kho cho don ${order.trackingCode}:`, err.message);
    }
  }
}
