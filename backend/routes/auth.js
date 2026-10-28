const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const { cleanString, isEmail } = require("../utils/validation");

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many sign-in attempts. Try again in 15 minutes." } });

function makeToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "8h", issuer: "hosteldesk" });
}
router.post("/register", async (req, res, next) => {
  try {
    const name = cleanString(req.body.name);
    const email = cleanString(req.body.email).toLowerCase();
    const student_id = cleanString(req.body.student_id).toUpperCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Name must contain 2 to 80 characters." });
    if (!isEmail(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (student_id.length < 3 || student_id.length > 30) return res.status(400).json({ error: "Student ID must contain 3 to 30 characters." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must contain 8 to 72 characters." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from("users").insert({ name, email, student_id, password_hash, role: "resident" })
      .select("id").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "That email or student ID is already registered." });
      return next(error);
    }
    return res.status(201).json({ message: "Account created. You can now sign in.", user_id: data.id });
  } catch (error) { next(error); }
});
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const email = cleanString(req.body.email).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!isEmail(email) || !password) return res.status(400).json({ error: "Enter your email and password." });
    const { data: user, error } = await supabase.from("users")
      .select("id,name,email,student_id,role,is_active,password_hash").eq("email", email).maybeSingle();
    if (error) return next(error);
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const token = makeToken(user);
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, student_id: user.student_id, role: user.role } });
  } catch (error) { next(error); }
});
const { authenticate } = require("../middleware/auth");
router.get("/me", authenticate, (req, res) => {
  res.json({ user: { id:req.user.id, name:req.user.name, email:req.user.email, student_id:req.user.student_id, role:req.user.role } });
});
module.exports = router;
