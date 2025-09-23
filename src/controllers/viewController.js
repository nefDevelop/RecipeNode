const getLoginPage = (req, res) => {
  res.render("login", { title: "Login" });
};

const getRegisterPage = (req, res) => {
  res.render("register", { title: "Register" });
};

module.exports = {
  getLoginPage,
  getRegisterPage,
};
