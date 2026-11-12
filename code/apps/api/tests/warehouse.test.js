// US-41 quy trinh tai kho (de 02 + 14): nhap kho bang ma van don (AT_HUB, hoac AT_DEST_HUB o kho dich), phan loai
// theo loai hang va tuyen (SORTED), xuat kho len chang sau (IN_TRANSIT); nhan vien kho chi thao tac don cua hub minh.
// Don thu: lay o Cau Giay - Ha Noi (Hub Ha Noi), giao Quan 1 - TP HCM (kho dich Hub Ho Chi Minh).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { nextWarehouseAction, currentHubOf, parseCategory } from "../src/modules/warehouse/warehouse.js";
import { expressChecker, expressFirst } from "../src/modules/orders/priority.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["kho-wh-hn@edms.vn", "kho-wh-hcm@edms.vn", "kho-wh-khach@edms.vn", "kho-wh-tx@edms.vn"];

let app;
let token = {};
let hubs;
let standard;
let location;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);

/** Don da duoc tai xe lay (PICKED_UP) - buoc lay hang da kiem o US-28, o day ghi thang trang thai. */
async function pickedUpOrder(name, serviceType = standard) {
  const created = await as("khach", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: serviceType._id,
    receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
    item: { name: "Tivi 32 inch", weightGram: 6000, length: 80, width: 15, height: 50 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  await as("hn", request(app).post(`/orders/${created.body.data._id}/confirm`)).expect(200);
  await Order.updateOne(
    { _id: created.body.data._id },
    { $set: { status: "PICKED_UP" }, $push: { statusHistory: { status: "PICKED_UP", at: new Date(), note: "Đã lấy hàng" } } },
  );
  return created.body.data;
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM", "PO-DN"] } }).lean()).map((h) => [h.code, h]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909982800", passwordHash, fullName: "Kho HN Nhập xuất", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[1], phone: "0909982801", passwordHash, fullName: "Kho HCM Nhập xuất", role: "HUB_STAFF", hubId: hubs["HUB-HCM"]._id },
    { email: EMAILS[2], phone: "0909982802", passwordHash, fullName: "Shop Nhập xuất", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[3], phone: "0909982803", passwordHash, fullName: "Tài xế Nhập xuất", role: "SHIPPER" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { hn: await login(EMAILS[0]), hcm: await login(EMAILS[1]), khach: await login(EMAILS[2]), tx: await login(EMAILS[3]) };
  location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho Cầu Giấy", contactName: "Chủ shop", contactPhone: "0909982802", address: "1 Xuân Thủy",
      province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
    })
  ).body.data;
});

after(async () => {
  try {
    await cleanup();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-41] buoc tiep theo theo trang thai va kho: nhap kho, phan loai, xuat kho, nhan o kho dich", () => {
  const family = ["hn", "dn"];
  const base = { pickupHubId: "hn", destHubId: "hcm" };
  assert.deepEqual(nextWarehouseAction({ ...base, status: "PICKED_UP" }, family), { action: "RECEIVE" });
  assert.equal(nextWarehouseAction({ ...base, status: "PICKED_UP" }, ["hcm"]).action, null);
  assert.deepEqual(nextWarehouseAction({ ...base, status: "AT_HUB", currentHubId: "dn" }, family), { action: "SORT" });
  assert.deepEqual(nextWarehouseAction({ ...base, status: "SORTED" }, family), { action: "DISPATCH" }, "don cu: kho lay hang");
  assert.deepEqual(nextWarehouseAction({ ...base, status: "IN_TRANSIT" }, ["hcm"]), { action: "RECEIVE_DEST" });
  assert.match(nextWarehouseAction({ ...base, status: "IN_TRANSIT" }, family).reason, /kho khác/);
  assert.match(nextWarehouseAction({ ...base, status: "CREATED" }, family).reason, /không ở bước/);
  assert.equal(currentHubOf({ status: "AT_HUB", pickupHubId: "hn" }), "hn");
  assert.equal(currentHubOf({ status: "IN_TRANSIT", pickupHubId: "hn" }), null);
  assert.equal(parseCategory("TV"), "TV");
  assert.equal(parseCategory("FRIDGE"), null);
});

