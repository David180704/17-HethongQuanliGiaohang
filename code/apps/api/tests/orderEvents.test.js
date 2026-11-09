// US-21: hang doi su kien BullMQ. Doi trang thai don -> phat order.status.changed; consumer dung lai hanh
// trinh cong khai tu du lieu goc va ghi Redis (idempotent); loi thi thu lai, het luot vao dead-letter queue.
// Moi test chay worker tren hang doi rieng (ten co pid) de khong lan voi worker cua API dev dang chay.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { QueueEvents } from "bullmq";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { env } from "../src/config/env.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { BullEventQueue, workerConnectionFromUrl } from "../src/infrastructure/queue/BullEventQueue.js";
import { buildPublicJourney, maskPhone } from "../src/modules/orders/journey.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["evt-khach@edms.vn", "evt-kho-hn@edms.vn"];
const queues = [];
const workers = [];

let app;
let token = {};
let location;
let standard;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

/** Hang doi rieng cho test, backoff 10 ms de 5 lan thu xong nhanh. */
function testQueue(suffix) {
  const queue = new BullEventQueue({
    connection: getRedis(),
    workerConnection: workerConnectionFromUrl(env.redisUrl),
    name: `test-order-events-${suffix}-${process.pid}`,
    attempts: 5,
    backoffMs: 10,
  });
  queues.push(queue);
  return queue;
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const createOrder = async (receiverName) => {
  const res = await as("khach", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name: receiverName, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
    item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10 },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909982101", passwordHash, fullName: "Khách Sự Kiện", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[1], phone: "0909982102", passwordHash, fullName: "Kho HN Sự Kiện", role: "HUB_STAFF", hubId: hn._id },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { khach: await login(EMAILS[0]), kho: await login(EMAILS[1]) };
  location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho nhà", contactName: "Khách Sự Kiện", contactPhone: "0909982101", address: "1 Xuân Thủy",
      province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
    })
  ).body.data;
});

