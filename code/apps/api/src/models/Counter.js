import mongoose from "mongoose";

// Bo dem tang dan dung trong transaction (US-18): _id = ten bo dem, vd "trackingCode".
// Collection ky thuat, KHONG thuoc 12 collection nghiep vu nen khong export qua
// models/index.js (file cau truc mongosh chi gom collection nghiep vu).
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true },
  },
  { versionKey: false },
);

export const Counter = mongoose.model("Counter", counterSchema);
