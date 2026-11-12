// US-15: dia diem lay hang cua khach - toi da 10, tu xac dinh khu vuc phuc vu,
// chan dia diem ngoai vung phuc vu, chan xoa khi con don chua hoan tat.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers, suspendAreas } from "./helpers/fixtures.js";
import { User } from "../src/models/User.js";
import { Route } from "../src/models/Route.js";
import { ServiceArea } from "../src/models/ServiceArea.js";
import { ServiceType } from "../src/models/ServiceType.js";
import { PickupLocation } from "../src/models/PickupLocation.js";
import { Order } from "../src/models/Order.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["pick-khach-a@edms.vn", "pick-khach-b@edms.vn", "pick-kho@edms.vn", "pick-flow@edms.vn", "pick-admin@edms.vn"];
const TEST_AREA = { province: "Điện Biên", ward: "Phường Mường Lay" };
const OUTSIDE = [{ province: "Hà Nội", ward: "Xã Sóc Sơn" }, { province: "Lào Cai", ward: "Phường Sa Pa" }];
let restoreAreas;
const TEST_TRACKING = /^EXP99150/;

let app;
let customerA;
let tokenA;
let tokenB;
let hubStaffToken;
let adminToken;

async function cleanup() {
  const users = await User.find({ email: { $in: EMAILS } }).select("_id").lean();
  const ids = users.map((u) => u._id);
  await Order.deleteMany({ trackingCode: TEST_TRACKING });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ email: { $in: EMAILS } });
}

const loginToken = async (email) =>
  (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  restoreAreas = await suspendAreas([TEST_AREA, ...OUTSIDE]);
  app = createApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const hub = await mongoose.connection.collection("hubs").findOne({ code: "HUB-HN" });
  const customer = (email, phone, fullName) => ({
    email,
    phone,
    passwordHash,
    fullName,
    role: "CUSTOMER",
    customerType: "INDIVIDUAL",
  });
  [customerA] = await User.create([
    customer(EMAILS[0], "0909981501", "Khách A"),
    customer(EMAILS[1], "0909981502", "Khách B"),
    { email: EMAILS[2], phone: "0909981503", passwordHash, fullName: "Kho T15", role: "HUB_STAFF", hubId: hub._id },
    { email: EMAILS[4], phone: "0909981504", passwordHash, fullName: "Admin T15", role: "ADMIN" },
  ]);
  tokenA = await loginToken(EMAILS[0]);
  tokenB = await loginToken(EMAILS[1]);
  hubStaffToken = await loginToken(EMAILS[2]);
  adminToken = await loginToken(EMAILS[4]);
});

