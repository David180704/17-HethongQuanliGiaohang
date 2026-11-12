// US-34 doi soat dinh ky va US-43 shop xem doi soat, khoan dieu chinh, ghi nhan chi tra (de 02).
// Don cua shop rieng file nay; lan chay luon truyen customerId de khong dung toi don seed.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, ServiceType, PickupLocation, Order, Incident, Settlement } from "../src/models/index.js";
import { orderLine, totals } from "../src/modules/settlements/settlementMath.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["ds-shop-a@edms.vn", "ds-shop-b@edms.vn", "ds-admin@edms.vn", "ds-kho@edms.vn"];
// Ky thu nghiem trong qua khu, tach khoi don seed (45 ngay gan day)
const IN_PERIOD = new Date("2026-03-10T10:00:00+07:00");
const OUT_OF_PERIOD = new Date("2026-04-05T10:00:00+07:00");
const PERIOD = { from: "2026-03-01", to: "2026-03-31" };

let app;
let token = {};
let shop = {};
let standard;
let locations = {};

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  await Settlement.deleteMany({ customerId: { $in: ids } });
  await Incident.deleteMany({ customerId: { $in: ids } });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);

/** Don cua shop da ket thuc (DELIVERED / RETURNED) tai thoi diem `at`, kem trang thai thu ho / phi. */
async function finished(who, name, { status = "DELIVERED", at = IN_PERIOD, cod = { enabled: false }, collected = true, feePaid = false } = {}) {
  const created = await as(who, request(app).post("/orders")).send({
    pickupLocationId: locations[who]._id,
    serviceTypeId: standard._id,
    receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
    item: { name: "Áo", weightGram: 500, length: 20, width: 15, height: 5 },
    cod,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const set = { status, "cod.feePaid": feePaid };
  if (status === "DELIVERED" && cod.enabled && collected) Object.assign(set, { "cod.collected": true, "cod.collectedAt": at, "cod.method": "CASH" });
  return Order.findByIdAndUpdate(created.body.data._id, { $set: set, $push: { statusHistory: { status, at } } }, { new: true }).lean();
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const hub = await mongoose.connection.collection("hubs").findOne({ code: "HUB-HN" });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [a, b] = await User.create([
    {
      email: EMAILS[0], phone: "0909983401", passwordHash, fullName: "Chủ Shop A", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Đối Soát A",
      bankAccount: { bankName: "Vietcombank", bankCode: "VCB", accountNumber: "0011004455667", accountName: "CHU SHOP A" },
    },
    { email: EMAILS[1], phone: "0909983402", passwordHash, fullName: "Shop B", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[2], phone: "0909983403", passwordHash, fullName: "Kế toán", role: "ADMIN" },
    { email: EMAILS[3], phone: "0909983404", passwordHash, fullName: "Kho Đối soát", role: "HUB_STAFF", hubId: hub._id },
  ]);
  shop = { a, b };
  const login = async (email) => (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { a: await login(EMAILS[0]), b: await login(EMAILS[1]), admin: await login(EMAILS[2]), kho: await login(EMAILS[3]) };
  for (const who of ["a", "b"]) {
    locations[who] = (
      await as(who, request(app).post("/pickupLocations")).send({
        label: "Kho", contactName: "Shop", contactPhone: "0909983401", address: "1 Hàng Bài", province: "Hà Nội", ward: "Phường Hoàn Kiếm",
      })
    ).body.data;
  }
});

beforeEach(async () => {
  const ids = [shop.a._id, shop.b._id];
  await Settlement.deleteMany({ customerId: { $in: ids } });
  await Incident.deleteMany({ customerId: { $in: ids } });
  await Order.deleteMany({ customerId: { $in: ids } });
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

test("[US-34] cong thuc: thu ho da thu, phi khau tru theo nguoi tra phi, hang hoan shop chiu phi; netPayable = thu ho - phi + dieu chinh", () => {
  const base = { _id: "x", trackingCode: "EXP1", fee: { total: 30000 }, statusHistory: [{ status: "DELIVERED", at: IN_PERIOD }] };
  const line = (status, cod) => orderLine({ ...base, status, cod });
  assert.deepEqual(
    [line("DELIVERED", { enabled: true, collected: true, amount: 300000, feePayer: "RECIPIENT_PAID" })].map((l) => [l.codCollected, l.feeDeducted]),
    [[300000, 0]],
    "nguoi nhan da tra phi cung tien hang",
  );
  assert.equal(line("DELIVERED", { enabled: true, collected: true, amount: 200000, feePayer: "DEDUCT_FROM_COD" }).feeDeducted, 30000);
  assert.equal(line("DELIVERED", { enabled: false, feePayer: "SHOP_PREPAID", feePaid: false }).feeDeducted, 30000, "shop chua tra phi -> tru");
  assert.equal(line("DELIVERED", { enabled: false, feePayer: "SHOP_PREPAID", feePaid: true }).feeDeducted, 0, "shop da tra truoc");
  assert.deepEqual(
    [line("RETURNED", { enabled: true, collected: false, amount: 500000, feePayer: "RECIPIENT_PAID" })].map((l) => [l.codCollected, l.feeDeducted]),
    [[0, 30000]],
    "hang hoan: khong thu ho, shop chiu phi",
  );
  const lines = [
    { codCollected: 300000, feeDeducted: 0 },
    { codCollected: 200000, feeDeducted: 30000 },
    { codCollected: 0, feeDeducted: 30000 },
  ];
  assert.deepEqual(totals(lines, [{ amount: 50000 }, { amount: -20000 }]), { orders: 3, cod: 500000, feeDeducted: 60000, adjustments: 30000, netPayable: 470000 });
});

test("[US-34] tao ky doi soat trong transaction, moi don chi thuoc dung mot ky, netPayable dung cong thuc; boi thuong su co vao dieu chinh", async () => {
  const recipientPaid = await finished("a", "E2E DS Một", { cod: { enabled: true, amount: 300000, feePayer: "RECIPIENT_PAID" } });
  const deducted = await finished("a", "E2E DS Hai", { cod: { enabled: true, amount: 200000, feePayer: "DEDUCT_FROM_COD" } });
  const returned = await finished("a", "E2E DS Hoàn", { status: "RETURNED", cod: { enabled: true, amount: 150000, feePayer: "RECIPIENT_PAID" } });
  await finished("a", "E2E DS Ngoài kỳ", { at: OUT_OF_PERIOD, cod: { enabled: true, amount: 999000, feePayer: "RECIPIENT_PAID" } });
  await Incident.create({
    code: "SC990001", orderId: returned._id, trackingCode: returned.trackingCode, customerId: shop.a._id, type: "DAMAGED", source: "SHOP",
    description: "Hàng hoàn bị móp", status: "RESOLVED", reportedBy: shop.a._id, resolution: { result: "Bồi thường vỏ hộp", compensation: 50000, at: IN_PERIOD },
  });

  assert.equal((await as("kho", request(app).post("/settlements")).send(PERIOD)).status, 403);
  assert.equal((await as("admin", request(app).post("/settlements")).send({ from: "2026-03-31", to: "2026-03-01" })).status, 400);
  const preview = await as("admin", request(app).post("/settlements/preview")).send({ ...PERIOD, customerId: shop.a._id });
  assert.equal(preview.body.data[0].totals.orders, 3);

  const run = await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.a._id });
  assert.equal(run.status, 201, JSON.stringify(run.body));
  assert.equal(run.body.data.length, 1);
  const settlement = await Settlement.findById(run.body.data[0]._id).lean();
  assert.match(settlement.code, /^DS\d{6}$/);
  assert.equal(settlement.customerName, "Shop Đối Soát A");
  const fee = (o) => o.fee.total;
  assert.deepEqual(settlement.totals, {
    orders: 3,
    cod: 500000,
    feeDeducted: fee(deducted) + fee(returned),
    adjustments: 50000,
    netPayable: 500000 - fee(deducted) - fee(returned) + 50000,
  });
  assert.deepEqual(settlement.lines.map((l) => l.trackingCode).sort(), [recipientPaid, deducted, returned].map((o) => o.trackingCode).sort());
  assert.equal(settlement.adjustments[0].kind, "COMPENSATION");
  assert.equal(await Order.countDocuments({ settlementId: settlement._id }), 3);
  assert.equal((await Incident.findOne({ code: "SC990001" }).lean()).settlementId.toString(), settlement._id.toString());

  // Chay lai cung ky: khong con don nao -> don khong vao ky thu hai
  const again = await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.a._id });
  assert.equal(again.status, 400);
});

