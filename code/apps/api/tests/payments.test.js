// US-44: thanh toan phi van chuyen qua cong VNPay (sandbox) - gui nhanh bat buoc tra truoc.
// VNPay that khong goi duoc may test: test tu ky ket qua bang cung hash secret (giong VNPay ky) roi goi IPN / return.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { URL } from "node:url";

// Cau hinh VNPay rieng cho test - dat TRUOC khi nap app (env.js doc process.env luc import)
process.env.VNPAY_TMN_CODE = "EDMSTEST";
process.env.VNPAY_HASH_SECRET = "edms-test-hash-secret";
const SECRET = process.env.VNPAY_HASH_SECRET;

const { createApp } = await import("../src/app.js");
const { removeLeftovers } = await import("./helpers/fixtures.js");
const { User, ServiceType, PickupLocation, Order, Payment } = await import("../src/models/index.js");
const { getRedis } = await import("../src/config/redis.js");
const { sign, signData, vnpDate, verifySignature, buildPaymentUrl, clientIp } = await import("../src/modules/payments/vnpay.js");
const { assertExpressPrepaid } = await import("../src/modules/orders/cod.js");

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["pay-shop@edms.vn", "pay-kho@edms.vn", "pay-shop2@edms.vn"];
const WEB_RETURN = "http://localhost:5173/don-hang/abc";

let app;
let shopToken;
let otherToken;
let staffToken;
let standard;
let express;
let location;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  app = createApp();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  express = await ServiceType.findOne({ code: "EXPRESS" }).lean();
  const hub = await mongoose.connection.collection("hubs").findOne({ code: "HUB-HCM" });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909983101", passwordHash, fullName: "Chủ Shop VNPay", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop VNPay", taxCode: "0312345679", status: "ACTIVE" },
    { email: EMAILS[1], phone: "0909983102", passwordHash, fullName: "Kho HCM VNPay", role: "HUB_STAFF", hubId: hub._id },
    { email: EMAILS[2], phone: "0909983103", passwordHash, fullName: "Khách khác", role: "CUSTOMER", customerType: "INDIVIDUAL", status: "ACTIVE" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  shopToken = await login(EMAILS[0]);
  staffToken = await login(EMAILS[1]);
  otherToken = await login(EMAILS[2]);
  location = (
    await request(app).post("/pickupLocations").set("Authorization", `Bearer ${shopToken}`).send({
      label: "Shop Quận 3",
      contactName: "Chủ Shop VNPay",
      contactPhone: "0909983101",
      address: "10 Võ Văn Tần",
      province: "TP Hồ Chí Minh",
      ward: "Phường Xuân Hòa",
    })
  ).body.data;
});

