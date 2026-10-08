export function ok(res, data, meta, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function created(res, data) {
  return ok(res, data, undefined, 201);
}

// Boc handler async de loi duoc chuyen vao errorHandler tap trung thay vi
// phai try/catch lap lai trong tung router.
export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}
