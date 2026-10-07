import mongoose from "mongoose";
import { ROLES } from "../constants/enums.js";

const roleSchema = new mongoose.Schema(
  {
    code: { type: String, enum: ROLES, unique: true, required: true },
    name: { type: String, required: true },
    permissions: { type: [String], default: [] },
    inheritsFrom: { type: String, enum: ROLES, default: null },
  },
  { timestamps: true },
);

export const Role = mongoose.model("Role", roleSchema);
