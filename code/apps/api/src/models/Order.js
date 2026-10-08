import mongoose from "mongoose";
import { ORDER_STATUS, ZONE, FEE_PAYER, FEE_PAYMENT_METHOD, COD_METHOD, PACKING_TYPE } from "../constants/enums.js";

const receiverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    weightGram: { type: Number, required: true, min: 1 },
    length: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    declaredValue: { type: Number, default: 0, min: 0 },
    packingType: { type: String, enum: PACKING_TYPE, default: "BOX" },
    note: String,
  },
  { _id: false },
);

const flagsSchema = new mongoose.Schema(
  {
    fragile: { type: Boolean, default: false },
    highValue: { type: Boolean, default: false },
    isVehicle: { type: Boolean, default: false },
  },
  { _id: false },
);

const feeSchema = new mongoose.Schema(
  {
    base: { type: Number, default: 0 },
    weightSurcharge: { type: Number, default: 0 },
    serviceSurcharge: { type: Number, default: 0 },
    specialSurcharge: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const codSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, default: 0, min: 0, max: 20000000 },
    // Ai tra phi van chuyen - dat trong cod theo dung schema CLAUDE.md, ap dung
    // du cod.enabled co bat hay khong (van phai co nguoi tra phi ship).
    feePayer: { type: String, enum: FEE_PAYER, default: "RECIPIENT_PAID" },
    // Chi co y nghia khi feePayer = SHOP_PREPAID: nguoi gui tra truoc qua QR
    // hoac tien mat luc shipper den lay hang. Hai truong hop khac (RECIPIENT_PAID,
    // DEDUCT_FROM_COD) thu phi gop cung luc thu/giao hang nen khong can field nay.
    feePaymentMethod: { type: String, enum: FEE_PAYMENT_METHOD, default: null },
    feePaid: { type: Boolean, default: false },
    feePaidAt: { type: Date, default: null },
    collected: { type: Boolean, default: false },
    collectedAt: { type: Date, default: null },
    method: { type: String, enum: COD_METHOD, default: null },
    txnRef: { type: String, default: null },
  },
  { _id: false },
);

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUS, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: String,
    location: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    trackingCode: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true },

    pickupLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "PickupLocation", required: true },
    pickupWard: { type: String, required: true },

    receiver: { type: receiverSchema, required: true },
    item: { type: itemSchema, required: true },
    flags: { type: flagsSchema, default: () => ({}) },

    serviceTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceType", required: true },
    serviceName: { type: String, required: true },

    zone: { type: String, enum: ZONE, required: true },
    chargeableWeight: { type: Number, required: true },

    fee: { type: feeSchema, default: () => ({}) },
    cod: { type: codSchema, default: () => ({}) },

    status: { type: String, enum: ORDER_STATUS, default: "CREATED" },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },

    deliveryAttempts: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement", default: null },
  },
  { timestamps: true },
);

orderSchema.index({ trackingCode: 1 }, { unique: true });
orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
