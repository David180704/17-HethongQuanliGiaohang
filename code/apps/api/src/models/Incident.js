import mongoose from "mongoose";
import { INCIDENT_TYPE, INCIDENT_STATUS, INCIDENT_SOURCE, ORDER_STATUS } from "../constants/enums.js";

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: INCIDENT_STATUS, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: String,
  },
  { _id: false },
);

// Su co / khieu nai (US-38, de 02): noi dung, don lien quan, tinh trang xu ly, ket qua giai quyet. Boi thuong
// (neu co) duoc dua vao ky doi soat cua shop thanh khoan dieu chinh (US-43).
const incidentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    trackingCode: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Kho lien quan cua don (lay hang, kho dich) - pham vi xu ly cua nhan vien kho
    hubIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hub" }],
    type: { type: String, enum: INCIDENT_TYPE, required: true },
    source: { type: String, enum: INCIDENT_SOURCE, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: INCIDENT_STATUS, default: "OPEN" },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Trang thai don truoc khi chuyen INCIDENT - tra lai khi giai quyet xong
    orderStatusBefore: { type: String, enum: ORDER_STATUS, default: null },
    history: { type: [historySchema], default: [] },
    resolution: {
      result: String,
      compensation: { type: Number, min: 0, default: 0 },
      at: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    // Ky doi soat da tinh khoan boi thuong (US-43)
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement", default: null },
  },
  { timestamps: true },
);

incidentSchema.index({ code: 1 }, { unique: true });
incidentSchema.index({ orderId: 1, status: 1 });
incidentSchema.index({ hubIds: 1, status: 1, createdAt: -1 });

export const Incident = mongoose.model("Incident", incidentSchema);
