// schemaFn: (body) => sanitizedBody, nem ErrorCodes.VALIDATION_ERROR() khi sai.
// Khong dung thu vien schema rieng (zod/joi) vi stack hien tai chua can,
// giu toi gian cho tung resource tu khai bao luat cua minh.
export function validateBody(schemaFn) {
  return async (req, res, next) => {
    try {
      req.body = await schemaFn(req.body || {});
      next();
    } catch (err) {
      next(err);
    }
  };
}
