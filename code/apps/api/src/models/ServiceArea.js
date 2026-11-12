import mongoose from "mongoose";
import { REGION } from "../constants/enums.js";

// Khu vuc phuc vu = mot xa/phuong (dia gioi 2 cap tu 01/07/2025: tinh -> xa/phuong, khong con
// quan/huyen). Ten luu dung ten chuan trong danh muc hanh chinh (modules/adminUnits).
const serviceAreaSchema = new mongoose.Schema(
  {
    province: { type: String, required: true },
    ward: { type: String, required: true },
    region: { type: String, enum: REGION, required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
  },
  { timestamps: true },
);

// Mot xa/phuong chi thuoc ve mot tuyen duy nhat.
serviceAreaSchema.index({ province: 1, ward: 1 }, { unique: true });

export const ServiceArea = mongoose.model("ServiceArea", serviceAreaSchema);
