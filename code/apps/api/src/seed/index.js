import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import { connectDB, disconnectDB } from "../config/db.js";
import { Role, User, Hub, Route, ServiceArea, ServiceType, PriceTable, PickupLocation, Order, OrderDraft, Assignment } from "../models/index.js";
import { roles, hubs, routes, serviceAreas, serviceTypes, buildPriceTables } from "./referenceData.js";
import { buildStatusChain, countDeliveryAttempts, isAssignedStage } from "./orderHistory.js";
import { calcZone, calcChargeableWeight, calcFee } from "./feeHelper.js";
import { randomVnName, randomVnPhone } from "./vnNames.js";
import { ORDER_STATUS } from "../constants/enums.js";

const SEED_PASSWORD = "Password123!";
const TOTAL_ORDERS = 200;
const BASE_COUNT_PER_STATUS = 8;

faker.seed(42);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = faker.number.int({ min: 0, max: i });
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildStatusPool() {
  const pool = [];
  for (const status of ORDER_STATUS) {
    for (let i = 0; i < BASE_COUNT_PER_STATUS; i++) pool.push(status);
  }
  const weighted = [
    "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
    "CREATED", "CREATED", "CONFIRMED", "CONFIRMED",
    "IN_TRANSIT", "IN_TRANSIT", "OUT_FOR_DELIVERY",
    "PICKUP_ASSIGNED", "PICKED_UP", "SORTED",
  ];
  while (pool.length < TOTAL_ORDERS) {
    pool.push(faker.helpers.arrayElement(weighted));
  }
  return shuffle(pool).slice(0, TOTAL_ORDERS);
}

async function clearAll() {
  await Promise.all(
    [Role, User, Hub, Route, ServiceArea, ServiceType, PriceTable, PickupLocation, Order, OrderDraft, Assignment].map(
      (m) => m.deleteMany({}),
    ),
  );
}

async function seedRoles() {
  await Role.insertMany(roles);
}

async function seedHubs() {
  const docs = await Hub.insertMany(hubs.map(({ _key, ...rest }) => ({ ...rest, isActive: true })));
  const map = {};
  hubs.forEach((h, i) => (map[h._key] = docs[i]));
  return map;
}

async function seedRoutes(hubMap) {
  const docs = await Route.insertMany(
    routes.map((r) => ({
      code: r.code,
      name: r.name,
      hubId: hubMap[r.hubKey]._id,
      maxPickupPerShift: r.maxPickupPerShift,
      maxDeliveryPerShift: r.maxDeliveryPerShift,
      isActive: true,
    })),
  );
  const map = {};
  routes.forEach((r, i) => (map[r._key] = docs[i]));
  return map;
}

async function seedServiceAreas(routeMap) {
  const docs = await ServiceArea.insertMany(
    serviceAreas.map((sa) => ({
      province: sa.province,
      district: sa.district,
      wards: [],
      region: sa.region,
      routeId: routeMap[sa.routeKey]._id,
    })),
  );
  return docs;
}

async function seedServiceTypes() {
  const docs = await ServiceType.insertMany(
    serviceTypes.map((st) => ({
      code: st.code,
      name: st.name,
      surchargeRate: st.surchargeRate,
      estimatedDays: st.estimatedDays,
      isActive: true,
    })),
  );
  const map = {};
  serviceTypes.forEach((st, i) => (map[st._key] = docs[i]));
  return map;
}

async function seedPriceTables(serviceTypeMap) {
  const definitions = buildPriceTables();
  const docs = await PriceTable.insertMany(
    definitions.map((d) => ({
      serviceTypeId: serviceTypeMap[d.serviceTypeKey]._id,
      zone: d.zone,
      weightTiers: d.weightTiers,
      effectiveFrom: d.effectiveFrom,
      effectiveTo: d.effectiveTo,
      isActive: d.isActive,
    })),
  );
  const map = {};
  definitions.forEach((d, i) => (map[`${d.serviceTypeKey}:${d.zone}`] = docs[i]));
  return map;
}

