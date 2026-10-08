import mongoose from "mongoose";
import { ZONE } from "../constants/enums.js";

const weightTierSchema = new mongoose.Schema(
  {
    fromGram: { type: Number, required: true, min: 0 },
    toGram: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, required: true, min: 0 },
    pricePer500g: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const priceTableSchema = new mongoose.Schema(
  {
    serviceTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceType", required: true },
    zone: { type: String, enum: ZONE, required: true },
    weightTiers: { type: [weightTierSchema], required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

priceTableSchema.index({ serviceTypeId: 1, zone: 1, effectiveFrom: 1 });

export const PriceTable = mongoose.model("PriceTable", priceTableSchema);
