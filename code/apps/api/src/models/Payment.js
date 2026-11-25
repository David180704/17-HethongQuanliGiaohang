import mongoose from "mongoose";
import { PAYMENT_STATUS, PAYMENT_PROVIDER, PAYMENT_CLIENT } from "../constants/enums.js";

// Giao dich thanh toan phi van chuyen qua cong VNPay (US-44). Moi lan khach bam "Thanh toan" tao mot giao dich
// PENDING voi ma txnRef rieng; VNPay bao ket qua (IPN / trang return) thi chuyen SUCCESS hoac FAILED dung mot lan.
// Tach khoi don hang de giu lich su moi lan thu (that bai roi thu lai) va chong xu ly trung khi VNPay goi lai IPN.
const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    trackingCode: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: PAYMENT_PROVIDER, default: "VNPAY" },
    // vnp_TxnRef: ma giao dich phia EDMS, duy nhat
    txnRef: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PAYMENT_STATUS, default: "PENDING" },
    client: { type: String, enum: PAYMENT_CLIENT, default: "WEB" },
    // Dia chi tra nguoi dung ve sau khi thanh toan (trang chi tiet don tren web, deep link cua app)
    returnTo: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    // Ket qua VNPay tra ve
    responseCode: { type: String, default: null },
    transactionNo: { type: String, default: null },
    bankCode: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ txnRef: 1 }, { unique: true });
paymentSchema.index({ orderId: 1, createdAt: -1 });

export const Payment = mongoose.model("Payment", paymentSchema);
