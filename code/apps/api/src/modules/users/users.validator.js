import { ErrorCodes } from "../../core/errors.js";
import { ROLES, USER_STATUS, CUSTOMER_TYPE } from "../../constants/enums.js";

// Strategy kiem tra du lieu cho danh muc nguoi dung. Ham thuan (khong DB, khong
// bam mat khau) - viec bam mat khau thuoc UserService (Single Responsibility).

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

function assertRoleConsistency({ role, customerType, shopName, taxCode, hubId }) {
  if (role === "CUSTOMER") {
    if (!CUSTOMER_TYPE.includes(customerType)) {
      throw ErrorCodes.VALIDATION_ERROR("CUSTOMER phải có customerType INDIVIDUAL hoặc BUSINESS");
    }
    if (customerType === "BUSINESS" && (!shopName || !taxCode)) {
      throw ErrorCodes.VALIDATION_ERROR("CUSTOMER loại BUSINESS phải có shopName và taxCode");
    }
  }
  if (role === "HUB_STAFF" && !hubId) {
    throw ErrorCodes.VALIDATION_ERROR("HUB_STAFF phải có hubId");
  }
}

const UPDATABLE_FIELDS = [
  "fullName",
  "role",
  "status",
  "customerType",
  "shopName",
  "taxCode",
  "hubId",
  "routeIds",
  "maxPickupPerShift",
  "maxDeliveryPerShift",
  "bankAccount",
  "email",
  "phone",
];

export const userValidator = {
  create(body) {
    const { email, phone, password, fullName, role } = body;
    if (![email, phone, password, fullName, role].every(isFilled)) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu email/phone/password/fullName/role");
    }
    if (!ROLES.includes(role)) throw ErrorCodes.VALIDATION_ERROR("role không hợp lệ");
    assertRoleConsistency(body);

    const sanitized = {
      email: email.toLowerCase(),
      phone,
      password, // UserService doi thanh passwordHash truoc khi luu
      fullName,
      role,
      status: USER_STATUS.includes(body.status) ? body.status : "ACTIVE",
    };

    if (role === "CUSTOMER") {
      sanitized.customerType = body.customerType;
      if (body.customerType === "BUSINESS") {
        sanitized.shopName = body.shopName;
        sanitized.taxCode = body.taxCode;
      }
    }
    if (role === "HUB_STAFF") sanitized.hubId = body.hubId;
    if (role === "SHIPPER") {
      if (body.routeIds) sanitized.routeIds = body.routeIds;
      if (body.maxPickupPerShift != null) sanitized.maxPickupPerShift = body.maxPickupPerShift;
      if (body.maxDeliveryPerShift != null) sanitized.maxDeliveryPerShift = body.maxDeliveryPerShift;
    }
    if (body.bankAccount) sanitized.bankAccount = body.bankAccount;

    return sanitized;
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) sanitized[field] = body[field];
    }
    if (sanitized.role && !ROLES.includes(sanitized.role)) {
      throw ErrorCodes.VALIDATION_ERROR("role không hợp lệ");
    }
    if (sanitized.status && !USER_STATUS.includes(sanitized.status)) {
      throw ErrorCodes.VALIDATION_ERROR("status không hợp lệ");
    }
    if (typeof sanitized.email === "string") sanitized.email = sanitized.email.toLowerCase();
    if (isFilled(body.password)) sanitized.password = body.password;
    return sanitized;
  },
};
