import { Counter } from "../../models/Counter.js";

export const TRACKING_COUNTER = "trackingCode";

/** "EXP" + 10 chu so tu so thu tu cua bo dem. */
export const formatTrackingCode = (seq) => `EXP${String(seq).padStart(10, "0")}`;

export class CounterRepository {
  /**
   * Tang bo dem TRONG transaction va tra so moi (khong sinh ngau nhien roi do trung).
   * Chua co bo dem (CSDL nap tu file mongosh, chua chay seed) -> bat dau ngay sau
   * startAfter(), vd so lon nhat trong ma van don dang co.
   */
  async next(name, { session, startAfter }) {
    const bumped = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, session }).lean();
    if (bumped) return bumped.seq;
    const start = await startAfter();
    // Pipeline + upsert: neu transaction khac vua tao bo dem thi van cong tiep tu so cua no
    const created = await Counter.findOneAndUpdate(
      { _id: name },
      [{ $set: { seq: { $add: [{ $ifNull: ["$seq", start] }, 1] } } }],
      { upsert: true, new: true, session },
    ).lean();
    return created.seq;
  }

  current(name) {
    return Counter.findById(name).lean();
  }
}
