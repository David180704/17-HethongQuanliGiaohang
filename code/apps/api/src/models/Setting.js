import mongoose from "mongoose";

// Cau hinh van hanh cua he thong (US-24: nang luc mac dinh; US-36 sau nay: so lan giao toi da). _id = ten cau hinh,
// vd "capacity". Collection KY THUAT nhu Counter: khong export qua models/index.js (giu dung 12 collection nghiep vu).
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    maxPickupPerShift: { type: Number, min: 1 },
    maxDeliveryPerShift: { type: Number, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

export const Setting = mongoose.model("Setting", settingSchema);
