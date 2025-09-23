const db = require("../config/database");
const bcrypt = require("bcrypt");

const register = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const saltRounds = 10;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ error: "Error registering user." });
    }

    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    stmt.run(username, hash, function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({ error: "Username already exists." });
        }
        console.error("Error inserting user:", err);
        return res.status(500).json({ error: "Error registering user." });
      }
      res.status(201).json({ message: "User registered successfully.", userId: this.lastID });
    });
    stmt.finalize();
  });
};

const login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.error("Error finding user:", err);
      return res.status(500).json({ error: "Internal server error." });
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error("Error comparing passwords:", err);
        return res.status(500).json({ error: "Internal server error." });
      }
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
    });
  });
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
