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
  WRONG_APP: (message = "Tài khoản này không dùng được ứng dụng này") => new AppError("WRONG_APP", message, 403),

  EMAIL_ALREADY_EXISTS: (message = "Email đã được sử dụng") => new AppError("EMAIL_ALREADY_EXISTS", message, 409),
  PHONE_ALREADY_EXISTS: (message = "Số điện thoại đã được sử dụng") =>
    new AppError("PHONE_ALREADY_EXISTS", message, 409),

  // Quan/huyen chua co trong serviceAreas: diem tap ket, dia diem lay hang (US-14, US-15)
  OUT_OF_SERVICE_AREA: (message = "Địa chỉ nằm ngoài vùng phục vụ") =>
    new AppError("OUT_OF_SERVICE_AREA", message, 422),
  PICKUP_LOCATION_LIMIT: (message = "Mỗi khách hàng lưu tối đa 10 địa điểm lấy hàng — xóa bớt địa điểm cũ trước") =>
    new AppError("PICKUP_LOCATION_LIMIT", message, 409),

  // Tinh phi / tao don (US-16 -> US-19)
  PRICE_NOT_AVAILABLE: (message = "Chưa có bảng giá áp dụng cho tuyến gửi này") =>
    new AppError("PRICE_NOT_AVAILABLE", message, 422),
  COD_LESS_THAN_FEE: (message = "Tiền thu hộ nhỏ hơn phí vận chuyển, không khấu trừ được") =>
    new AppError("COD_LESS_THAN_FEE", message, 422),
  // Loai dich vu khong ap dung cho cap noi gui - noi nhan (giao nhanh chi trong cung tinh/thanh)
  SERVICE_NOT_AVAILABLE: (message = "Loại dịch vụ này không áp dụng cho tuyến gửi này") =>
    new AppError("SERVICE_NOT_AVAILABLE", message, 422),

  // API cong khai bi goi qua nhanh (US-22: tra cuu 20 lan/phut moi IP)
  TOO_MANY_REQUESTS: (message = "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút") =>
    new AppError("TOO_MANY_REQUESTS", message, 429),
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

  // Ma dinh danh sai dinh dang (vd GET /users/abc) -> 400 thay vi loi 500.
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Mã định danh không hợp lệ" },
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
