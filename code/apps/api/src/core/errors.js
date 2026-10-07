export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Bang ma loi tap trung. HOA, gach duoi. Them ma moi vao day, khong rai trong service.
export const ErrorCodes = {
  VALIDATION_ERROR: (message = "Du lieu khong hop le") => new AppError("VALIDATION_ERROR", message, 400),
  UNAUTHORIZED: (message = "Chua dang nhap hoac token khong hop le") => new AppError("UNAUTHORIZED", message, 401),
  FORBIDDEN: (message = "Khong co quyen thuc hien hanh dong nay") => new AppError("FORBIDDEN", message, 403),
  NOT_FOUND: (message = "Khong tim thay du lieu") => new AppError("NOT_FOUND", message, 404),
  CONFLICT: (message = "Du lieu bi trung hoac xung dot") => new AppError("CONFLICT", message, 409),

  INVALID_CREDENTIALS: (message = "Email/so dien thoai hoac mat khau khong dung") =>
    new AppError("INVALID_CREDENTIALS", message, 401),
  ACCOUNT_LOCKED: (message = "Tai khoan dang bi khoa, vui long thu lai sau") =>
    new AppError("ACCOUNT_LOCKED", message, 423),
  ACCOUNT_NOT_ACTIVE: (message = "Tai khoan chua duoc kich hoat") => new AppError("ACCOUNT_NOT_ACTIVE", message, 403),
  ALREADY_AUTHENTICATED: (message = "Ban da dang nhap roi") => new AppError("ALREADY_AUTHENTICATED", message, 403),

  EMAIL_ALREADY_EXISTS: (message = "Email da duoc su dung") => new AppError("EMAIL_ALREADY_EXISTS", message, 409),
  PHONE_ALREADY_EXISTS: (message = "So dien thoai da duoc su dung") =>
    new AppError("PHONE_ALREADY_EXISTS", message, 409),
};

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: err.message },
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: "DUPLICATE_KEY", message: "Du lieu bi trung voi ban ghi da ton tai" },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Da co loi xay ra, vui long thu lai sau" },
  });
}