test("[US-34] hai lan doi soat chay cung luc: chi mot ky duoc lap, khong don nao thuoc hai ky", async () => {
  for (let i = 0; i < 4; i += 1) await finished("a", `E2E DS Đồng thời ${i}`, { cod: { enabled: true, amount: 100000, feePayer: "RECIPIENT_PAID" } });
  const service = getContainer().settlementService;
  const admin = { id: (await User.findOne({ email: EMAILS[2] }).lean())._id, role: "ADMIN" };
  const results = await Promise.allSettled([1, 2, 3].map(() => service.run(admin, { ...PERIOD, customerId: shop.a._id })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.reason?.message)));
  const settlements = await Settlement.find({ customerId: shop.a._id }).lean();
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].totals.orders, 4);
  assert.equal(await Order.countDocuments({ customerId: shop.a._id, settlementId: settlements[0]._id }), 4);
});

test("[US-43] shop xem ky doi soat cua minh, chi tiet tung don va khoan dieu chinh (PB#21, #75, #76); shop khac khong xem duoc", async () => {
  await finished("a", "E2E DS Xem", { cod: { enabled: true, amount: 250000, feePayer: "RECIPIENT_PAID" } });
  await finished("b", "E2E DS Shop B", { cod: { enabled: true, amount: 120000, feePayer: "RECIPIENT_PAID" } });
  const [settlement] = (await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.a._id })).body.data;
  await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.b._id });

  const mine = await as("a", request(app).get("/settlements"));
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.data.map((s) => s.code), [settlement.code]);
  assert.equal(mine.body.data[0].orderCount, 1);
  const detail = await as("a", request(app).get(`/settlements/${settlement._id}`));
  assert.equal(detail.body.data.lines[0].codCollected, 250000);
  assert.equal(detail.body.data.totals.netPayable, 250000);
  assert.equal((await as("b", request(app).get(`/settlements/${settlement._id}`))).status, 404);
  assert.equal((await as("kho", request(app).get("/settlements"))).status, 403);

  // Khoan dieu chinh (PB#76): quan tri vien them khi ky con cho chi tra; shop thay ngay
  assert.equal((await as("a", request(app).post(`/settlements/${settlement._id}/adjustments`)).send({ amount: 10000, reason: "Tự cộng" })).status, 403);
  assert.equal((await as("admin", request(app).post(`/settlements/${settlement._id}/adjustments`)).send({ amount: 0, reason: "Không đổi" })).status, 400);
  const adjusted = await as("admin", request(app).post(`/settlements/${settlement._id}/adjustments`)).send({ amount: -20000, reason: "Phí lưu kho quá hạn 2 ngày" });
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
  assert.deepEqual([adjusted.body.data.totals.adjustments, adjusted.body.data.totals.netPayable], [-20000, 230000]);
  const seen = await as("a", request(app).get(`/settlements/${settlement._id}`));
  assert.equal(seen.body.data.adjustments.at(-1).reason, "Phí lưu kho quá hạn 2 ngày");
});

