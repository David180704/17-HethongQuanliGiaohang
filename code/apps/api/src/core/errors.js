export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Bang ma loi tap trung. HOA, gach duoi. Them ma moi vao day, khong rai trong service.
export const ErrorCodes = {
  VALIDATION_ERROR: (message = "Dữ liệu không hợp lệ") => new AppError("VALIDATION_ERROR", message, 400),
  UNAUTHORIZED: (message = "Chưa đăng nhập hoặc token không hợp lệ") => new AppError("UNAUTHORIZED", message, 401),
  FORBIDDEN: (message = "Không có quyền thực hiện hành động này") => new AppError("FORBIDDEN", message, 403),
  NOT_FOUND: (message = "Không tìm thấy dữ liệu") => new AppError("NOT_FOUND", message, 404),
  CONFLICT: (message = "Dữ liệu bị trùng hoặc xung đột") => new AppError("CONFLICT", message, 409),

  INVALID_CREDENTIALS: (message = "Email/số điện thoại hoặc mật khẩu không đúng") =>
    new AppError("INVALID_CREDENTIALS", message, 401),
  ACCOUNT_LOCKED: (message = "Tài khoản đang bị khóa, vui lòng thử lại sau") =>
    new AppError("ACCOUNT_LOCKED", message, 423),
  ACCOUNT_NOT_ACTIVE: (message = "Tài khoản chưa được kích hoạt") => new AppError("ACCOUNT_NOT_ACTIVE", message, 403),
  ALREADY_AUTHENTICATED: (message = "Bạn đã đăng nhập rồi") => new AppError("ALREADY_AUTHENTICATED", message, 403),

  EMAIL_ALREADY_EXISTS: (message = "Email đã được sử dụng") => new AppError("EMAIL_ALREADY_EXISTS", message, 409),
  PHONE_ALREADY_EXISTS: (message = "Số điện thoại đã được sử dụng") =>
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
      error: { code: "DUPLICATE_KEY", message: "Dữ liệu bị trùng với bản ghi đã tồn tại" },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra, vui lòng thử lại sau" },
  });
}
