import mongoose from "mongoose";
import { ROLES, USER_STATUS, CUSTOMER_TYPE } from "../constants/enums.js";

const bankAccountSchema = new mongoose.Schema(
  {
    bankName: String,
    accountNumber: String,
    accountName: String,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUS, default: "ACTIVE" },

    // Chi CUSTOMER
    customerType: { type: String, enum: CUSTOMER_TYPE },
    shopName: String,
    taxCode: String,

    // Chi HUB_STAFF
    hubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub" },

    // Chi SHIPPER
    routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Route" }],
    maxPickupPerShift: { type: Number, default: null },
    maxDeliveryPerShift: { type: Number, default: null },

    bankAccount: bankAccountSchema,
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
