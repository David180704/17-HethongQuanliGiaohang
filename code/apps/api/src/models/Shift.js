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
    // Khoa phan cong (US-25): moi lan gan don vao ca thi tang trong transaction -> hai transaction cung
    // gan vao mot ca se xung dot ghi, mot ben chay lai va thay tai moi (khong vuot nang luc).
    assignSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Tra ca theo ngay + tuyen (danh sach ca, phan cong US-25); ma ca la duy nhat (tuyen-ngay-gio bat dau)
shiftSchema.index({ shiftDate: 1, routeId: 1 });
shiftSchema.index({ code: 1 }, { unique: true });

export const Shift = mongoose.model("Shift", shiftSchema);
