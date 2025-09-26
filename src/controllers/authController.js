const db = require("../config/database");
const bcrypt = require("bcrypt");

// --- Database Promise Wrappers ---
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

const register = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    const result = await dbRun("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash]);

    res.status(201).json({ message: "User registered successfully.", userId: result.lastID });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "Username already exists." });
    }
    console.error("Error registering user:", error);
    return res.status(500).json({ error: "Error registering user." });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    const user = await dbGet("SELECT * FROM users WHERE username = ?", [username]);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const result = await bcrypt.compare(password, user.password);

    if (result) {
      // Passwords match. Set up the session.
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      res.status(200).json({ message: "Login successful.", user: { id: user.id, username: user.username, role: user.role } });
    } else {
      // Passwords don't match
      res.status(401).json({ error: "Invalid credentials." });
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out, please try again." });
    }
    res.redirect("/");
  });
};

module.exports = { register, login, logout };