test("[US-41] nhap kho bang ma van don: kho cua don nhan -> AT_HUB, ghi nhan vien va thoi gian; kho khac bi chan", async () => {
  const order = await pickedUpOrder("E2E Kho nhập");
  await as("hcm", request(app).post("/warehouse/receive")).send({ trackingCode: order.trackingCode }).expect(409);
  const look = (await as("hn", request(app).get(`/warehouse/orders/${order.trackingCode.toLowerCase()}`)).expect(200)).body.data;
  assert.deepEqual([look.action, look.actionLabel], ["RECEIVE", "Nhận vào kho"]);
  assert.equal(look.destHub.code, "HUB-HCM");

  const res = (await as("hn", request(app).post("/warehouse/receive")).send({ trackingCode: order.trackingCode }).expect(200)).body.data;
  assert.equal(res.status, "AT_HUB");
  assert.equal(res.currentHub.code, "HUB-HN");
  assert.equal(res.action, "SORT");
  const saved = await Order.findById(order._id).lean();
  const last = saved.statusHistory.at(-1);
  assert.equal(last.status, "AT_HUB");
  assert.equal(last.note, `Nhập kho ${hubs["HUB-HN"].name}`);
  assert.ok(last.by && last.at);
  const again = await as("hn", request(app).post("/warehouse/receive")).send({ trackingCode: order.trackingCode }).expect(409);
  assert.match(again.body.error.message, /bước tiếp theo là "Phân loại"/);
});

test("[US-41] phan loai bat buoc loai hang (danh sach co dinh de 14) -> SORTED kem tuyen kho dich; xuat kho -> IN_TRANSIT", async () => {
  const order = await pickedUpOrder("E2E Kho phân loại");
  const code = order.trackingCode;
  await as("hn", request(app).post("/warehouse/receive")).send({ trackingCode: code }).expect(200);
  await as("hn", request(app).post("/warehouse/dispatch")).send({ trackingCode: code }).expect(409);
  await as("hn", request(app).post("/warehouse/sort")).send({ trackingCode: code }).expect(400);
  await as("hn", request(app).post("/warehouse/sort")).send({ trackingCode: code, category: "FRIDGE" }).expect(400);
  const sorted = (await as("hn", request(app).post("/warehouse/sort")).send({ trackingCode: code, category: "TV" }).expect(200)).body.data;
  assert.deepEqual([sorted.status, sorted.itemCategoryLabel, sorted.action], ["SORTED", "Tivi", "DISPATCH"]);
  assert.equal(sorted.done.note, `Phân loại tại ${hubs["HUB-HN"].name}: Tivi, chuyển tới ${hubs["HUB-HCM"].name}`);
  const out = (await as("hn", request(app).post("/warehouse/dispatch")).send({ trackingCode: code }).expect(200)).body.data;
  assert.equal(out.status, "IN_TRANSIT");
  assert.equal(out.action, null, "kho HN khong con thao tac");
  const categories = (await as("hn", request(app).get("/warehouse/categories")).expect(200)).body.data;
  assert.deepEqual(categories.map((c) => c.label), ["Gói nhỏ", "Bao", "Thùng", "Tivi", "Laptop", "CPU / máy tính", "Xe", "Khác"]);
});

test("[US-41] quyen va du lieu vao: tai xe, khach bi chan; ma sai dang 400; ma khong ton tai 404", async () => {
  await as("tx", request(app).get("/warehouse/stock")).expect(403);
  await as("khach", request(app).post("/warehouse/receive")).send({ trackingCode: "EXP1000000001" }).expect(403);
  await as("hn", request(app).get("/warehouse/orders/ABC")).expect(400);
  await as("hn", request(app).get("/warehouse/orders/EXP9999999999")).expect(404);
});

test("[US-41] ton kho: kho HN thay hang dang giu theo trang thai, loai hang va hang sap toi; kho HCM thay hang dang den", async () => {
  const waiting = await pickedUpOrder("E2E Kho chờ nhập");
  const held = await pickedUpOrder("E2E Kho đang giữ");
  await as("hn", request(app).post("/warehouse/receive")).send({ trackingCode: held.trackingCode }).expect(200);
  await as("hn", request(app).post("/warehouse/sort")).send({ trackingCode: held.trackingCode, category: "CARTON" }).expect(200);
  const hn = (await as("hn", request(app).get("/warehouse/stock")).expect(200)).body.data;
  assert.ok(hn.incoming.some((o) => o.trackingCode === waiting.trackingCode && o.action === "RECEIVE"));
  const row = hn.orders.find((o) => o.trackingCode === held.trackingCode);
  assert.deepEqual([row.status, row.itemCategoryLabel, row.action], ["SORTED", "Thùng", "DISPATCH"]);
  assert.ok(hn.counts.SORTED >= 1);
  assert.ok(hn.byCategory.some((c) => c.code === "CARTON" && c.total >= 1));

  await as("hn", request(app).post("/warehouse/dispatch")).send({ trackingCode: held.trackingCode }).expect(200);
  const hcm = (await as("hcm", request(app).get("/warehouse/stock")).expect(200)).body.data;
  assert.ok(hcm.incoming.some((o) => o.trackingCode === held.trackingCode && o.action === "RECEIVE_DEST"));
  assert.ok(!hcm.incoming.some((o) => o.trackingCode === waiting.trackingCode));
});

