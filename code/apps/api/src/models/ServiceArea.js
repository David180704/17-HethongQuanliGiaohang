import mongoose from "mongoose";
import { REGION } from "../constants/enums.js";

const serviceAreaSchema = new mongoose.Schema(
  {
    province: { type: String, required: true },
    district: { type: String, required: true },
    wards: { type: [String], default: [] },
    region: { type: String, enum: REGION, required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
  },
  { timestamps: true },
);

// Mot quan/huyen chi thuoc ve mot tuyen duy nhat.
serviceAreaSchema.index({ province: 1, district: 1 }, { unique: true });

export const ServiceArea = mongoose.model("ServiceArea", serviceAreaSchema);