after(async () => {
  try {
    const users = await User.find({ email: { $in: EMAILS } }).select("_id").lean();
    const ids = users.map((u) => u._id);
    await Payment.deleteMany({ customerId: { $in: ids } });
    await Order.deleteMany({ customerId: { $in: ids } });
    await PickupLocation.deleteMany({ customerId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const createOrder = ({ serviceTypeId = standard._id, cod }) =>
  request(app)
    .post("/orders")
    .set(auth(shopToken))
    .send({
      pickupLocationId: location._id,
      serviceTypeId,
      receiver: { name: "E2E Người Mua", phone: "0987654321", address: "9 Nguyễn Thị Thập", province: "TP Hồ Chí Minh", ward: "Phường Tân Mỹ" },
      item: { name: "Áo thun", weightGram: 800, length: 20, width: 15, height: 5 },
      cod,
    });
const VNPAY_COD = { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "VNPAY" };
const startPayment = (orderId, body = {}) =>
  request(app).post("/payments/vnpay").set(auth(shopToken)).send({ orderId, returnTo: WEB_RETURN, ...body });

/** Ket qua VNPay gui ve, ky bang hash secret nhu VNPay that. */
function vnpayResult(payment, overrides = {}) {
  const params = {
    vnp_TmnCode: "EDMSTEST",
    vnp_Amount: String(payment.amount * 100),
    vnp_BankCode: "NCB",
    vnp_BankTranNo: "VNP14422574",
    vnp_CardType: "ATM",
    vnp_PayDate: "20261119103000",
    vnp_OrderInfo: `Thanh toan phi van chuyen don ${payment.trackingCode}`,
    vnp_TransactionNo: "14422574",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: payment.txnRef,
    ...overrides,
  };
  return { ...params, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: sign(params, SECRET) };
}

test("[US-44] ky giao dich VNPay (ham thuan): sap xep tham so, ma hoa kieu form, HMAC-SHA512, gio Viet Nam", () => {
  assert.equal(signData({ b: "2", a: "x y", c: "", d: null }), "a=x+y&b=2");
  assert.equal(signData({ vnp_OrderInfo: "Don EXP1/2" }), "vnp_OrderInfo=Don+EXP1%2F2");
  // 19/11/2026 03:05:09 UTC = 10:05:09 gio Viet Nam
  assert.equal(vnpDate(new Date("2026-11-19T03:05:09Z")), "20261119100509");
  assert.equal(clientIp("::1"), "127.0.0.1");
  assert.equal(clientIp("::ffff:10.0.0.7"), "10.0.0.7");

  const url = new URL(
    buildPaymentUrl({
      payUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      tmnCode: "EDMSTEST",
      secret: SECRET,
      amount: 24000,
      txnRef: "EXP1000000001123",
      orderInfo: "Thanh toan phi van chuyen don EXP1000000001",
      returnUrl: "http://localhost:4044/payments/vnpay/return",
      ipAddr: "::1",
      createdAt: new Date("2026-11-19T03:00:00Z"),
      expiresAt: new Date("2026-11-19T03:15:00Z"),
    }),
  );
  const query = Object.fromEntries(url.searchParams);
  assert.equal(query.vnp_Amount, "2400000", "so tien nhan 100");
  assert.equal(query.vnp_ExpireDate, "20261119101500");
  assert.equal(verifySignature(query, SECRET), true, "VNPay kiem lai dung chu ky");
  assert.equal(verifySignature({ ...query, vnp_Amount: "100" }, SECRET), false, "sua so tien thi sai chu ky");
  assert.equal(verifySignature(query, "secret-khac"), false);
});

test("[US-44] gui nhanh bat buoc nguoi gui tra truoc (ham thuan va API)", async () => {
  assert.throws(() => assertExpressPrepaid({ feePayer: "RECIPIENT_PAID" }, { code: "EXPRESS" }), /phải trả trước/);
  assert.doesNotThrow(() => assertExpressPrepaid({ feePayer: "RECIPIENT_PAID" }, { code: "STANDARD" }));
  assert.doesNotThrow(() => assertExpressPrepaid({ feePayer: "SHOP_PREPAID" }, { code: "EXPRESS" }));

  const blocked = await createOrder({ serviceTypeId: express._id, cod: { enabled: true, amount: 200000, feePayer: "DEDUCT_FROM_COD" } });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.error.message, /Gửi nhanh: người gửi phải trả trước/);
  const ok = await createOrder({ serviceTypeId: express._id, cod: VNPAY_COD });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.data.cod.feePaymentMethod, ok.body.data.cod.feePaid], ["VNPAY", false]);
});

test("[US-44] tao giao dich: chi chu don, chi don tra truoc VNPay, returnTo phai la dia chi cua app", async () => {
  const order = (await createOrder({ cod: VNPAY_COD })).body.data;
  const recipientPaid = (await createOrder({ cod: { enabled: false, feePayer: "RECIPIENT_PAID" } })).body.data;

  const other = await request(app).post("/payments/vnpay").set(auth(otherToken)).send({ orderId: order._id });
  assert.equal(other.status, 404, "khach khac khong thanh toan don nguoi ta");
  const wrongMethod = await startPayment(recipientPaid._id);
  assert.equal(wrongMethod.status, 400);
  assert.match(wrongMethod.body.error.message, /không chọn trả trước phí vận chuyển qua VNPay/);
  const evil = await startPayment(order._id, { returnTo: "https://trang-la.example/lay-tien" });
  assert.equal(evil.status, 400, "khong chuyen huong toi trang ngoai app");
  assert.equal((await startPayment(order._id, { returnTo: "edmskh://thanh-toan", client: "MOBILE" })).status, 201, "deep link app khach");

  const started = await startPayment(order._id);
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const payment = started.body.data;
  assert.equal(payment.status, "PENDING");
  assert.equal(payment.amount, order.fee.total);
  const url = new URL(payment.paymentUrl);
  assert.equal(url.host, "sandbox.vnpayment.vn");
  assert.equal(url.searchParams.get("vnp_TxnRef"), payment.txnRef);
  assert.equal(url.searchParams.get("vnp_Amount"), String(order.fee.total * 100));
  assert.equal(url.searchParams.get("vnp_ReturnUrl"), "http://localhost:4044/payments/vnpay/return");
  assert.equal(verifySignature(Object.fromEntries(url.searchParams), SECRET), true);
});

test("[US-44] IPN: sai chu ky, sai so tien, khong co giao dich bi tu choi; ket qua chi ghi mot lan", async () => {
  const order = (await createOrder({ cod: VNPAY_COD })).body.data;
  const payment = (await startPayment(order._id)).body.data;
  const ipn = (query) => request(app).get("/payments/vnpay/ipn").query(query);

  const forged = { ...vnpayResult(payment), vnp_ResponseCode: "00", vnp_Amount: "100" };
  assert.deepEqual((await ipn(forged)).body, { RspCode: "97", Message: "Invalid signature" });
  assert.equal((await ipn(vnpayResult(payment, { vnp_Amount: "100" }))).body.RspCode, "04");
  assert.equal((await ipn(vnpayResult({ ...payment, txnRef: "KHONGCO1" }))).body.RspCode, "01");
  assert.equal((await Order.findById(order._id).lean()).cod.feePaid, false, "chua ghi gi");

  // VNPay goi IPN va trinh duyet ve trang return gan nhu cung luc: chi mot ben ghi
  const [a, b] = await Promise.all([ipn(vnpayResult(payment)), ipn(vnpayResult(payment))]);
  assert.deepEqual([a.body.RspCode, b.body.RspCode].sort(), ["00", "02"]);
  assert.equal((await ipn(vnpayResult(payment))).body.RspCode, "02", "VNPay goi lai -> da xac nhan");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.cod.feePaid, true);
  assert.equal(saved.cod.txnRef, payment.txnRef);
  assert.ok(saved.cod.feePaidAt);
});

test("[US-44] thanh toan that bai / khach huy: giao dich FAILED, don van chua tra, thanh toan lai duoc", async () => {
  const order = (await createOrder({ cod: VNPAY_COD })).body.data;
  const first = (await startPayment(order._id)).body.data;
  const back = await request(app).get("/payments/vnpay/return").query(vnpayResult(first, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }));
  assert.equal(back.status, 302);
  assert.match(back.headers.location, /^http:\/\/localhost:5173\/don-hang\/abc\?thanhToan=FAILED&maGiaoDich=/);
  assert.equal((await Order.findById(order._id).lean()).cod.feePaid, false);

  const retry = await startPayment(order._id);
  assert.equal(retry.status, 201, "thu lai bang giao dich moi");
  assert.notEqual(retry.body.data.txnRef, first.txnRef);
  const history = await request(app).get("/payments").query({ orderId: order._id }).set(auth(shopToken));
  assert.deepEqual(history.body.data.map((p) => p.status), ["PENDING", "FAILED"]);
  assert.equal(history.body.data[1].statusLabel, "Thanh toán không thành công");
});

