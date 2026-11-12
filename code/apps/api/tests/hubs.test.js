// US-14: danh muc diem tap ket (HUB) va buu cuc (POST_OFFICE).
// Diem thu nghiem mang ma *-T14*, mo o cac quan/huyen da co trong seed (Ha Noi, Hai Phong).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers, suspendAreas } from "./helpers/fixtures.js";
import { User } from "../src/models/User.js";
import { Hub } from "../src/models/Hub.js";
import { Route } from "../src/models/Route.js";
import { ServiceArea } from "../src/models/ServiceArea.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["hub-admin@edms.vn", "hub-customer@edms.vn", "hub-kho-t14@edms.vn"];
const HUB_CODES = ["HUB-T14", "PO-T14-A", "PO-T14-X", "HUB-T14-AREA", "HUB-T14F", "PO-T14F"];
const ROUTE_CODES = ["R-T14", "R-T14F"];
// Xa/phuong co that tam go khoi vung phuc vu trong luc test: TEST_AREA admin them lai qua API,
// OUTSIDE la dia chi "ngoai vung phuc vu"
const TEST_AREA = { province: "Cao Bằng", ward: "Phường Thục Phán" };
const OUTSIDE = { province: "Hà Nội", ward: "Xã Sóc Sơn" };
let restoreAreas;

let app;
let adminToken;
let customerToken;
let seededHubs;

async function cleanup() {
  await Route.deleteMany({ code: { $in: ROUTE_CODES } });
  await Hub.deleteMany({ code: { $in: HUB_CODES } });
  await User.deleteMany({ email: { $in: EMAILS } });
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS, hubCodes: HUB_CODES });
  await cleanup();
  restoreAreas = await suspendAreas([TEST_AREA, OUTSIDE]);
  app = createApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909981401", passwordHash, fullName: "Hub Admin", role: "ADMIN" },
    {
      email: EMAILS[1],
      phone: "0909981402",
      passwordHash,
      fullName: "Hub Customer",
      role: "CUSTOMER",
      customerType: "INDIVIDUAL",
    },
  ]);
  const token = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  adminToken = await token(EMAILS[0]);
  customerToken = await token(EMAILS[1]);
  seededHubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM", "PO-DN"] } }).lean()).map((h) => [h.code, h]));
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

const asAdmin = (req) => req.set("Authorization", `Bearer ${adminToken}`);
const createHub = (body) => asAdmin(request(app).post("/hubs")).send(body);
const findHub = (code) => Hub.findOne({ code }).lean();

test("[US-14] CUSTOMER khong vao duoc API quan ly diem tap ket", async () => {
  const res = await request(app).get("/hubs").set("Authorization", `Bearer ${customerToken}`);
  assert.equal(res.status, 403);
  assert.equal((await request(app).get("/hubs")).status, 401);
});

test("[US-14] seed: moi diem gan khu vuc phuc vu, buu cuc Da Nang truc thuoc Hub Ha Noi", async () => {
  for (const hub of Object.values(seededHubs)) {
    const area = await ServiceArea.findById(hub.serviceAreaId).lean();
    assert.ok(area, `${hub.code} chua gan khu vuc phuc vu`);
    assert.deepEqual([area.province, area.ward], [hub.province, hub.ward]);
  }
  assert.equal(String(seededHubs["PO-DN"].parentHubId), String(seededHubs["HUB-HN"]._id));
  assert.equal(seededHubs["HUB-HN"].parentHubId, null);
});

