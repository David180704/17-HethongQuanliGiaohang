import mongoose from "mongoose";

// Lan chay truoc bi ngat giua chung (Ctrl+C, treo, tat may) thi after() khong
// chay -> user/hub test con sot -> User.create lan sau loi trung email/so dien
// thoai, ca file test fail. Goi ham nay dau before() de setup luon chay lai duoc.
export async function removeLeftovers({ emails = [], hubCodes = [] } = {}) {
  const db = mongoose.connection;
  if (emails.length) await db.collection("users").deleteMany({ email: { $in: emails } });
  if (hubCodes.length) await db.collection("hubs").deleteMany({ code: { $in: hubCodes } });
}

// Ca 3.321 xa/phuong deu dang phuc vu. Test can "xa/phuong co that nhung chua phuc vu" (hoac tu them
// khu vuc qua API) thi tam go khu vuc do, xong tra lai nguyen trang: dung tuyen, mien nhu cac xa/phuong
// khac cung tinh. Goi lai duoc nhieu lan; lan truoc bi ngat giua chung thi lan sau tu tra lai.
export async function restoreAreas(places) {
  const areas = mongoose.connection.collection("serviceareas");
  for (const { province, ward } of places) {
    const sibling = await areas.findOne({ province, ward: { $ne: ward } });
    if (!sibling) continue;
    await areas.updateOne(
      { province, ward },
      { $set: { region: sibling.region, routeId: sibling.routeId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }
}

export async function suspendAreas(places) {
  await restoreAreas(places);
  await mongoose.connection.collection("serviceareas").deleteMany({ $or: places.map(({ province, ward }) => ({ province, ward })) });
  return () => restoreAreas(places);
}
