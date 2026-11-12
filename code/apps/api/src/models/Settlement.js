import mongoose from "mongoose";

// Ky doi soat voi shop (US-34, US-43, de 02): don da giao / da hoan trong ky, tien thu ho, phi khau tru, khoan
// dieu chinh (boi thuong su co, chi phi phat sinh) va so tien thuc te tra shop; ghi nhan giao dich chi tra.
const lineSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    trackingCode: { type: String, required: true },
    status: { type: String, required: true },
    finishedAt: { type: Date, required: true },
    feePayer: String,
    codCollected: { type: Number, default: 0 },
    feeTotal: { type: Number, default: 0 },
    feeDeducted: { type: Number, default: 0 },
  },
  { _id: false },
);

const adjustmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["COMPENSATION", "OTHER"], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

const settlementSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    status: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" },
    lines: { type: [lineSchema], default: [] },
    adjustments: { type: [adjustmentSchema], default: [] },
    totals: {
      orders: { type: Number, default: 0 },
      cod: { type: Number, default: 0 },
      feeDeducted: { type: Number, default: 0 },
      adjustments: { type: Number, default: 0 },
      netPayable: { type: Number, default: 0 },
    },
    payment: {
      amount: Number,
      bankName: String,
      accountNumber: String,
      accountName: String,
      txnRef: String,
      paidAt: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

settlementSchema.index({ code: 1 }, { unique: true });
settlementSchema.index({ customerId: 1, createdAt: -1 });
settlementSchema.index({ status: 1, createdAt: -1 });

export const Settlement = mongoose.model("Settlement", settlementSchema);
