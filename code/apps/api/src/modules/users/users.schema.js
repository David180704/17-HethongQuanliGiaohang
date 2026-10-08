import bcrypt from "bcrypt";
import { ErrorCodes } from "../../core/errors.js";
import { ROLES, USER_STATUS, CUSTOMER_TYPE } from "../../constants/enums.js";

function assertRoleConsistency({ role, customerType, shopName, taxCode, hubId }) {
  if (role === "CUSTOMER") {
    if (!CUSTOMER_TYPE.includes(customerType)) {
      throw ErrorCodes.VALIDATION_ERROR("CUSTOMER phai co customerType INDIVIDUAL hoac BUSINESS");
    }
    if (customerType === "BUSINESS" && (!shopName || !taxCode)) {
      throw ErrorCodes.VALIDATION_ERROR("CUSTOMER loai BUSINESS phai co shopName va taxCode");
    }
  }
  if (role === "HUB_STAFF" && !hubId) {
    throw ErrorCodes.VALIDATION_ERROR("HUB_STAFF phai co hubId");
  }
}

export async function createUserSchema(body) {
  const { email, phone, password, fullName, role } = body;
  if (!email || !phone || !password || !fullName || !role) {
    throw ErrorCodes.VALIDATION_ERROR("Thieu email/phone/password/fullName/role");
  }
  if (!ROLES.includes(role)) throw ErrorCodes.VALIDATION_ERROR("role khong hop le");

  assertRoleConsistency(body);

  const passwordHash = await bcrypt.hash(password, 10);

  const sanitized = {
    email: email.toLowerCase(),
    phone,
    passwordHash,
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

export async function updateUserSchema(body) {
  const sanitized = {};

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) sanitized[field] = body[field];
  }

  if (sanitized.role && !ROLES.includes(sanitized.role)) {
    throw ErrorCodes.VALIDATION_ERROR("role khong hop le");
  }
  if (sanitized.status && !USER_STATUS.includes(sanitized.status)) {
    throw ErrorCodes.VALIDATION_ERROR("status khong hop le");
  }
  if (sanitized.email) sanitized.email = sanitized.email.toLowerCase();

  if (body.password) {
    sanitized.passwordHash = await bcrypt.hash(body.password, 10);
  }

  return sanitized;
}
