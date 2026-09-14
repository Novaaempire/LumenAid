// Express 4 doesn't forward rejected promises to the error handler on its
// own -- wrap every async route so a thrown/rejected error actually reaches
// `next(err)` instead of hanging the request.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
