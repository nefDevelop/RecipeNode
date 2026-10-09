const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized. Please log in to perform this action." });
};

const isAuthenticatedView = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/login");
};

const isAdmin = (req, res, next) => {
  if (req.session.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Forbidden. Admin access required." });
};

const isAdminView = (req, res, next) => {
  if (req.session && req.session.role === "admin") {
    return next();
  }
  if (req.session && req.session.userId) {
    return res.status(403).send("Acceso denegado. Se requiere rol de administrador.");
  }
  res.redirect("/login");
};

module.exports = {
  isAuthenticated,
  isAuthenticatedView,
  isAdmin,
  isAdminView,
};
