require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { authenticate, requireAdmin } = require("./middleware/auth");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"]
}}}));
app.use(cors({ origin: false }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (req, res) => res.json({ status:"ok", application:"HostelDesk", timestamp:new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api", authenticate);
app.use("/api/resident", require("./routes/resident"));
app.use("/api/maintenance", require("./routes/maintenance"));
app.use("/api/admin", requireAdmin, require("./routes/admin"));

app.use("/api", (req, res) => res.status(404).json({ error:"API endpoint not found." }));
app.use((err, req, res, next) => {
  console.error("Request failed:", err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error:"The server could not complete this request. Check the server terminal for details." });
});

app.listen(PORT, () => console.log(`HostelDesk running at http://localhost:${PORT}`));
