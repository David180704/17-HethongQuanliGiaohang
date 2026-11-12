import { ErrorCodes } from "../../core/errors.js";
import { checkAddress } from "../adminUnits/adminUnits.js";

/**
 * Xac dinh khu vuc phuc vu tu dia chi go tay (tinh + xa/phuong), dung chung cho dia diem lay
 * hang, nguoi nhan, uoc tinh phi, mo diem tap ket:
 *   1. tinh va xa/phuong phai co that va xa/phuong thuoc dung tinh (danh muc hanh chinh) -> 400;
 *   2. xa/phuong phai dang duoc phuc vu -> 422 OUT_OF_SERVICE_AREA.
 * @param {(place: {province: string, ward: string}) => string} notServed thong bao khi chua phuc vu
 */
export async function locateArea(serviceAreaRepository, { province, ward }, notServed, { session } = {}) {
  const checked = checkAddress(province, ward);
  if (!checked.ok) throw ErrorCodes.VALIDATION_ERROR(checked.message);
  const area = await serviceAreaRepository.findByLocation(checked.province, checked.ward, { session });
  if (!area) throw ErrorCodes.OUT_OF_SERVICE_AREA(notServed(checked));
  return area;
}
