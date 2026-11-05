// US-20: khach xem danh sach don cua minh (loc nhom trang thai, khoang ngay tao, tim kiem) va chi tiet
// don kem toan bo hanh trinh co nhan. Nhom trang thai theo de 14 (orderStatus.js): Chua nhan, Da nhan -
// Chua giao, Da nhan - Dang giao, Da giao; don INCIDENT lay nhom cua trang thai lien truoc.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { ORDER_STATUS } from "../src/constants/enums.js";
import { CUSTOMER_GROUPS, STATUS_LABELS, customerGroup, withDisplay } from "../src/modules/orders/orderStatus.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["list-khach-a@edms.vn", "list-khach-b@edms.vn", "list-kho-hn@edms.vn"];

let app;
let token = {};
let standard;
let location;
const orders = {}; // ten -> don cua khach A

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const history = (...statuses) => statuses.map((status, i) => ({ status, at: new Date(Date.UTC(2026, 9, 1, i)) }));
// Ghi thang vao collection (bo qua middleware timestamps cua Mongoose) de dung trang thai / ngay tao mong muon
const setRaw = (order, fields) => Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(order._id) }, { $set: fields });
const vn = (iso) => new Date(`${iso}+07:00`);
const list = async (who, query = "") => {
  const res = await as(who, request(app).get(`/orders?limit=100${query}`));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const codes = (body) => body.data.map((o) => o.trackingCode).sort();

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909982001", passwordHash, fullName: "Khách Danh Sách A", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[1], phone: "0909982002", passwordHash, fullName: "Khách Danh Sách B", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[2], phone: "0909982003", passwordHash, fullName: "Kho HN Danh Sách", role: "HUB_STAFF", hubId: hn._id },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { a: await login(EMAILS[0]), b: await login(EMAILS[1]), hn: await login(EMAILS[2]) };

  const addLocation = async (who, phone) =>
    (await as(who, request(app).post("/pickupLocations")).send({
      label: "Kho nhà", contactName: "Người gửi", contactPhone: phone, address: "1 Xuân Thủy",
      province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
    })).body.data;
  location = await addLocation("a", "0909982001");
  const locationB = await addLocation("b", "0909982002");
  const create = async (who, pickup, receiverName) => {
    const res = await as(who, request(app).post("/orders")).send({
      pickupLocationId: pickup._id,
      serviceTypeId: standard._id,
      receiver: { name: receiverName, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
      item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10 },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  };
  for (const name of ["moi", "daLay", "dangGiao", "daGiao", "suCo"]) orders[name] = await create("a", location, `Nhận ${name}`);
  orders.cuaB = await create("b", locationB, "Nhận của B");

  await setRaw(orders.moi, { createdAt: vn("2026-10-01T10:00:00") });
  await setRaw(orders.daLay, {
    status: "PICKED_UP",
    statusHistory: history("CREATED", "CONFIRMED", "PICKUP_ASSIGNED", "PICKED_UP"),
    createdAt: vn("2026-10-15T23:30:00"),
  });
  // 00:30 ngay 16 gio Viet Nam = 17:30 ngay 15 gio UTC: phai tinh la ngay 16
  await setRaw(orders.dangGiao, {
    status: "OUT_FOR_DELIVERY",
    statusHistory: history("CREATED", "CONFIRMED", "PICKED_UP", "AT_DEST_HUB", "OUT_FOR_DELIVERY"),
    createdAt: vn("2026-10-16T00:30:00"),
  });
  await setRaw(orders.daGiao, {
    status: "DELIVERED",
    statusHistory: history("CREATED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"),
    createdAt: vn("2026-10-20T09:00:00"),
  });
  await setRaw(orders.suCo, {
    status: "INCIDENT",
    statusHistory: history("CREATED", "CONFIRMED", "PICKED_UP", "INCIDENT"),
    createdAt: vn("2026-10-21T09:00:00"),
  });
});

after(async () => {
  try {
    await cleanup();
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-20] moi trang thai (tru INCIDENT) thuoc dung mot trong 4 nhom cua de 14 va co nhan tieng Viet", () => {
  assert.deepEqual(CUSTOMER_GROUPS.map((g) => g.label), ["Chưa nhận", "Đã nhận – Chưa giao", "Đã nhận – Đang giao", "Đã giao"]);
  for (const status of ORDER_STATUS) {
    assert.ok(STATUS_LABELS[status], `thieu nhan cua ${status}`);
    const owners = CUSTOMER_GROUPS.filter((g) => g.statuses.includes(status));
    assert.equal(owners.length, status === "INCIDENT" ? 0 : 1, `${status} phai thuoc dung mot nhom`);
  }
});

test("[US-20] don INCIDENT lay nhom cua trang thai lien truoc (bo qua cac moc INCIDENT lien tiep)", () => {
  const group = (statuses) => customerGroup({ status: statuses.at(-1), statusHistory: history(...statuses) }).code;
  assert.equal(group(["CREATED", "INCIDENT"]), "NOT_RECEIVED");
  assert.equal(group(["CREATED", "PICKED_UP", "INCIDENT"]), "RECEIVED");
  assert.equal(group(["CREATED", "PICKED_UP", "OUT_FOR_DELIVERY", "INCIDENT", "INCIDENT"]), "DELIVERING");
  const shown = withDisplay({ status: "INCIDENT", statusHistory: history("CREATED", "PICKED_UP", "INCIDENT") });
  assert.deepEqual(shown.display, { statusLabel: "Đang xử lý sự cố", group: "RECEIVED", groupLabel: "Đã nhận – Chưa giao" });
  assert.deepEqual(shown.statusHistory.map((h) => h.label), ["Chờ bưu cục xác nhận", "Đã lấy hàng", "Đang xử lý sự cố"]);
});

test("[US-20] khach chi thay don cua minh, moi nhat truoc, moi don kem nhom trang thai va nhan hanh trinh", async () => {
  const body = await list("a");
  assert.equal(body.meta.total, 5, "khong lan don cua khach B");
  assert.ok(!codes(body).includes(orders.cuaB.trackingCode));
  const times = body.data.map((o) => new Date(o.createdAt).getTime());
  assert.deepEqual(times, [...times].sort((x, y) => y - x), "moi nhat truoc");
  const daLay = body.data.find((o) => o.trackingCode === orders.daLay.trackingCode);
  assert.deepEqual(daLay.display, { statusLabel: "Đã lấy hàng", group: "RECEIVED", groupLabel: "Đã nhận – Chưa giao" });
  assert.equal(daLay.statusHistory.at(-1).label, "Đã lấy hàng");
  assert.equal((await list("b")).meta.total, 1);
});

test("[US-20] loc theo nhom trang thai: khop dung nhom hien thi, ke ca don INCIDENT", async () => {
  const expect = {
    NOT_RECEIVED: [orders.moi],
    RECEIVED: [orders.daLay, orders.suCo],
    DELIVERING: [orders.dangGiao],
    DELIVERED: [orders.daGiao],
  };
  for (const [group, want] of Object.entries(expect)) {
    const body = await list("a", `&group=${group}`);
    assert.deepEqual(codes(body), want.map((o) => o.trackingCode).sort(), group);
    assert.ok(body.data.every((o) => o.display.group === group), `${group}: nhom hien thi khop bo loc`);
  }
});

test("[US-20] loc theo khoang ngay tao tinh theo gio Viet Nam, ket hop tim theo ma van don", async () => {
  assert.deepEqual(codes(await list("a", "&from=2026-10-15&to=2026-10-15")), [orders.daLay.trackingCode],
    "00:30 ngay 16 (gio VN) khong thuoc ngay 15");
  assert.deepEqual(codes(await list("a", "&from=2026-10-16&to=2026-10-16")), [orders.dangGiao.trackingCode]);
  assert.deepEqual(codes(await list("a", "&from=2026-10-01&to=2026-10-15")),
    [orders.moi.trackingCode, orders.daLay.trackingCode].sort());
  assert.deepEqual(codes(await list("a", "&from=2026-10-20")), [orders.daGiao.trackingCode, orders.suCo.trackingCode].sort());
  assert.deepEqual(codes(await list("a", `&search=${orders.dangGiao.trackingCode}&group=DELIVERING`)), [orders.dangGiao.trackingCode]);
  assert.equal((await list("a", `&search=${orders.dangGiao.trackingCode}&group=DELIVERED`)).meta.total, 0,
    "tim kiem va loc nhom cung ap dung (khong de nhau)");
});

test("[US-20] bo loc sai -> 400: nhom la, ngay sai dinh dang, ngay khong ton tai, tu ngay sau den ngay", async () => {
  for (const query of ["group=ABC", "from=15/10/2026", "to=2026-02-30", "from=2026-10-20&to=2026-10-01"]) {
    const res = await as("a", request(app).get(`/orders?${query}`));
    assert.equal(res.status, 400, query);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
});

test("[US-20] chi tiet don: toan bo hanh trinh co nhan; don cua khach khac -> 404", async () => {
  const res = await as("a", request(app).get(`/orders/${orders.dangGiao._id}`));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.statusHistory.map((h) => h.label),
    ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng", "Đã lấy hàng", "Đã đến kho giao", "Đang giao hàng"]);
  assert.equal(res.body.data.display.groupLabel, "Đã nhận – Đang giao");
  assert.equal((await as("a", request(app).get(`/orders/${orders.cuaB._id}`))).status, 404);
});

test("[US-20] luong nghiep vu: khach tao don -> Chua nhan; kho duyet -> hanh trinh 2 moc, phi khoa; lay hang -> Da nhan", async () => {
  const created = await as("a", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name: "Nhận luồng US-20", phone: "0912345678", address: "9 Lê Lợi", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Thành" },
    item: { name: "Áo", weightGram: 500, length: 20, width: 15, height: 5 },
  });
  assert.equal(created.status, 201);
  const order = created.body.data;
  assert.equal(order.display.statusLabel, "Chờ bưu cục xác nhận");

  const waiting = await list("a", "&group=NOT_RECEIVED");
  assert.ok(codes(waiting).includes(order.trackingCode), "don moi o nhom Chua nhan");

  const confirmed = await as("hn", request(app).post(`/orders/${order._id}/confirm`));
  assert.equal(confirmed.status, 200);
  const detail = (await as("a", request(app).get(`/orders/${order._id}`))).body.data;
  assert.deepEqual(detail.statusHistory.map((h) => h.label), ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng"]);
  assert.ok(detail.fee.lockedAt, "phi da khoa");
  assert.equal(detail.display.group, "NOT_RECEIVED", "da xac nhan nhung cong ty chua nhan hang");

  // gia lap nguoi giao hang lay hang (US-28 lam o Sprint 5)
  await Order.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(order._id) },
    { $set: { status: "PICKED_UP" }, $push: { statusHistory: { status: "PICKED_UP", at: new Date() } } },
  );
  const received = await list("a", "&group=RECEIVED");
  assert.ok(codes(received).includes(order.trackingCode), "lay hang xong -> Da nhan - Chua giao");
  assert.ok(!codes(await list("a", "&group=NOT_RECEIVED")).includes(order.trackingCode));
});