async function seedUsers({ hubDocs, routeDocs }) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  let phoneCounter = 900000;
  const nextPhone = () => `090${String(phoneCounter++).padStart(7, "0")}`;

  const admin = {
    email: "admin@edms.vn",
    phone: nextPhone(),
    passwordHash,
    fullName: "Quan Tri He Thong",
    role: "ADMIN",
    status: "ACTIVE",
  };

  const hubStaff = hubDocs.map((hub, i) => ({
    email: `hubstaff${i + 1}@edms.vn`,
    phone: nextPhone(),
    passwordHash,
    fullName: randomVnName(),
    role: "HUB_STAFF",
    status: "ACTIVE",
    hubId: hub._id,
  }));

  const shippers = Array.from({ length: 5 }, (_, i) => ({
    email: `shipper${i + 1}@edms.vn`,
    phone: nextPhone(),
    passwordHash,
    fullName: randomVnName(),
    role: "SHIPPER",
    status: "ACTIVE",
    routeIds: [routeDocs[i % routeDocs.length]._id],
  }));

  const customers = Array.from({ length: 10 }, (_, i) => {
    const isBusiness = i >= 6;
    const pendingApproval = i === 9;
    const base = {
      email: `customer${i + 1}@edms.vn`,
      phone: nextPhone(),
      passwordHash,
      fullName: randomVnName(),
      role: "CUSTOMER",
      status: pendingApproval ? "PENDING" : "ACTIVE",
      customerType: isBusiness ? "BUSINESS" : "INDIVIDUAL",
      bankAccount: {
        bankName: "Vietcombank",
        accountNumber: faker.string.numeric(10),
        accountName: randomVnName().toUpperCase(),
      },
    };
    if (isBusiness) {
      base.shopName = `Shop ${base.fullName}`;
      base.taxCode = faker.string.numeric(10);
    }
    return base;
  });

  const userDocs = await User.insertMany([admin, ...hubStaff, ...shippers, ...customers]);
  return {
    admin: userDocs[0],
    hubStaff: userDocs.slice(1, 1 + hubStaff.length),
    shippers: userDocs.slice(1 + hubStaff.length, 1 + hubStaff.length + shippers.length),
    customers: userDocs.slice(1 + hubStaff.length + shippers.length),
  };
}

async function seedPickupLocations({ customers, serviceAreaDocs }) {
  const docs = [];
  for (const customer of customers) {
    const area = faker.helpers.arrayElement(serviceAreaDocs);
    docs.push({
      customerId: customer._id,
      label: "Dia chi mac dinh",
      contactName: customer.fullName,
      contactPhone: customer.phone,
      address: `${faker.number.int({ min: 1, max: 300 })} Duong ${faker.helpers.arrayElement(["Le Loi", "Tran Hung Dao", "Nguyen Trai", "Hai Ba Trung", "Vo Van Kiet"])}`,
      province: area.province,
      district: area.district,
      ward: `Phuong ${faker.number.int({ min: 1, max: 15 })}`,
      serviceAreaId: area._id,
      isDefault: true,
      isActive: true,
    });
  }
  const inserted = await PickupLocation.insertMany(docs);
  return inserted.map((loc, i) => ({ loc, customer: customers[i] }));
}

function randomReceiverAddress(area) {
  return {
    name: randomVnName(),
    phone: randomVnPhone(),
    address: `${faker.number.int({ min: 1, max: 300 })} Duong ${faker.helpers.arrayElement(["Le Loi", "CMT8", "Nguyen Hue", "Pham Van Dong", "Ly Thuong Kiet"])}`,
    province: area.province,
    district: area.district,
    ward: `Phuong ${faker.number.int({ min: 1, max: 15 })}`,
  };
}

function buildStatusHistory(chain, createdAt) {
  let t = createdAt.getTime();
  return chain.map((status) => {
    t += faker.number.int({ min: 1, max: 10 }) * 3600 * 1000;
    return { status, at: new Date(t), note: "" };
  });
}

