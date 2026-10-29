// Chuyen du lieu form tao don / uoc tinh phi sang body API. Tach khoi file component
// de Fast Refresh cua Vite hoat dong (file component chi export component).

export const EMPTY_PARCEL = { weightGram: "", length: "", width: "", height: "", declaredValue: "", fragile: false, isVehicle: false };

/** Du lieu form -> body API (chuoi so -> Number; o bo trong -> 0 voi gia tri khai bao). */
export function toItemPayload(value) {
  return {
    weightGram: Number(value.weightGram),
    length: Number(value.length),
    width: Number(value.width),
    height: Number(value.height),
    declaredValue: value.declaredValue === "" ? 0 : Number(value.declaredValue),
  };
}

export function toFlagsPayload(value) {
  return { fragile: Boolean(value.fragile), isVehicle: Boolean(value.isVehicle) };
}
