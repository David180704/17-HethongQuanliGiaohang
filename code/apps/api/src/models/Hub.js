import mongoose from "mongoose";
import { HUB_TYPE } from "../constants/enums.js";

const hubSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: HUB_TYPE, required: true },
    // Buu cuc (POST_OFFICE, cap quan/huyen) truc thuoc mot HUB (diem tap ket cap
    // tinh/vung); HUB khong co cap tren. HubService kiem tra, schema de null duoc
    // vi seed tao hub truoc roi moi noi buu cuc.
    parentHubId: { type: mongoose.Schema.Types.ObjectId, ref: "Hub", default: null },
    address: String,
    province: { type: String, required: true },
    district: { type: String, required: true },
    // Khu vuc phuc vu cua quan/huyen dat diem - HubService tu xac dinh tu
    // province + district (US-14). Seed gan sau khi tao serviceAreas.
    serviceAreaId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceArea", default: null },
    location: {
      lat: Number,
      lng: Number,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Hub = mongoose.model("Hub", hubSchema);
