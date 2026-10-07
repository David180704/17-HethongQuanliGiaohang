import mongoose from "mongoose";

const orderDraftSchema = new mongoose.Schema({
  draftToken: { type: String, unique: true, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

orderDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const OrderDraft = mongoose.model("OrderDraft", orderDraftSchema);