after(async () => {
  try {
    await cleanup();
    await restoreAreas?.();
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const as = (token, req) => req.set("Authorization", `Bearer ${token}`);
const location = (overrides = {}) => ({
  label: "Kho Cầu Giấy",
  contactName: "Nguyễn Văn A",
  contactPhone: "0909 123 456",
  address: "12 Trần Thái Tông",
  province: "ha noi",
  ward: "cau giay",
  ...overrides,
});
const addLocation = (token, overrides) => as(token, request(app).post("/pickupLocations")).send(location(overrides));
const listLocations = (token) => as(token, request(app).get("/pickupLocations"));

// Don hang toi thieu tro vao dia diem lay hang - du de kiem tra "con don chua hoan tat"
async function placeOrder(pickupLocation, status, seq) {
  const serviceType = await ServiceType.findOne({ code: "STANDARD" }).lean();
  return Order.create({
    trackingCode: `EXP99150${String(seq).padStart(5, "0")}`,
    customerId: pickupLocation.customerId,
    customerName: "Khách A",
    pickupLocationId: pickupLocation._id,
    pickupWard: pickupLocation.ward,
    receiver: { name: "Người nhận", phone: "0911111111", address: "1 Lê Lợi", province: "Hà Nội", ward: "Phường Láng" },
    item: { name: "Sách", weightGram: 500, length: 10, width: 10, height: 10 },
    serviceTypeId: serviceType._id,
    serviceName: serviceType.name,
    zone: "INNER_PROVINCE",
    chargeableWeight: 500,
    status,
    statusHistory: [{ status }],
  });
}

test("[US-15] khach vang lai, nhan vien kho khong dung duoc API dia diem lay hang", async () => {
  assert.equal((await request(app).get("/pickupLocations")).status, 401);
  assert.equal((await as(hubStaffToken, request(app).get("/pickupLocations"))).status, 403);
});

test("[US-15] them dia diem: tu xac dinh khu vuc phuc vu tu quan/huyen, dia diem dau tien la mac dinh", async () => {
  const res = await addLocation(tokenA);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const area = await ServiceArea.findOne({ province: "Hà Nội", ward: "Phường Cầu Giấy" }).lean();
  assert.equal(String(res.body.data.serviceAreaId), String(area._id));
  assert.deepEqual([res.body.data.province, res.body.data.ward], ["Hà Nội", "Phường Cầu Giấy"]);
  assert.equal(res.body.data.contactPhone, "0909123456");
  assert.equal(res.body.data.isDefault, true);
  assert.equal(String(res.body.data.customerId), String(customerA._id));

  const missing = await addLocation(tokenA, { ward: "  " });
  assert.equal(missing.status, 400);
  assert.match(missing.body.error.message, /xã\/phường/);
  const badPhone = await addLocation(tokenA, { contactPhone: "12345" });
  assert.equal(badPhone.status, 400);
});

test("[US-15] chan dia diem ngoai vung phuc vu (them moi va doi dia chi)", async () => {
  const outside = await addLocation(tokenA, { province: "Hà Nội", ward: "Xã Sóc Sơn" });
  assert.equal(outside.status, 422);
  assert.equal(outside.body.error.code, "OUT_OF_SERVICE_AREA");
  assert.match(outside.body.error.message, /Xã Sóc Sơn, Hà Nội chưa thuộc vùng phục vụ/);

  const [first] = (await listLocations(tokenA)).body.data;
  const move = await as(tokenA, request(app).put(`/pickupLocations/${first._id}`)).send({ province: "Lào Cai", ward: "Phường Sa Pa" });
  assert.equal(move.status, 422);
});

test("[US-15] toi da 10 dia diem dang dung; xoa bot thi them duoc", async () => {
  for (let i = (await listLocations(tokenA)).body.data.length; i < 10; i++) {
    const res = await addLocation(tokenA, { label: `Kho ${i + 1}` });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
  const list = await listLocations(tokenA);
  assert.deepEqual(list.body.meta, { total: 10, max: 10 });

  const eleventh = await addLocation(tokenA, { label: "Kho 11" });
  assert.equal(eleventh.status, 409);
  assert.equal(eleventh.body.error.code, "PICKUP_LOCATION_LIMIT");

  const last = list.body.data[list.body.data.length - 1];
  assert.equal((await as(tokenA, request(app).delete(`/pickupLocations/${last._id}`))).status, 200);
  assert.equal((await addLocation(tokenA, { label: "Kho 11" })).status, 201);
});

test("[US-15] khach chi thay va sua duoc dia diem cua chinh minh", async () => {
  const [ofA] = (await listLocations(tokenA)).body.data;
  assert.equal((await listLocations(tokenB)).body.data.length, 0);
  assert.equal((await as(tokenB, request(app).get(`/pickupLocations/${ofA._id}`))).status, 404);
  assert.equal((await as(tokenB, request(app).put(`/pickupLocations/${ofA._id}`)).send({ label: "Chiếm" })).status, 404);
  assert.equal((await as(tokenB, request(app).delete(`/pickupLocations/${ofA._id}`))).status, 404);
  // customerId gui len bi bo qua - khong tao ho dia diem cho nguoi khac
  const res = await addLocation(tokenB, { customerId: customerA._id });
  assert.equal(res.status, 201);
  assert.notEqual(String(res.body.data.customerId), String(customerA._id));
});

test("[US-15] luon co dung mot dia diem mac dinh", async () => {
  const before = (await listLocations(tokenA)).body.data;
  const oldDefault = before.find((l) => l.isDefault);
  const other = before.find((l) => !l.isDefault);

  const unset = await as(tokenA, request(app).put(`/pickupLocations/${oldDefault._id}`)).send({ isDefault: false });
  assert.equal(unset.status, 400);

  const set = await as(tokenA, request(app).put(`/pickupLocations/${other._id}`)).send({ isDefault: true });
  assert.equal(set.status, 200);
  const after = (await listLocations(tokenA)).body.data;
  assert.deepEqual(after.filter((l) => l.isDefault).map((l) => l._id), [other._id]);
  assert.equal(after[0]._id, other._id, "dia diem mac dinh dung dau danh sach");

  // Xoa dia diem mac dinh -> dia diem moi nhat thanh mac dinh
  assert.equal((await as(tokenA, request(app).delete(`/pickupLocations/${other._id}`))).status, 200);
  const remaining = (await listLocations(tokenA)).body.data;
  assert.equal(remaining.filter((l) => l.isDefault).length, 1);
});

test("[US-15] con don chua hoan tat: khong xoa, khong doi dia chi; don hoan tat roi thi xoa duoc", async () => {
  const [target] = (await listLocations(tokenA)).body.data;
  const doc = await PickupLocation.findById(target._id).lean();
  const order = await placeOrder(doc, "PICKUP_ASSIGNED", 1);

  const del = await as(tokenA, request(app).delete(`/pickupLocations/${target._id}`));
  assert.equal(del.status, 409);
  assert.match(del.body.error.message, /chưa hoàn tất/);
  const move = await as(tokenA, request(app).put(`/pickupLocations/${target._id}`)).send({ address: "99 Xuân Thủy" });
  assert.equal(move.status, 409);
  const rename = await as(tokenA, request(app).put(`/pickupLocations/${target._id}`)).send({ label: "Kho chính" });
  assert.equal(rename.status, 200);

  await Order.updateOne({ _id: order._id }, { status: "DELIVERED" });
  assert.equal((await as(tokenA, request(app).delete(`/pickupLocations/${target._id}`))).status, 200);
  // Xoa mem: don cu van tro duoc toi dia diem, nhung khong con trong danh sach
  assert.equal((await PickupLocation.findById(target._id).lean()).isActive, false);
  assert.ok(!(await listLocations(tokenA)).body.data.some((l) => l._id === target._id));
});

test("[US-15] khu vuc phuc vu con dia diem lay hang cua khach thi khong xoa duoc", async () => {
  const area = await as(adminToken, request(app).post("/serviceAreas")).send({
    province: TEST_AREA.province,
    ward: TEST_AREA.ward,
    region: "BAC",
    routeId: (await Route.findOne({ code: "R-HN-NOI" }).lean())._id,
  });
  assert.equal(area.status, 201, JSON.stringify(area.body));
  const loc = await addLocation(tokenB, TEST_AREA);
  assert.equal(loc.status, 201, JSON.stringify(loc.body));

  const blocked = await as(adminToken, request(app).delete(`/serviceAreas/${area.body.data._id}`));
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error.message, /địa điểm lấy hàng/);

  assert.equal((await as(tokenB, request(app).delete(`/pickupLocations/${loc.body.data._id}`))).status, 200);
  assert.equal((await as(adminToken, request(app).delete(`/serviceAreas/${area.body.data._id}`))).status, 200);
});

// LUONG nghiep vu cua story: khach moi dang ky -> them dia diem dau tien (tu thanh
// mac dinh) -> them kho thu hai o tinh khac -> chuyen mac dinh sang kho moi -> co
// don dang cho lay o kho cu nen chua xoa duoc -> don giao xong -> xoa kho cu.
test("[US-15] luong nghiep vu: dang ky -> them kho -> doi kho mac dinh -> don xong moi xoa kho cu", async () => {
  const register = await request(app).post("/auth/register").send({
    email: EMAILS[3],
    phone: "0909981509",
    password: PASSWORD,
    fullName: "Shop Mới",
    customerType: "INDIVIDUAL",
  });
  assert.equal(register.status, 201, JSON.stringify(register.body));
  const token = await loginToken(EMAILS[3]);

  const first = await addLocation(token, { label: "Nhà riêng", province: "TP Hồ Chí Minh", ward: "tan my" });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.data.isDefault, true);
  assert.equal(first.body.data.ward, "Phường Tân Mỹ");

  const second = await addLocation(token, { label: "Kho Đà Nẵng", province: "Đà Nẵng", ward: "Phường Hải Châu" });
  assert.equal(second.body.data.isDefault, false);
  await as(token, request(app).put(`/pickupLocations/${second.body.data._id}`)).send({ isDefault: true });

  const list = (await listLocations(token)).body;
  assert.deepEqual(
    list.data.map((l) => [l.label, l.isDefault]),
    [
      ["Kho Đà Nẵng", true],
      ["Nhà riêng", false],
    ],
  );
  assert.deepEqual(list.meta, { total: 2, max: 10 });

  const order = await placeOrder(await PickupLocation.findById(first.body.data._id).lean(), "CONFIRMED", 2);
  assert.equal((await as(token, request(app).delete(`/pickupLocations/${first.body.data._id}`))).status, 409);
  await Order.updateOne({ _id: order._id }, { status: "DELIVERED" });
  assert.equal((await as(token, request(app).delete(`/pickupLocations/${first.body.data._id}`))).status, 200);
  assert.deepEqual((await listLocations(token)).body.data.map((l) => l.label), ["Kho Đà Nẵng"]);
});
