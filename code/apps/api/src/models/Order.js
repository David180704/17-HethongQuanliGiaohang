import mongoose from "mongoose";
import {
  ORDER_STATUS,
  ORDER_CHANNEL,
  VEHICLE_TYPE,
  ZONE,
  FEE_PAYER,
  FEE_PAYMENT_METHOD,
  COD_METHOD,
  PACKING_TYPE,
  ITEM_CATEGORY,
} from "../constants/enums.js";

const receiverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    province: { type: String, required: true },
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
    // Thoi diem don chuyen CONFIRMED: tu day phi co dinh, bang gia doi ve sau khong
    // lam doi phi don nay (US-17). null = don con cho xac nhan.
    lockedAt: { type: Date, default: null },
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
    // Kenh tao don (US-40): ONLINE - khach tu tao; COUNTER - nhan vien kho tiep nhan tai quay (hang da o diem,
    // khong co dia diem lay hang, nguoi tiep nhan = receivedBy)
    channel: { type: String, enum: ORDER_CHANNEL, default: "ONLINE" },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Ma don cua shop tren website ban hang (de 14 muc a) - tuy chon, tim kiem duoc
    shopOrderCode: { type: String, default: null, trim: true },
    // Phuong tien goi y luc tiep nhan (US-40): MOTORBIKE | TRUCK
    vehicle: { type: String, enum: VEHICLE_TYPE, default: null },

    pickupLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupLocation",
      required() {
        return this.channel !== "COUNTER";
      },
      default: null,
    },
    pickupWard: { type: String, required: true },
    // Hub/buu cuc quan ly tuyen cua khu vuc lay hang: nhan vien diem nay (va hub cap
    // tren) duyet don, phan cong lay hang (US-18). Xac dinh luc tao don.
    pickupHubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", default: null },
    // Hub phu trach tuyen cua khu vuc nguoi nhan - kho dich (US-41). Xac dinh luc tao don.
    destHubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", default: null },
    // Kho dang giu hang (nhap kho / nhan o kho dich) - nhan vien kho do moi phan loai, xuat kho duoc
    currentHubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", default: null },
    // Loai hang khi phan loai tai kho (US-41)
    itemCategory: { type: String, enum: ITEM_CATEGORY, default: null },

    receiver: { type: receiverSchema, required: true },
    item: { type: itemSchema, required: true },
    flags: { type: flagsSchema, default: () => ({}) },

    serviceTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceType", required: true },
    serviceName: { type: String, required: true },

    zone: { type: String, enum: ZONE, required: true },
    // Khoang cach noi gui - noi nhan luc tao don (km, duong chim bay giua tam hai xa/phuong)
    distanceKm: { type: Number, default: null },
    chargeableWeight: { type: Number, required: true },
    // Bang gia da dung de tinh phi (doi chieu "phi khop bang gia dang hieu luc")
    priceTableId: { type: mongoose.Schema.Types.ObjectId, ref: "PriceTable", default: null },

    fee: { type: feeSchema, default: () => ({}) },
    cod: { type: codSchema, default: () => ({}) },

    status: { type: String, enum: ORDER_STATUS, default: "CREATED" },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },

    // So lan giao that bai (US-32, US-36); vuot so lan cho phep hoac nguoi nhan tu choi -> hoan hang
    deliveryAttempts: { type: Number, default: 0 },
    // Hoan hang (US-37): ly do hoan; luc tai xe tra hang cho shop (cho shop xac nhan -> RETURNED)
    returnReason: { type: String, default: null },
    returnHandedAt: { type: Date, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Hang cho chua phan cong (US-25): ly do phan cong tu dong khong gan duoc (khong co ca, tuyen da day)
    unassignedReason: { type: String, default: null },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement", default: null },
  },
  { timestamps: true },
);

orderSchema.index({ trackingCode: 1 }, { unique: true });
orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
// Nhan vien hub xem don cho duyet cua diem minh (US-18)
orderSchema.index({ pickupHubId: 1, status: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
