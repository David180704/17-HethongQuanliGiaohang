import mongoose from "mongoose";

// Lan chay truoc bi ngat giua chung (Ctrl+C, treo, tat may) thi after() khong
// chay -> user/hub test con sot -> User.create lan sau loi trung email/so dien
// thoai, ca file test fail. Goi ham nay dau before() de setup luon chay lai duoc.
export async function removeLeftovers({ emails = [], hubCodes = [] } = {}) {
  const db = mongoose.connection;
  if (emails.length) await db.collection("users").deleteMany({ email: { $in: emails } });
  if (hubCodes.length) await db.collection("hubs").deleteMany({ code: { $in: hubCodes } });
}