test("[US-14] mo hub tu gan khu vuc phuc vu tu quan/huyen (go khong dau van ra), trung ma bi 409", async () => {
  const res = await createHub({ code: "hub-t14", name: "Hub T14", type: "HUB", province: "ha noi", ward: "cau giay" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.code, "HUB-T14");
  // Luu dung ten chuan trong serviceAreas, khong luu chu go khong dau
  assert.deepEqual([res.body.data.province, res.body.data.ward], ["Hà Nội", "Phường Cầu Giấy"]);
  const area = await ServiceArea.findOne({ province: "Hà Nội", ward: "Phường Cầu Giấy" }).lean();
  assert.equal(String(res.body.data.serviceAreaId), String(area._id));

  const duplicate = await createHub({ code: "HUB-T14", name: "Trung", type: "HUB", province: "Hà Nội", ward: "Phường Đống Đa" });
  assert.equal(duplicate.status, 409);
});

test("[US-14] buu cuc phai truc thuoc mot HUB; HUB khong co cap tren", async () => {
  const hub = await findHub("HUB-T14");
  const po = { code: "PO-T14-A", name: "Bưu cục T14 A", type: "POST_OFFICE", province: "Hà Nội", ward: "Phường Đống Đa" };

  const noParent = await createHub(po);
  assert.equal(noParent.status, 400);
  assert.match(noParent.body.error.message, /phải trực thuộc một hub/);

  const parentIsPostOffice = await createHub({ ...po, parentHubId: seededHubs["PO-DN"]._id });
  assert.equal(parentIsPostOffice.status, 400);
  assert.match(parentIsPostOffice.body.error.message, /cấp trên của bưu cục phải là hub/);

  const hubWithParent = await createHub({ code: "PO-T14-X", name: "X", type: "HUB", province: "Hà Nội", ward: "Phường Đống Đa", parentHubId: hub._id });
  assert.equal(hubWithParent.status, 400);

  const ok = await createHub({ ...po, parentHubId: hub._id });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));

  const list = await asAdmin(request(app).get("/hubs")).query({ parentHubId: String(hub._id) });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map((item) => item.code), ["PO-T14-A"]);
  assert.equal(list.body.data[0].parentHubId.code, "HUB-T14", "danh sach kem ma hub cap tren");
});

test("[US-14] chan mo diem (va doi dia ban) sang xa/phuong ngoai vung phuc vu hoac khong thuoc tinh", async () => {
  const outside = await createHub({ code: "PO-T14-X", name: "X", type: "HUB", province: "Hà Nội", ward: "Xã Sóc Sơn" });
  assert.equal(outside.status, 422);
  assert.equal(outside.body.error.code, "OUT_OF_SERVICE_AREA");
  assert.match(outside.body.error.message, /Xã Sóc Sơn, Hà Nội chưa thuộc vùng phục vụ/);

  const wrongProvince = await createHub({ code: "PO-T14-X", name: "X", type: "HUB", province: "Hà Nội", ward: "Phường Sài Gòn" });
  assert.equal(wrongProvince.status, 400);
  assert.match(wrongProvince.body.error.message, /Phường Sài Gòn" không thuộc Hà Nội/);

  const hub = await findHub("HUB-T14");
  const move = await asAdmin(request(app).put(`/hubs/${hub._id}`)).send({ ward: "Xã Sóc Sơn" });
  assert.equal(move.status, 422);
  const moved = await asAdmin(request(app).put(`/hubs/${hub._id}`)).send({ ward: "hai ba trung" });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.ward, "Phường Hai Bà Trưng");
  const area = await ServiceArea.findOne({ province: "Hà Nội", ward: "Phường Hai Bà Trưng" }).lean();
  assert.equal(String(moved.body.data.serviceAreaId), String(area._id));
});

test("[US-14] khong xoa diem con tuyen hoac buu cuc truc thuoc; hub con buu cuc khong doi thanh buu cuc", async () => {
  const hub = await findHub("HUB-T14");
  const po = await findHub("PO-T14-A");

  const demote = await asAdmin(request(app).put(`/hubs/${hub._id}`)).send({ type: "POST_OFFICE", parentHubId: seededHubs["HUB-HN"]._id });
  assert.equal(demote.status, 409);

  const deleteParent = await asAdmin(request(app).delete(`/hubs/${hub._id}`));
  assert.equal(deleteParent.status, 409);
  assert.match(deleteParent.body.error.message, /bưu cục trực thuộc/);

  const fakeHub = await asAdmin(request(app).post("/routes")).send({
    code: "R-T14",
    name: "Tuyến T14",
    hubId: new mongoose.Types.ObjectId(),
    maxPickupPerShift: 5,
    maxDeliveryPerShift: 5,
  });
  assert.equal(fakeHub.status, 400);
  assert.match(fakeHub.body.error.message, /Hub quản lý không tồn tại/);

  const route = await asAdmin(request(app).post("/routes")).send({
    code: "R-T14",
    name: "Tuyến T14",
    hubId: po._id,
    maxPickupPerShift: 5,
    maxDeliveryPerShift: 5,
  });
  assert.equal(route.status, 201, JSON.stringify(route.body));
  const deletePo = await asAdmin(request(app).delete(`/hubs/${po._id}`));
  assert.equal(deletePo.status, 409);
  assert.match(deletePo.body.error.message, /tuyến/);

  assert.equal((await asAdmin(request(app).delete(`/routes/${route.body.data._id}`))).status, 200);
  assert.equal((await asAdmin(request(app).delete(`/hubs/${po._id}`))).status, 200);
  assert.equal((await asAdmin(request(app).delete(`/hubs/${hub._id}`))).status, 200);
});

