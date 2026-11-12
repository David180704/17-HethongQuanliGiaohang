import mongoose from "mongoose";

// Ban nhap don het han sau 24 gio (MongoDB tu xoa qua TTL index, US-16)
export const DRAFT_TTL_SECONDS = 86400;

const orderDraftSchema = new mongoose.Schema({
  draftToken: { type: String, unique: true, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

orderDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: DRAFT_TTL_SECONDS });

export const OrderDraft = mongoose.model("OrderDraft", orderDraftSchema);
