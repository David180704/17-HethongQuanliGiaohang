// US-18: tao don trong transaction (counter + orders + orderDrafts), ma van don EXP + 10
// chu so, chi nhan don khi ca noi gui va noi nhan thuoc vung phuc vu, nhan vien hub xac
// nhan don. US-17: phi khoa tu luc CONFIRMED, bang gia doi ve sau khong lam doi phi don cu.
import { test, before, after } from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PriceTable, PickupLocation, Order, OrderDraft } from "../src/models/index.js";
import { Counter } from "../src/models/Counter.js";
import { formatTrackingCode } from "../src/modules/orders/CounterRepository.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["ord-khach-a@edms.vn", "ord-khach-b@edms.vn", "ord-kho-hn@edms.vn", "ord-kho-hcm@edms.vn", "ord-admin@edms.vn"];
const BLOCKER_CODE_MARK = "ORD-BLOCKER";

let app;
let customerA;
let token = {};
let hubs;
let standard;
let express;
let caugiay; // dia diem lay hang cua khach A o Ha Noi / Cau Giay (tuyen R-HN-NOI -> HUB-HN)
let danang; // dia diem lay hang cua khach A o Da Nang (tuyen R-DN-NOI -> PO-DN, truc thuoc HUB-HN)
const createdTables = [];
let shortenedTable = null;

