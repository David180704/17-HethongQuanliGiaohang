import mongoose from "mongoose";

// Diem check-in (US-29): toa do + ban kinh; tai xe di qua (trong ban kinh) thi he thong tu ghi moc hanh trinh (US-30).
const checkinPointSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    radiusM: { type: Number, default: 150, min: 20, max: 2000 },
    hubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CheckinPoint = mongoose.model("CheckinPoint", checkinPointSchema);