after(async () => {
  try {
    for (const worker of workers) await worker.close();
    for (const queue of queues) {
      await queue.queue.obliterate({ force: true });
      await queue.deadLetter.obliterate({ force: true });
      await queue.close();
    }
    await cleanup();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-21] hanh trinh cong khai: che so dien thoai, nhom trang thai de 14, cac moc co nhan", () => {
  assert.equal(maskPhone("0912345678"), "09xx xxx 678");
  assert.equal(maskPhone("091 234 5678"), "09xx xxx 678");
  const journey = buildPublicJourney({
    trackingCode: "EXP1234567890",
    status: "CONFIRMED",
    serviceName: "Giao hàng tiêu chuẩn",
    customerName: "Shop A",
    pickupWard: "Dịch Vọng Hậu",
    receiver: { name: "Trần Nhận", phone: "0912345678", address: "5 Lý Tự Trọng", district: "Quận 1", province: "TP Hồ Chí Minh" },
    statusHistory: [{ status: "CREATED", at: new Date("2026-11-09T01:00:00Z") }, { status: "CONFIRMED", at: new Date("2026-11-09T02:00:00Z") }],
  });
  assert.equal(journey.groupLabel, "Chưa nhận");
  assert.deepEqual(journey.events.map((e) => e.label), ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng"]);
  assert.deepEqual(journey.receiver, { phone: "09xx xxx 678", district: "Quận 1", province: "TP Hồ Chí Minh" });
  const text = JSON.stringify(journey);
  assert.ok(!text.includes("Trần Nhận") && !text.includes("0912345678") && !text.includes("Lý Tự Trọng"), "khong lo du lieu ca nhan");
});

test("[US-21] tao don va kho duyet -> moi lan doi trang thai phat mot su kien order.status.changed", async () => {
  const published = [];
  const events = getContainer().orderEvents;
  const original = events.publish.bind(events);
  events.publish = async (type, payload) => {
    published.push({ type, ...payload });
    return original(type, payload);
  };
  try {
    const order = await createOrder("Nhận sự kiện");
    assert.equal((await as("kho", request(app).post(`/orders/${order._id}/confirm`))).status, 200);
    const mine = published.filter((e) => e.orderId === order._id);
    assert.deepEqual(mine.map((e) => [e.type, e.from, e.to]), [
      ["order.status.changed", null, "CREATED"],
      ["order.status.changed", "CREATED", "CONFIRMED"],
    ]);
    assert.equal(mine[1].trackingCode, order.trackingCode);
    // su kien nam that trong hang doi BullMQ (Redis)
    const jobs = await events.queue.getJobs(["waiting", "active", "completed", "delayed", "failed"]);
    assert.ok(jobs.some((j) => j.data.orderId === order._id && j.data.to === "CONFIRMED"));
  } finally {
    events.publish = original;
  }
});

test("[US-21] consumer dung lai hanh trinh tu du lieu goc va ghi Redis; chay lai van cung ket qua (idempotent)", async () => {
  const order = await createOrder("Nhận idempotent");
  const { journeyService } = getContainer();
  const queue = testQueue("ok");
  workers.push(queue.startWorker({ "order.status.changed": (event) => journeyService.project(event) }));
  const queueEvents = new QueueEvents(queue.name, { connection: workerConnectionFromUrl(env.redisUrl) });
  try {
    const event = { orderId: order._id, trackingCode: order.trackingCode, from: null, to: "CREATED" };
    for (let i = 0; i < 3; i += 1) await (await queue.publish("order.status.changed", event)).waitUntilFinished(queueEvents, 10_000);
    const stored = JSON.parse(await getRedis().get(`journey:${order.trackingCode}`));
    assert.deepEqual(stored.events.map((e) => e.status), ["CREATED"], "chay 3 lan van chi 1 moc");
    assert.equal(stored.groupLabel, "Chưa nhận");
    assert.equal(stored.receiver.phone, "09xx xxx 678");
    const ttl = await getRedis().ttl(`journey:${order.trackingCode}`);
    assert.ok(ttl > 29 * 24 * 3600, "giu 30 ngay");
  } finally {
    await queueEvents.close();
  }
});

test("[US-21] consumer loi -> thu lai dung 5 lan (gian cach tang dan) roi chuyen sang dead-letter queue", async () => {
  const queue = testQueue("dlq");
  let calls = 0;
  workers.push(
    queue.startWorker({
      "order.status.changed": async () => {
        calls += 1;
        throw new Error("Redis tam mat ket noi");
      },
    }),
  );
  const job = await queue.publish("order.status.changed", { orderId: "x", trackingCode: "EXP0000000000", to: "CONFIRMED" });
  assert.deepEqual(job.opts.backoff, { type: "exponential", delay: 10 });
  let dead = [];
  for (let i = 0; i < 100 && dead.length === 0; i += 1) {
    await wait(50);
    dead = await queue.deadLetter.getJobs(["waiting"]);
  }
  assert.equal(calls, 5, "thu dung 5 lan");
  assert.equal(dead.length, 1, "het luot -> vao dead-letter queue");
  assert.equal(dead[0].name, "order.status.changed");
  assert.equal(dead[0].data.event.trackingCode, "EXP0000000000");
  assert.equal(dead[0].data.error, "Redis tam mat ket noi");
  assert.equal(dead[0].data.attempts, 5);
});

test("[US-21] luong nghiep vu: khach tao don, kho duyet -> consumer ghi hanh trinh cong khai 2 moc, doc lai duoc tu Redis", async () => {
  // worker chay dung handler cua ung dung tren hang doi that cua API (nhu server.js)
  const container = getContainer();
  workers.push(container.orderEvents.startWorker(container.orderEventHandlers));
  const order = await createOrder("Nhận luồng US-21");
  assert.equal((await as("kho", request(app).post(`/orders/${order._id}/confirm`))).status, 200);

  let stored = null;
  for (let i = 0; i < 100; i += 1) {
    stored = JSON.parse((await getRedis().get(`journey:${order.trackingCode}`)) || "null");
    if (stored?.events.length === 2) break;
    await wait(50);
  }
  assert.deepEqual(stored?.events.map((e) => e.label), ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng"]);
  assert.equal(stored.statusLabel, "Đã xác nhận, chờ lấy hàng");

  // xoa ban trong Redis -> doc lai van co (dung lai tu MongoDB)
  await getRedis().del(`journey:${order.trackingCode}`);
  const rebuilt = await container.journeyService.get(order.trackingCode);
  assert.equal(rebuilt.events.length, 2);
  assert.equal(await container.journeyService.get("EXP9999999999"), null);
});
