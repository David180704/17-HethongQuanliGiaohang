import { POSITION_SOURCE } from "../constants/enums.js";

// Toa do ghi kem thao tac cua tai xe (lay hang, giao hang, tra hang, check-in): nguon vi tri (GPS that hay gia lap)
// va sai so GPS (m) do dien thoai bao. Don cu chi co lat, lng.
export const positionFields = {
  lat: Number,
  lng: Number,
  source: { type: String, enum: POSITION_SOURCE },
  accuracyM: { type: Number, min: 0 },
};