// LUONG nghiep vu: shop tao don gui nhanh tra truoc VNPay -> kho chua duyet duoc vi chua tra tien -> shop thanh toan
// tren VNPay -> VNPay chuyen ve app (trang return) -> don da tra phi -> kho duyet, phi khoa.
test("[US-44] luong nghiep vu: gui nhanh tra truoc VNPay -> chua tra thi kho chua duyet -> thanh toan -> kho duyet", async () => {
  const order = (await createOrder({ serviceTypeId: express._id, cod: VNPAY_COD })).body.data;
  const early = await request(app).post(`/orders/${order._id}/confirm`).set(auth(staffToken));
  assert.equal(early.status, 409);
  assert.equal(early.body.error.code, "PAYMENT_REQUIRED");

  const payment = (await startPayment(order._id)).body.data;
  const back = await request(app).get("/payments/vnpay/return").query(vnpayResult(payment));
  assert.equal(back.status, 302);
  assert.equal(back.headers.location, `${WEB_RETURN}?thanhToan=SUCCESS&maGiaoDich=${payment.txnRef}&ma=00`);
  // IPN den sau trang return: da xac nhan, khong ghi lai
  assert.equal((await request(app).get("/payments/vnpay/ipn").query(vnpayResult(payment))).body.RspCode, "02");

  const paid = (await request(app).get(`/orders/${order._id}`).set(auth(shopToken))).body.data;
  assert.equal(paid.cod.feePaid, true);
  assert.equal((await startPayment(order._id)).status, 409, "da tra thi khong thanh toan lai");
  const confirmed = await request(app).post(`/orders/${order._id}/confirm`).set(auth(staffToken));
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.ok(confirmed.body.data.fee.lockedAt);
  const history = await request(app).get("/payments").query({ orderId: order._id }).set(auth(staffToken));
  assert.equal(history.body.data[0].status, "SUCCESS", "kho xem duoc lich su thanh toan cua don");
});
