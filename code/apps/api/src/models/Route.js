import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    hubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", required: true },
    maxPickupPerShift: { type: Number, required: true },
    maxDeliveryPerShift: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Route = mongoose.model("Route", routeSchema);
