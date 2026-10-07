import mongoose from "mongoose";
import { ASSIGNMENT_TYPE, ASSIGNMENT_STATUS, ASSIGNMENT_METHOD } from "../constants/enums.js";

const assignmentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ASSIGNMENT_TYPE, required: true },
    shiftDate: { type: Date, required: true },
    status: { type: String, enum: ASSIGNMENT_STATUS, default: "ASSIGNED" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: Date.now },
    method: { type: String, enum: ASSIGNMENT_METHOD, required: true },
    // Bat buoc khi method = MANUAL va vuot nang luc.
    reason: { type: String, default: null },
  },
  { timestamps: true },
);

assignmentSchema.index({ shipperId: 1, shiftDate: 1, status: 1 });

export const Assignment = mongoose.model("Assignment", assignmentSchema);
