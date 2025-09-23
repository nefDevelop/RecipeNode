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

module.exports = {
  isAuthenticated,
  isAuthenticatedView,
  isAdmin,
};
