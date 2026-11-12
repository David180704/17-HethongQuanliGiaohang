import mongoose from "mongoose";
import { ASSIGNMENT_TYPE, ASSIGNMENT_STATUS, ASSIGNMENT_METHOD, PICKUP_FAIL_REASON, DELIVERY_FAIL_REASON } from "../constants/enums.js";

// Nguyen nhan that bai cua ca chieu lay (US-28) va chieu giao (US-32)
const FAIL_REASON = [...new Set([...PICKUP_FAIL_REASON, ...DELIVERY_FAIL_REASON])];

const assignmentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ASSIGNMENT_TYPE, required: true },
    shiftDate: { type: Date, required: true },
    // Ca lam viec ma phan cong tinh vao nang luc (US-25); null = phan cong tay ngoai ca
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
    status: { type: String, enum: ASSIGNMENT_STATUS, default: "ASSIGNED" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: Date.now },
    method: { type: String, enum: ASSIGNMENT_METHOD, required: true },
    // Bat buoc khi method = MANUAL (dieu chinh tay: nghi, doi ca, qua tai, don uu tien - US-25).
    reason: { type: String, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    // Ket qua cua tai xe (US-28 lay, US-32 giao, US-37 tra hang cho shop): thoi gian, toa do GPS; nguyen nhan khi that bai
    doneAt: { type: Date, default: null },
    location: { lat: Number, lng: Number },
    failReason: { type: String, enum: FAIL_REASON, default: null },
    failNote: { type: String, default: null },
  },
  { timestamps: true },
);

assignmentSchema.index({ shipperId: 1, shiftDate: 1, status: 1 });
// Tai cua tung nguoi trong mot ca (phan cong tu dong) va phan cong dang hieu luc cua mot don
assignmentSchema.index({ shiftId: 1, type: 1, status: 1 });
assignmentSchema.index({ orderId: 1, type: 1, status: 1 });

export const Assignment = mongoose.model("Assignment", assignmentSchema);