async function seedOrders({ customerLocations, serviceAreaDocs, serviceTypeMap, priceTableMap, shippers }) {
  const statusPool = buildStatusPool();
  const serviceTypeKeys = Object.keys(serviceTypeMap);

  const docs = statusPool.map((status, i) => {
    const { loc, customer } = faker.helpers.arrayElement(customerLocations);
    const pickupArea = serviceAreaDocs.find((a) => String(a._id) === String(loc.serviceAreaId));
    const receiverArea = faker.helpers.arrayElement(serviceAreaDocs);

    const serviceTypeKey = faker.helpers.arrayElement(serviceTypeKeys);
    const serviceType = serviceTypeMap[serviceTypeKey];

    const item = {
      name: faker.helpers.arrayElement(["Quan ao", "Giay dep", "Sach", "Do dien tu", "My pham", "Phu kien"]),
      weightGram: faker.number.int({ min: 100, max: 8000 }),
      length: faker.number.int({ min: 5, max: 60 }),
      width: faker.number.int({ min: 5, max: 50 }),
      height: faker.number.int({ min: 5, max: 40 }),
      declaredValue: faker.helpers.arrayElement([0, 0, 200000, 500000, 1500000, 6000000]),
      packingType: faker.helpers.arrayElement(["BOX", "BAG", "ENVELOPE"]),
      note: "",
    };

    const flags = {
      fragile: faker.number.int({ min: 1, max: 100 }) <= 15,
      highValue: item.declaredValue >= 5000000,
      isVehicle: faker.number.int({ min: 1, max: 100 }) <= 3,
    };

    const zone = calcZone(pickupArea, receiverArea);
    const chargeableWeight = calcChargeableWeight(item);
    const priceTable = priceTableMap[`${serviceTypeKey}:${zone}`];
    const fee = calcFee({ priceTable, serviceType, chargeableWeight, flags });

    const chain = buildStatusChain(status);
    const createdAt = faker.date.recent({ days: 45 });
    const statusHistory = buildStatusHistory(chain, createdAt);

    let codEnabled = faker.number.int({ min: 1, max: 100 }) <= 75;
    let feePayer = faker.helpers.arrayElement(["SHOP_PREPAID", "RECIPIENT_PAID", "DEDUCT_FROM_COD"]);
    let codAmount = codEnabled ? faker.number.int({ min: 50000, max: 3000000 }) : 0;

    if (feePayer === "DEDUCT_FROM_COD") {
      codEnabled = true;
      if (codAmount < fee.total) codAmount = fee.total + faker.number.int({ min: 10000, max: 200000 });
    }

    const delivered = chain.includes("DELIVERED");
    const feePaymentMethod = feePayer === "SHOP_PREPAID" ? faker.helpers.arrayElement(["QR", "CASH"]) : null;
    const pickedUp = chain.includes("PICKED_UP");
    const feePaid =
      feePayer === "SHOP_PREPAID" ? (feePaymentMethod === "QR" ? true : pickedUp) : delivered || null;

    return {
      trackingCode: `EXP${String(1000000000 + i).slice(0, 10)}`,
      customerId: customer._id,
      customerName: customer.fullName,
      pickupLocationId: loc._id,
      pickupWard: loc.ward,
      receiver: randomReceiverAddress(receiverArea),
      item,
      flags,
      serviceTypeId: serviceType._id,
      serviceName: serviceTypeKey === "EXPRESS" ? "Gui nhanh" : "Gui thuong",
      zone,
      chargeableWeight,
      fee,
      cod: {
        enabled: codEnabled,
        amount: codEnabled ? codAmount : 0,
        feePayer,
        feePaymentMethod,
        feePaid: feePaid === null ? false : feePaid,
        feePaidAt: feePaid ? statusHistory[statusHistory.length - 1].at : null,
        collected: codEnabled && delivered,
        collectedAt: codEnabled && delivered ? statusHistory[statusHistory.length - 1].at : null,
        method: codEnabled && delivered ? faker.helpers.arrayElement(["CASH", "TRANSFER"]) : null,
        txnRef: null,
      },
      status,
      statusHistory,
      deliveryAttempts: countDeliveryAttempts(chain),
      assignedTo: isAssignedStage(chain) ? faker.helpers.arrayElement(shippers)._id : null,
      createdAt,
      updatedAt: statusHistory[statusHistory.length - 1].at,
    };
  });

  await Order.insertMany(docs);
}

async function main() {
  await connectDB();
  console.log("Dang xoa du lieu cu...");
  await clearAll();

  console.log("Dang seed vai tro...");
  await seedRoles();

  console.log("Dang seed hub, tuyen, khu vuc...");
  const hubMap = await seedHubs();
  const routeMap = await seedRoutes(hubMap);
  const serviceAreaDocs = await seedServiceAreas(routeMap);

  console.log("Dang seed loai dich vu va bang gia...");
  const serviceTypeMap = await seedServiceTypes();
  const priceTableMap = await seedPriceTables(serviceTypeMap);

  console.log("Dang seed nguoi dung...");
  const hubDocs = Object.values(hubMap);
  const routeDocs = Object.values(routeMap);
  const { hubStaff, shippers, customers } = await seedUsers({ hubDocs, routeDocs });

  console.log("Dang seed dia diem lay hang...");
  const customerLocations = await seedPickupLocations({ customers, serviceAreaDocs });

  console.log("Dang seed 200 don hang trai 18 trang thai...");
  await seedOrders({ customerLocations, serviceAreaDocs, serviceTypeMap, priceTableMap, shippers });

  console.log("\nHoan tat seed du lieu.");
  console.log(`Mat khau mac dinh cho moi tai khoan seed: ${SEED_PASSWORD}`);
  console.log("Tai khoan admin: admin@edms.vn");
  console.log(`So hub staff: ${hubStaff.length}, shipper: ${shippers.length}, customer: ${customers.length}`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Seed loi:", err);
  await disconnectDB();
  process.exit(1);
});
