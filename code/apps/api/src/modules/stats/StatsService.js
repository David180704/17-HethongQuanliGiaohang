import mongoose from "mongoose";
import { ErrorCodes } from "../../core/errors.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const IN_TRANSIT = ["PICKED_UP", "AT_HUB", "SORTED", "IN_TRANSIT"];
const WAITING_DELIVERY = ["AT_DEST_HUB", "DELIVERY_ASSIGNED", "RESCHEDULED"];
// Moc trong hanh trinh tinh theo ky (dem so don co moc do trong khoang thoi gian)
const EVENTS = { created: "CREATED", pickedUp: "PICKED_UP", delivered: "DELIVERED", deliveryFailed: "DELIVERY_FAILED", returned: "RETURNED" };

function vnDay(value, label, endOfDay) {
  if (typeof value !== "string" || !DAY.test(value)) throw ErrorCodes.VALIDATION_ERROR(`${label} phải có dạng YYYY-MM-DD`);
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Thong ke van hanh (US-39, de 02) bang aggregation pipeline tren MongoDB - khong tai don ve ung dung:
 * so don duoc tao / da lay / dang van chuyen / dang cho giao / giao thanh cong / that bai / hoan tra, so don
 * theo shop, khu vuc giao va kho nhan, nang suat tung nguoi giao hang, doanh thu phi, tien thu ho va tinh
 * trang doi soat trong khoang thoi gian. Quan tri vien: toan he thong; nhan vien kho: don thuoc kho minh.
 */
export class StatsService {
  constructor({ orderModel, assignmentModel, settlementModel, userRepository, hubRepository, clock = () => new Date() }) {
    Object.assign(this, { orderModel, assignmentModel, settlementModel, userRepository, hubRepository, clock });
  }

  async #orderScope(user) {
    if (user.role === "ADMIN") return {};
    if (user.role !== "HUB_STAFF") throw ErrorCodes.FORBIDDEN("Chỉ quản trị viên và nhân viên kho xem thống kê");
    const staff = await this.userRepository.findById(user.id);
    const ids = staff?.hubId ? (await this.hubRepository.findFamilyIds(staff.hubId)).map(oid) : [];
    return { $or: [{ pickupHubId: { $in: ids } }, { destHubId: { $in: ids } }] };
  }

  #period(query) {
    const today = new Date(this.clock().getTime() + 7 * 3600e3).toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 8)}01`;
    const from = vnDay(query.from || monthStart, "Từ ngày", false);
    const to = vnDay(query.to || today, "Đến ngày", true);
    if (from > to) throw ErrorCodes.VALIDATION_ERROR("Từ ngày phải trước đến ngày");
    return { from, to };
  }

  async overview(user, query = {}) {
    const scope = await this.#orderScope(user);
    const { from, to } = this.#period(query);
    const created = { ...scope, createdAt: { $gte: from, $lte: to } };
    const Order = this.orderModel;

    const [events, now, byStatus, byShop, byArea, byHub, money, cod, productivity, settlements] = await Promise.all([
      // So don co moc trong ky (moi don dem mot lan cho moi loai moc)
      Order.aggregate([
        { $match: { ...scope, "statusHistory.at": { $gte: from, $lte: to } } },
        { $unwind: "$statusHistory" },
        { $match: { "statusHistory.at": { $gte: from, $lte: to }, "statusHistory.status": { $in: Object.values(EVENTS) } } },
        { $group: { _id: { status: "$statusHistory.status", order: "$_id" } } },
        { $group: { _id: "$_id.status", orders: { $sum: 1 } } },
      ]),
      // Anh chup hien tai: dang van chuyen, dang cho giao
      Order.aggregate([
        { $match: { ...scope, status: { $in: [...IN_TRANSIT, ...WAITING_DELIVERY] } } },
        { $group: { _id: { $cond: [{ $in: ["$status", IN_TRANSIT] }, "inTransit", "waitingDelivery"] }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([{ $match: created }, { $group: { _id: "$status", orders: { $sum: 1 } } }, { $sort: { orders: -1 } }]),
      Order.aggregate([
        { $match: created },
        {
          $group: {
            _id: "$customerId",
            customerName: { $first: "$customerName" },
            orders: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ["$status", "RETURNED"] }, 1, 0] } },
            revenue: { $sum: "$fee.total" },
          },
        },
        { $sort: { orders: -1, customerName: 1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: created },
        { $group: { _id: "$receiver.province", orders: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } } } },
        { $sort: { orders: -1, _id: 1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: created },
        { $group: { _id: "$pickupHubId", orders: { $sum: 1 } } },
        { $lookup: { from: "hubs", localField: "_id", foreignField: "_id", as: "hub" } },
        { $project: { orders: 1, code: { $first: "$hub.code" }, name: { $first: "$hub.name" } } },
        { $sort: { orders: -1 } },
      ]),
      // Doanh thu phi: don da khoa phi (xac nhan) trong ky
      Order.aggregate([
        { $match: { ...scope, "fee.lockedAt": { $gte: from, $lte: to } } },
        { $group: { _id: null, revenue: { $sum: "$fee.total" }, orders: { $sum: 1 } } },
      ]),
      // Tien thu ho da thu trong ky
      Order.aggregate([
        { $match: { ...scope, "cod.collected": true, "cod.collectedAt": { $gte: from, $lte: to } } },
        { $group: { _id: "$cod.method", amount: { $sum: "$cod.amount" }, orders: { $sum: 1 } } },
      ]),
      // Nang suat: phan cong lay / giao / hoan ket thuc trong ky, theo nguoi
      this.assignmentModel.aggregate([
        { $match: { doneAt: { $gte: from, $lte: to }, status: { $in: ["DONE", "FAILED"] } } },
        ...(scope.$or
          ? [
              { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order", pipeline: [{ $match: scope }, { $project: { _id: 1 } }] } },
              { $match: { "order.0": { $exists: true } } },
            ]
          : []),
        {
          $group: {
            _id: "$shipperId",
            pickups: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "PICKUP"] }, { $eq: ["$status", "DONE"] }] }, 1, 0] } },
            deliveries: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "DELIVERY"] }, { $eq: ["$status", "DONE"] }] }, 1, 0] } },
            returns: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "RETURN"] }, { $eq: ["$status", "DONE"] }] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
          },
        },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user", pipeline: [{ $project: { fullName: 1 } }] } },
        { $project: { pickups: 1, deliveries: 1, returns: 1, failed: 1, fullName: { $first: "$user.fullName" } } },
        { $addFields: { done: { $add: ["$pickups", "$deliveries", "$returns"] } } },
        { $sort: { done: -1, fullName: 1 } },
      ]),
      // Doi soat: chi quan tri vien (ke toan) - ky lap trong khoang thoi gian
      user.role === "ADMIN"
        ? this.settlementModel.aggregate([
            { $match: { createdAt: { $gte: from, $lte: to } } },
            { $group: { _id: "$status", periods: { $sum: 1 }, netPayable: { $sum: "$totals.netPayable" }, cod: { $sum: "$totals.cod" } } },
          ])
        : Promise.resolve([]),
    ]);

    const eventCount = Object.fromEntries(events.map((e) => [e._id, e.orders]));
    const nowCount = Object.fromEntries(now.map((e) => [e._id, e.orders]));
    const codByMethod = Object.fromEntries(cod.map((c) => [c._id || "UNKNOWN", { amount: c.amount, orders: c.orders }]));
    const settlementBy = Object.fromEntries(settlements.map((s) => [s._id, { periods: s.periods, netPayable: s.netPayable, cod: s.cod }]));
    return {
      period: { from, to },
      scope: user.role === "ADMIN" ? "ALL" : "HUB",
      orders: {
        created: eventCount.CREATED || 0,
        pickedUp: eventCount.PICKED_UP || 0,
        inTransit: nowCount.inTransit || 0,
        waitingDelivery: nowCount.waitingDelivery || 0,
        delivered: eventCount.DELIVERED || 0,
        deliveryFailed: eventCount.DELIVERY_FAILED || 0,
        returned: eventCount.RETURNED || 0,
      },
      byStatus: byStatus.map((s) => ({ status: s._id, orders: s.orders })),
      byShop: byShop.map((s) => ({ customerId: s._id, customerName: s.customerName, orders: s.orders, delivered: s.delivered, returned: s.returned, revenue: s.revenue })),
      byArea: byArea.map((a) => ({ province: a._id, orders: a.orders, delivered: a.delivered })),
      byHub: byHub.map((h) => ({ hubId: h._id, code: h.code || null, name: h.name || "Chưa xác định", orders: h.orders })),
      shippers: productivity.map((p) => ({ shipperId: p._id, fullName: p.fullName, pickups: p.pickups, deliveries: p.deliveries, returns: p.returns, failed: p.failed })),
      revenue: { fee: money[0]?.revenue || 0, orders: money[0]?.orders || 0 },
      cod: {
        collected: cod.reduce((sum, c) => sum + c.amount, 0),
        orders: cod.reduce((sum, c) => sum + c.orders, 0),
        cash: codByMethod.CASH?.amount || 0,
        transfer: codByMethod.TRANSFER?.amount || 0,
      },
      settlements: user.role === "ADMIN" ? { pending: settlementBy.PENDING || { periods: 0, netPayable: 0, cod: 0 }, paid: settlementBy.PAID || { periods: 0, netPayable: 0, cod: 0 } } : null,
    };
  }
}
