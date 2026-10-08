import mongoose from "mongoose";
import { SERVICE_TYPE_CODE } from "../constants/enums.js";

const serviceTypeSchema = new mongoose.Schema(
  {
    code: { type: String, enum: SERVICE_TYPE_CODE, unique: true, required: true },
    name: { type: String, required: true },
    surchargeRate: { type: Number, required: true, min: 0 },
    estimatedDays: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ServiceType = mongoose.model("ServiceType", serviceTypeSchema);
