// Simple middleware that passes through requests
// Replaced multer since it was only used with .none() (no file parsing)
// Express already handles URL-encoded and JSON bodies by default
export const multerMiddleware = (req, res, next) => {
  next();
};