test("[US-43] ghi nhan da chi tra vao tai khoan ngan hang da khai bao, ky doi soat chuyen hoan tat; shop chua khai bao tai khoan thi chua chi duoc", async () => {
  await finished("a", "E2E DS Chi A", { cod: { enabled: true, amount: 400000, feePayer: "RECIPIENT_PAID" } });
  await finished("b", "E2E DS Chi B", { cod: { enabled: true, amount: 100000, feePayer: "RECIPIENT_PAID" } });
  const [a] = (await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.a._id })).body.data;
  const [b] = (await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.b._id })).body.data;

  const noBank = await as("admin", request(app).post(`/settlements/${b._id}/pay`)).send({ txnRef: "FT26033100001" });
  assert.equal(noBank.status, 409);
  assert.match(noBank.body.error.message, /chưa khai báo tài khoản ngân hàng/);
  assert.equal((await as("admin", request(app).post(`/settlements/${a._id}/pay`)).send({ txnRef: "" })).status, 400);

  const paid = await as("admin", request(app).post(`/settlements/${a._id}/pay`)).send({ txnRef: "FT26033100002" });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.data.status, "PAID");
  assert.deepEqual(
    [paid.body.data.payment.amount, paid.body.data.payment.bankName, paid.body.data.payment.accountNumber, paid.body.data.payment.txnRef],
    [400000, "Vietcombank", "0011004455667", "FT26033100002"],
  );
  assert.equal((await as("admin", request(app).post(`/settlements/${a._id}/pay`)).send({ txnRef: "FT26033100003" })).status, 409);
  assert.equal((await as("admin", request(app).post(`/settlements/${a._id}/adjustments`)).send({ amount: 5000, reason: "Điều chỉnh sau chi" })).status, 409);
  const shopView = await as("a", request(app).get("/settlements")).query({ status: "PAID" });
  assert.equal(shopView.body.data[0].payment.txnRef, "FT26033100002");
});

test("[US-34][US-43] luong nghiep vu: don giao xong trong ky -> ke toan lap ky -> dieu chinh -> chi tra -> shop thay so tien thuc nhan va giao dich", async () => {
  const one = await finished("a", "E2E DS Luồng 1", { cod: { enabled: true, amount: 500000, feePayer: "DEDUCT_FROM_COD" } });
  const two = await finished("a", "E2E DS Luồng 2", { cod: { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR" }, feePaid: true });
  const [settlement] = (await as("admin", request(app).post("/settlements")).send({ ...PERIOD, customerId: shop.a._id })).body.data;
  assert.equal(settlement.totals.netPayable, 500000 - one.fee.total, "don shop da tra truoc phi khong bi tru");
  await as("admin", request(app).post(`/settlements/${settlement._id}/adjustments`)).send({ amount: 15000, reason: "Hoàn phí giao chậm" });
  const paid = await as("admin", request(app).post(`/settlements/${settlement._id}/pay`)).send({ txnRef: "FT26033100009" });
  const net = 500000 - one.fee.total + 15000;
  assert.equal(paid.body.data.payment.amount, net);
  const mine = (await as("a", request(app).get(`/settlements/${settlement._id}`))).body.data;
  assert.deepEqual([mine.status, mine.totals.netPayable, mine.payment.txnRef], ["PAID", net, "FT26033100009"]);
  assert.deepEqual(mine.lines.map((l) => l.trackingCode).sort(), [one.trackingCode, two.trackingCode].sort());
  assert.equal((await Order.findById(one._id).lean()).settlementId.toString(), settlement._id.toString());
});
