import mongoose from "mongoose";
import { HUB_TYPE } from "../constants/enums.js";

const hubSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: HUB_TYPE, required: true },
    address: String,
    province: { type: String, required: true },
    district: { type: String, required: true },
    location: {
      lat: Number,
      lng: Number,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Hub = mongoose.model("Hub", hubSchema);