async function cleanup() {
  const users = await User.find({ email: { $in: EMAILS } }).select("_id").lean();
  const ids = users.map((u) => u._id);
  await Order.deleteMany({ $or: [{ customerId: { $in: ids } }, { customerName: BLOCKER_CODE_MARK }] });
  await OrderDraft.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM", "PO-DN"] } }).lean()).map((h) => [h.code, h]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  express = await ServiceType.findOne({ code: "EXPRESS" }).lean();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const customer = (email, phone, fullName) => ({ email, phone, passwordHash, fullName, role: "CUSTOMER", customerType: "INDIVIDUAL" });
  [customerA] = await User.create([
    customer(EMAILS[0], "0909981801", "Khách Đơn A"),
    customer(EMAILS[1], "0909981802", "Khách Đơn B"),
    { email: EMAILS[2], phone: "0909981803", passwordHash, fullName: "Kho HN", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[3], phone: "0909981804", passwordHash, fullName: "Kho HCM", role: "HUB_STAFF", hubId: hubs["HUB-HCM"]._id },
    { email: EMAILS[4], phone: "0909981805", passwordHash, fullName: "Admin Đơn", role: "ADMIN" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { a: await login(EMAILS[0]), b: await login(EMAILS[1]), hn: await login(EMAILS[2]), hcm: await login(EMAILS[3]), admin: await login(EMAILS[4]) };

  const addLocation = async (body) =>
    (await request(app).post("/pickupLocations").set("Authorization", `Bearer ${token.a}`).send(body)).body.data;
  const contact = { contactName: "Khách Đơn A", contactPhone: "0909981801" };
  caugiay = await addLocation({ label: "Kho Cầu Giấy", ...contact, address: "1 Xuân Thủy", province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu" });
  danang = await addLocation({ label: "Kho Đà Nẵng", ...contact, address: "2 Bạch Đằng", province: "Đà Nẵng", district: "Hải Châu", ward: "Thạch Thang" });
});

after(async () => {
  try {
    await PriceTable.deleteMany({ _id: { $in: createdTables } });
    if (shortenedTable) await PriceTable.updateOne({ _id: shortenedTable }, { effectiveTo: null });
    await cleanup();
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const orderBody = (overrides = {}) => ({
  pickupLocationId: caugiay._id,
  serviceTypeId: standard._id,
  receiver: { name: "Trần Nhận", phone: "0912 345 678", address: "5 Lý Tự Trọng", province: "tp ho chi minh", district: "quan 1", ward: "Bến Nghé" },
  item: { name: "Sách", weightGram: 1200, length: 20, width: 15, height: 10, declaredValue: 300000 },
  flags: {},
  ...overrides,
});
const createOrder = (overrides, who = "a") => as(who, request(app).post("/orders")).send(orderBody(overrides));
const counterSeq = async () => (await Counter.findById("trackingCode").lean()).seq;

test("[US-18] tao don: ma van don EXP + 10 chu so lay tu counter, don CREATED, phi khop uoc tinh", async () => {
  const before = await counterSeq();
  const res = await createOrder();
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data;
  assert.match(order.trackingCode, /^EXP\d{10}$/);
  assert.equal(order.trackingCode, formatTrackingCode(before + 1));
  assert.equal(await counterSeq(), before + 1);
  assert.equal(order.status, "CREATED");
  assert.deepEqual(order.statusHistory.map((h) => h.status), ["CREATED"]);
  assert.equal(order.customerName, "Khách Đơn A");
  assert.equal(String(order.pickupHubId), String(hubs["HUB-HN"]._id), "tuyen R-HN-NOI do Hub Ha Noi quan ly");
  assert.deepEqual([order.receiver.province, order.receiver.district, order.receiver.phone], ["TP Hồ Chí Minh", "Quận 1", "0912345678"]);
  assert.equal(order.fee.lockedAt, null, "chua xac nhan thi chua khoa phi");

  const quote = await request(app)
    .post("/orders/estimate-fee")
    .send({ pickup: caugiay, receiver: orderBody().receiver, item: orderBody().item, serviceTypeId: standard._id });
  const { fee } = quote.body.data.options[0];
  assert.deepEqual({ ...order.fee, lockedAt: undefined }, { ...fee, lockedAt: undefined });
  assert.equal(order.zone, "INTER_REGION");
  assert.ok(order.priceTableId, "luu bang gia da dung de tinh phi");
});

test("[US-18] chi nhan don khi ca noi gui va noi nhan thuoc vung phuc vu", async () => {
  const receiverOutside = await createOrder({ receiver: { ...orderBody().receiver, province: "Lào Cai", district: "Sa Pa" } });
  assert.equal(receiverOutside.status, 422);
  assert.equal(receiverOutside.body.error.code, "OUT_OF_SERVICE_AREA");
  assert.match(receiverOutside.body.error.message, /Nơi nhận/);

  // Dia diem lay hang ma khu vuc phuc vu da bi go (du lieu cu) -> chan o noi gui
  await PickupLocation.updateOne({ _id: danang._id }, { serviceAreaId: new mongoose.Types.ObjectId() });
  const pickupOutside = await createOrder({ pickupLocationId: danang._id });
  assert.equal(pickupOutside.status, 422);
  assert.match(pickupOutside.body.error.message, /Nơi gửi "Kho Đà Nẵng"/);
  const area = await mongoose.connection.collection("serviceareas").findOne({ province: "Đà Nẵng", district: "Hải Châu" });
  await PickupLocation.updateOne({ _id: danang._id }, { serviceAreaId: area._id });

  // Dia diem lay hang cua khach khac
  assert.equal((await createOrder({}, "b")).status, 404);
  const missing = await createOrder({ item: { ...orderBody().item, name: "" } });
  assert.equal(missing.status, 400);
});

test("[US-18] 10 don tao cung luc: 10 ma van don khac nhau, lien tiep, khong trung", async () => {
  const before = await counterSeq();
  const results = await Promise.all(Array.from({ length: 10 }, () => createOrder()));
  assert.deepEqual(results.map((r) => r.status), Array(10).fill(201));
  const numbers = results.map((r) => Number(r.body.data.trackingCode.slice(3))).sort((x, y) => x - y);
  assert.deepEqual(numbers, Array.from({ length: 10 }, (_, i) => before + 1 + i));
});

test("[US-18] transaction: loi giua chung thi counter, don va ban nhap cung khong doi", async () => {
  const draft = await as("a", request(app).post("/orderDrafts")).send({ payload: { step: 4 } });
  const { draftToken } = draft.body.data;
  const seq = await counterSeq();
  // Chen san mot don chiem dung ma tiep theo -> lenh them don trong transaction loi trung khoa
  const blocker = await Order.create({
    ...orderBody(),
    trackingCode: formatTrackingCode(seq + 1),
    customerId: customerA._id,
    customerName: BLOCKER_CODE_MARK,
    pickupWard: "x",
    receiver: { ...orderBody().receiver, province: "TP Hồ Chí Minh", district: "Quận 1" },
    serviceName: "x",
    zone: "INTER_REGION",
    chargeableWeight: 1,
  });

  const failed = await createOrder({ draftToken, receiver: { ...orderBody().receiver, name: "Không được tạo" } });
  assert.equal(failed.status, 409, JSON.stringify(failed.body));
  assert.equal(await counterSeq(), seq, "counter da tang phai bi hoan lai");
  assert.ok(await OrderDraft.exists({ draftToken }), "ban nhap chua bi xoa");
  assert.equal(await Order.countDocuments({ "receiver.name": "Không được tạo" }), 0);

  await Order.deleteOne({ _id: blocker._id });
  const ok = await createOrder({ draftToken, receiver: { ...orderBody().receiver, name: "Tạo lại được" } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.trackingCode, formatTrackingCode(seq + 1));
  assert.equal(await OrderDraft.exists({ draftToken }), null, "tao don thanh cong thi xoa nhap cung transaction");
});

test("[US-18] pham vi xem don: khach chi thay don minh; hub thay don cua hub va buu cuc truc thuoc", async () => {
  const fromDanang = (await createOrder({ pickupLocationId: danang._id })).body.data;
  assert.equal(String(fromDanang.pickupHubId), String(hubs["PO-DN"]._id));

  const mine = await as("a", request(app).get("/orders")).query({ limit: 100 });
  assert.ok(mine.body.data.every((o) => String(o.customerId) === String(customerA._id)));
  assert.ok(mine.body.data.some((o) => o._id === fromDanang._id));
  assert.equal((await as("b", request(app).get(`/orders/${fromDanang._id}`))).status, 404);

  // Hub Ha Noi thay ca don cua Buu cuc Da Nang (truc thuoc); Hub HCM khong thay
  const hnQueue = await as("hn", request(app).get("/orders")).query({ status: "CREATED", search: fromDanang.trackingCode });
  assert.deepEqual(hnQueue.body.data.map((o) => o.trackingCode), [fromDanang.trackingCode]);
  const hcmQueue = await as("hcm", request(app).get("/orders")).query({ status: "CREATED", search: fromDanang.trackingCode });
  assert.equal(hcmQueue.body.data.length, 0);
  assert.equal((await as("hcm", request(app).get(`/orders/${fromDanang._id}`))).status, 404);
  assert.equal((await as("admin", request(app).get(`/orders/${fromDanang._id}`))).status, 200);
  assert.equal((await request(app).get("/orders")).status, 401);
});

test("[US-18] xac nhan don: dung nhan vien hub phu trach, CREATED -> CONFIRMED dung mot lan", async () => {
  const order = (await createOrder()).body.data;
  assert.equal((await as("a", request(app).post(`/orders/${order._id}/confirm`))).status, 403, "khach khong tu duyet don");
  assert.equal((await as("hcm", request(app).post(`/orders/${order._id}/confirm`))).status, 404, "hub khac khong thay don");

  const confirmed = await as("hn", request(app).post(`/orders/${order._id}/confirm`));
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.status, "CONFIRMED");
  assert.ok(confirmed.body.data.fee.lockedAt);
  const last = confirmed.body.data.statusHistory.at(-1);
  assert.equal(last.status, "CONFIRMED");
  assert.equal(String(last.by), String((await User.findOne({ email: EMAILS[2] }).lean())._id));
  assert.equal((await as("hn", request(app).post(`/orders/${order._id}/confirm`))).status, 409);

  // Hai nhan vien cung bam xac nhan mot luc: dung mot nguoi thanh cong
  const another = (await createOrder()).body.data;
  const [first, second] = await Promise.all([
    as("hn", request(app).post(`/orders/${another._id}/confirm`)),
    as("admin", request(app).post(`/orders/${another._id}/confirm`)),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
});

// US-17 tieu chi 2: dung EXPRESS x noi quan (khong test nao khac doi bang gia nay luc chay song song)
test("[US-17] khoa phi khi CONFIRMED: bang gia doi ve sau khong lam doi phi don da xac nhan", async () => {
  const sameDistrict = { ...orderBody().receiver, province: "Hà Nội", district: "Cầu Giấy" };
  const order = (await createOrder({ serviceTypeId: express._id, receiver: sameDistrict })).body.data;
  assert.equal(order.zone, "INNER_DISTRICT");
  const locked = (await as("hn", request(app).post(`/orders/${order._id}/confirm`))).body.data;

  // Admin doi gia: bang cu het hieu luc tu bay gio, bang moi gia gap doi bat dau ngay sau
  const current = await PriceTable.findOne({ serviceTypeId: express._id, zone: "INNER_DISTRICT", effectiveTo: null }).lean();
  const switchAt = new Date(Date.now() + 1000);
  const shorten = await as("admin", request(app).put(`/priceTables/${current._id}`)).send({ effectiveTo: switchAt });
  assert.equal(shorten.status, 200, JSON.stringify(shorten.body));
  shortenedTable = current._id;
  const doubled = current.weightTiers.map(({ fromGram, toGram, basePrice, pricePer500g }) => ({
    fromGram,
    toGram,
    basePrice: basePrice * 2,
    pricePer500g,
  }));
  const raised = await as("admin", request(app).post("/priceTables")).send({
    serviceTypeId: express._id,
    zone: "INNER_DISTRICT",
    weightTiers: doubled,
    effectiveFrom: switchAt,
  });
  assert.equal(raised.status, 201, JSON.stringify(raised.body));
  createdTables.push(raised.body.data._id);
  await wait(1100); // qua moc doi gia

  const after = (await as("a", request(app).get(`/orders/${order._id}`))).body.data;
  assert.deepEqual(after.fee, locked.fee, "don da xac nhan giu nguyen phi");
  assert.equal(String(after.priceTableId), String(current._id));

  const newOrder = (await createOrder({ serviceTypeId: express._id, receiver: sameDistrict })).body.data;
  assert.equal(newOrder.fee.base, order.fee.base * 2, "don moi tinh theo bang gia moi");
  assert.equal(String(newOrder.priceTableId), String(raised.body.data._id));
});

// LUONG nghiep vu cua story: khach co dia diem lay hang -> uoc tinh phi -> tao don tu ban
// nhap -> nhan ma van don -> buu cuc phu trach thay don trong hang cho duyet -> xac nhan
// -> khach xem lai don: CONFIRMED, phi khong doi, ban nhap da duoc dung het.
test("[US-18] luong nghiep vu: uoc tinh -> luu nhap -> tao don -> buu cuc duyet -> khach thay don da xac nhan", async () => {
  const body = orderBody({ pickupLocationId: danang._id, serviceTypeId: standard._id });
  const quote = await request(app)
    .post("/orders/estimate-fee")
    .send({ pickup: danang, receiver: body.receiver, item: body.item, serviceTypeId: standard._id });
  const quotedTotal = quote.body.data.options[0].fee.total;
  const { draftToken } = (await as("a", request(app).post("/orderDrafts")).send({ payload: { ...body, quotedTotal } })).body.data;

  const created = await as("a", request(app).post("/orders")).send({ ...body, draftToken });
  assert.equal(created.status, 201);
  const { _id, trackingCode, fee } = created.body.data;
  assert.equal(fee.total, quotedTotal, "phi khi tao don dung bang phi da xem truoc");
  assert.equal(await OrderDraft.exists({ draftToken }), null);

  const queue = await as("hn", request(app).get("/orders")).query({ status: "CREATED", search: trackingCode });
  assert.equal(queue.body.data.length, 1, "Hub Ha Noi thay don cua buu cuc Da Nang truc thuoc");
  assert.equal((await as("hn", request(app).post(`/orders/${_id}/confirm`))).status, 200);

  const seen = (await as("a", request(app).get(`/orders/${_id}`))).body.data;
  assert.equal(seen.status, "CONFIRMED");
  assert.equal(seen.fee.total, quotedTotal);
  assert.deepEqual(seen.statusHistory.map((h) => h.status), ["CREATED", "CONFIRMED"]);
  const stillQueued = await as("hn", request(app).get("/orders")).query({ status: "CREATED", search: trackingCode });
  assert.equal(stillQueued.body.data.length, 0, "da duyet thi roi khoi hang cho");
});
