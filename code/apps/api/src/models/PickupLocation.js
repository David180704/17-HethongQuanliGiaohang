import mongoose from "mongoose";

const pickupLocationSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    address: { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
    serviceAreaId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceArea", required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

pickupLocationSchema.index({ customerId: 1, isActive: 1 });

export const PickupLocation = mongoose.model("PickupLocation", pickupLocationSchema);
