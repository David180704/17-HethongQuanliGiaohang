import mongoose from "mongoose";

// Adapter transaction: service chi goi run(work) va truyen `session` vao MOI lenh ghi,
// khong tu import mongoose (doi CSDL chi sua file nay). withTransaction tu chay lai
// work khi gap loi tam thoi (TransientTransactionError, vd hai don cung tang counter).
export class MongooseTransactionRunner {
  async run(work) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
