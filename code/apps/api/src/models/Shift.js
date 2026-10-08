import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
    shipperIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    shiftDate: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Shift = mongoose.model("Shift", shiftSchema);
