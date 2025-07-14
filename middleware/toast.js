/**
 * Middleware to handle toast notifications across redirects
 * This makes toast messages stored in the session available to views
 */
export const toastMiddleware = (req, res, next) => {
  if (req.session && req.session.toast) {
    res.locals.toast = req.session.toast;
    delete req.session.toast;
  }
  next();
};
