import mongoose from "mongoose";
import { CHECKIN_SOURCE } from "../constants/enums.js";

// Moc check-in (US-30): tai xe qua mot diem khi dang cam don. Cung diem + cung don chi ghi mot lan trong 30 phut.
const checkinLogSchema = new mongoose.Schema(
  {
    pointId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckinPoint", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    source: { type: String, enum: CHECKIN_SOURCE, default: "AUTO" },
    // Ma su kien do app sinh: gui lai (mat mang roi co mang) khong ghi trung
    clientEventId: { type: String, default: null },
  },
  { timestamps: true },
);

checkinLogSchema.index({ orderId: 1, pointId: 1, at: -1 });
checkinLogSchema.index({ shipperId: 1, clientEventId: 1, orderId: 1, pointId: 1 }, { unique: true, partialFilterExpression: { clientEventId: { $type: "string" } } });

export const CheckinLog = mongoose.model("CheckinLog", checkinLogSchema);
