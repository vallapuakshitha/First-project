const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase.from("users")
      .select("id,name,email,student_id,role,is_active").eq("id", payload.sub).maybeSingle();
    if (error || !user || !user.is_active) return res.status(401).json({ error: "Your session is invalid or your account is inactive." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
  next();
}
module.exports = { authenticate, requireAdmin };