test("[US-14] khu vuc phuc vu con diem tap ket thi khong xoa duoc", async () => {
  const area = await asAdmin(request(app).post("/serviceAreas")).send({
    province: TEST_AREA.province,
    ward: TEST_AREA.ward,
    region: "BAC",
    routeId: (await Route.findOne({ code: "R-HN-NOI" }).lean())._id,
  });
  assert.equal(area.status, 201, JSON.stringify(area.body));
  const hub = await createHub({ code: "HUB-T14-AREA", name: "Hub T14 vùng", type: "HUB", ...TEST_AREA });
  assert.equal(hub.status, 201, JSON.stringify(hub.body));

  const blocked = await asAdmin(request(app).delete(`/serviceAreas/${area.body.data._id}`));
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error.message, /điểm tập kết/);

  assert.equal((await asAdmin(request(app).delete(`/hubs/${hub.body.data._id}`))).status, 200);
  assert.equal((await asAdmin(request(app).delete(`/serviceAreas/${area.body.data._id}`))).status, 200);
});

// Kiem tra LUONG nghiep vu cua story, theo dung thu tu admin lam ngoai doi:
// mo hub -> mo buu cuc truc thuoc -> giao tuyen va nhan vien cho buu cuc -> nhan
// vien dang nhap thay buu cuc cua minh -> dong buu cuc: phai chuyen tuyen, nhan vien di truoc.
test("[US-14] luong nghiep vu: hub -> buu cuc -> tuyen + nhan vien -> chuyen di roi moi dong buu cuc", async () => {
  const hub = await createHub({ code: "HUB-T14F", name: "Hub Hải Phòng", type: "HUB", province: "Hải Phòng", ward: "Phường Hồng Bàng" });
  assert.equal(hub.status, 201, JSON.stringify(hub.body));
  const po = await createHub({
    code: "PO-T14F",
    name: "Bưu cục Lê Chân",
    type: "POST_OFFICE",
    parentHubId: hub.body.data._id,
    address: "12 Tô Hiệu",
    province: "Hải Phòng",
    ward: "Phường Lê Chân",
  });
  assert.equal(po.status, 201, JSON.stringify(po.body));
  const poId = po.body.data._id;

  const route = await asAdmin(request(app).post("/routes")).send({
    code: "R-T14F",
    name: "Nội thành Lê Chân",
    hubId: poId,
    maxPickupPerShift: 12,
    maxDeliveryPerShift: 12,
  });
  assert.equal(route.status, 201, JSON.stringify(route.body));

  const staffBody = {
    email: EMAILS[2],
    phone: "0909981403",
    password: PASSWORD,
    fullName: "Kho Lê Chân",
    role: "HUB_STAFF",
  };
  const badStaff = await asAdmin(request(app).post("/users")).send({ ...staffBody, hubId: new mongoose.Types.ObjectId() });
  assert.equal(badStaff.status, 400);
  const staff = await asAdmin(request(app).post("/users")).send({ ...staffBody, hubId: poId });
  assert.equal(staff.status, 201, JSON.stringify(staff.body));

  // Nhan vien dang nhap App Nhan vien thay dung buu cuc minh phu trach
  const staffLogin = await request(app).post("/auth/login").send({ emailOrPhone: EMAILS[2], password: PASSWORD, app: "STAFF" });
  assert.equal(staffLogin.status, 200);
  const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${staffLogin.body.data.accessToken}`);
  assert.equal(me.body.data.hubId.code, "PO-T14F");

  const closeWhileUsed = await asAdmin(request(app).delete(`/hubs/${poId}`));
  assert.equal(closeWhileUsed.status, 409);
  assert.match(closeWhileUsed.body.error.message, /tuyến, nhân viên/);

  // Chuyen tuyen va nhan vien ve hub cap tren, buu cuc het duoc dung -> xoa duoc
  assert.equal((await asAdmin(request(app).put(`/routes/${route.body.data._id}`)).send({ hubId: hub.body.data._id })).status, 200);
  assert.equal((await asAdmin(request(app).put(`/users/${staff.body.data._id}`)).send({ hubId: hub.body.data._id })).status, 200);
  assert.equal((await asAdmin(request(app).delete(`/hubs/${poId}`))).status, 200);

  // Hub van con tuyen + nhan vien: khong xoa, chi tat hoat dong
  assert.equal((await asAdmin(request(app).delete(`/hubs/${hub.body.data._id}`))).status, 409);
  const off = await asAdmin(request(app).put(`/hubs/${hub.body.data._id}`)).send({ isActive: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.data.isActive, false);
});
