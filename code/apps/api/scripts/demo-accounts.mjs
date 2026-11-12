/* global fetch */
// Tai khoan dung thu (nguoi dung yeu cau 11-12/11/2026): kho HN / HCM / DN va shipper tung vung, mat khau 123123,
// kem diem check-in va ca 06:00-22:00 hom nay + ngay mai. Can API dev dang chay (cong 4044, CSDL local).
//   npm run accounts:demo     (chay lai sau npm run seed:local)
//   npm run accounts:demo -- --xoa-ca   go cac "Ca test" (truoc khi chay npm test / Playwright: ca mo tren tuyen lam don
//                                       trong test bi tu phan cong, test dang cho don o CONFIRMED se lech)
const B = "http://localhost:4044";
const PASS = "123123";

async function call(method, path, token, body) {
  const res = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}
const login = async (email, password) => (await call("POST", "/auth/login", null, { emailOrPhone: email, password })).json.data.accessToken;

const admin = await login("admin@edms.vn", "123456");

const day = (offset) => new Date(Date.now() + 7 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
if (process.argv.includes("--xoa-ca")) {
  let removed = 0;
  for (const offset of [-1, 0, 1, 2]) {
    const shifts = (await call("GET", `/shifts?date=${day(offset)}`, admin)).json.data || [];
    for (const shift of shifts.filter((x) => x.name === "Ca test")) {
      await call("DELETE", `/shifts/${shift._id}`, admin);
      removed += 1;
    }
  }
  console.log(`Da go ${removed} ca test`);
  process.exit(0);
}
const hubs = Object.fromEntries((await call("GET", "/hubs?limit=50", admin)).json.data.map((h) => [h.code, h._id]));
const routes = Object.fromEntries((await call("GET", "/routes?limit=50", admin)).json.data.map((r) => [r.code, r._id]));

const USERS = [
  { email: "khohn@edms.vn", phone: "0912000001", fullName: "Kho Hà Nội", role: "HUB_STAFF", hubId: hubs["HUB-HN"] },
  { email: "khohcm@edms.vn", phone: "0912000002", fullName: "Kho Hồ Chí Minh", role: "HUB_STAFF", hubId: hubs["HUB-HCM"] },
  { email: "khodn@edms.vn", phone: "0912000003", fullName: "Kho Đà Nẵng", role: "HUB_STAFF", hubId: hubs["PO-DN"] },
  { email: "shiphn1@edms.vn", phone: "0912000011", fullName: "Shipper Hà Nội 1", role: "SHIPPER", routeIds: [routes["R-HN-NOI"]] },
  { email: "shiphn2@edms.vn", phone: "0912000012", fullName: "Shipper Hà Nội 2", role: "SHIPPER", routeIds: [routes["R-HN-NOI"], routes["R-HN-LIEN"]] },
  { email: "shiphcm@edms.vn", phone: "0912000013", fullName: "Shipper Hồ Chí Minh", role: "SHIPPER", routeIds: [routes["R-HCM-NOI"]] },
  { email: "shipdn@edms.vn", phone: "0912000014", fullName: "Shipper Đà Nẵng", role: "SHIPPER", routeIds: [routes["R-DN-NOI"]] },
];

const ids = {};
for (const u of USERS) {
  const res = await call("POST", "/users", admin, { ...u, password: PASS });
  if (res.status === 201) ids[u.email] = res.json.data._id;
  console.log(u.email, res.status, res.status === 201 ? "tao moi" : res.json.error?.message);
}
// Lay id neu da ton tai tu lan chay truoc
for (const u of USERS) {
  if (ids[u.email]) continue;
  const found = (await call("GET", `/users?search=${encodeURIComponent(u.email)}`, admin)).json.data?.[0];
  if (found) ids[u.email] = found._id;
}

// Moi shipper mot diem check-in hop le cung vung (12/11/2026)
const points = Object.fromEntries((await call("GET", "/checkinPoints?limit=50", admin)).json.data.map((p) => [p.code, p._id]));
for (const [email, code] of [["shiphn1@edms.vn", "CP-HN-HUB"], ["shiphn2@edms.vn", "CP-HN-HUB"], ["shiphcm@edms.vn", "CP-HCM-HUB"], ["shipdn@edms.vn", "CP-DN-PO"]]) {
  const res = await call("PUT", `/users/${ids[email]}`, admin, { checkinPointId: points[code] });
  console.log("diem check-in", email, code, res.status === 200 ? "OK" : res.json.error?.message);
}

// Kiem tra dang nhap bang mat khau moi
for (const u of USERS) {
  const res = await call("POST", "/auth/login", null, { emailOrPhone: u.email, password: PASS });
  console.log("dang nhap", u.email, res.status === 200 ? "OK" : res.json.error?.message);
}

// Ca lam viec 06:00-22:00 hom nay va ngay mai (gio Viet Nam), do kho cua tung hub lap
const SHIFTS = [
  { kho: "khohn@edms.vn", route: "R-HN-NOI", people: ["shiphn1@edms.vn", "shiphn2@edms.vn"] },
  { kho: "khohn@edms.vn", route: "R-HN-LIEN", people: ["shiphn2@edms.vn"] },
  { kho: "khohcm@edms.vn", route: "R-HCM-NOI", people: ["shiphcm@edms.vn"] },
  { kho: "khodn@edms.vn", route: "R-DN-NOI", people: ["shipdn@edms.vn"] },
];
for (const s of SHIFTS) {
  const token = await login(s.kho, PASS);
  for (const offset of [0, 1]) {
    // R-HN-LIEN: ca chieu de khong trung gio voi ca R-HN-NOI cua Shipper Ha Noi 2
    const [startTime, endTime] = s.route === "R-HN-LIEN" ? ["22:00", "23:30"] : ["06:00", "22:00"];
    const res = await call("POST", "/shifts", token, {
      routeId: routes[s.route],
      name: "Ca test",
      shiftDate: day(offset),
      startTime,
      endTime,
      shipperIds: s.people.map((e) => ids[e]),
    });
    console.log("ca", s.route, day(offset), startTime + "-" + endTime, res.status === 201 ? "OK" : res.json.error?.message);
  }
}