test("[US-41] luong nghiep vu: lay hang -> kho HN nhap, phan loai, xuat -> kho HCM nhan (AT_DEST_HUB) -> nguoi nhan tra cuu thay du moc", async () => {
  const order = await pickedUpOrder("E2E Kho luồng");
  const code = order.trackingCode;
  // Don cu chua luu kho dich: xoa destHubId de kiem tinh lai tu dia chi nguoi nhan
  await Order.updateOne({ _id: order._id }, { $set: { destHubId: null } });
  await as("hn", request(app).post("/warehouse/receive")).send({ trackingCode: code }).expect(200);
  assert.equal(String((await Order.findById(order._id).lean()).destHubId), String(hubs["HUB-HCM"]._id));
  await as("hn", request(app).post("/warehouse/sort")).send({ trackingCode: code, category: "TV" }).expect(200);
  await as("hn", request(app).post("/warehouse/dispatch")).send({ trackingCode: code }).expect(200);
  const arrived = (await as("hcm", request(app).post("/warehouse/receive")).send({ trackingCode: code }).expect(200)).body.data;
  assert.deepEqual([arrived.status, arrived.currentHub.code], ["AT_DEST_HUB", "HUB-HCM"]);

  const saved = await Order.findById(order._id).lean();
  assert.deepEqual(saved.statusHistory.slice(-4).map((h) => h.status), ["AT_HUB", "SORTED", "IN_TRANSIT", "AT_DEST_HUB"]);
  assert.equal(saved.statusHistory.at(-1).note, `Đến kho giao ${hubs["HUB-HCM"].name}`);
  await getRedis().del(`journey:${code}`);
  const journey = (await request(app).get(`/tracking/${code}`).expect(200)).body.data;
  assert.equal(journey.statusLabel, "Đã đến kho giao");
  assert.equal(journey.groupLabel, "Đã nhận – Chưa giao");
  assert.equal(journey.events.length, 7);
});

test("[US-41] gui nhanh uu tien: hang sap toi va ton kho xep don gui nhanh len dau, co nhan uu tien", async () => {
  const isExpress = expressChecker(["e1"]);
  const list = [{ id: 1, serviceTypeId: "s" }, { id: 2, serviceTypeId: "e1" }, { id: 3, serviceTypeId: "s" }, { id: 4, serviceTypeId: "e1" }];
  assert.deepEqual(expressFirst(list, isExpress).map((o) => o.id), [2, 4, 1, 3], "on dinh trong tung nhom");

  const express = await ServiceType.findOne({ code: "EXPRESS" }).lean();
  const slow = await pickedUpOrder("E2E Kho thường");
  const fast = await pickedUpOrder("E2E Kho nhanh", express);
  const hn = (await as("hn", request(app).get("/warehouse/stock")).expect(200)).body.data;
  const codes = hn.incoming.map((o) => o.trackingCode);
  assert.ok(codes.indexOf(fast.trackingCode) < codes.indexOf(slow.trackingCode), "don nhanh truoc don thuong");
  const firstNormal = hn.incoming.findIndex((o) => !o.express);
  const lastExpress = hn.incoming.map((o) => o.express).lastIndexOf(true);
  assert.ok(firstNormal === -1 || lastExpress < firstNormal, "moi don nhanh dung truoc moi don thuong");
  assert.equal(hn.incoming.find((o) => o.trackingCode === fast.trackingCode).express, true);
  const look = (await as("hn", request(app).get(`/warehouse/orders/${fast.trackingCode}`)).expect(200)).body.data;
  assert.equal(look.express, true);
});
