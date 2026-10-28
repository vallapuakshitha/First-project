const express = require("express");
const supabase = require("../supabase");
const { cleanString } = require("../utils/validation");
const router = express.Router();
const categories = ["Electrical","Plumbing","Furniture","Cleaning","Internet","Other"];
const priorities = ["normal","high","urgent"];

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("maintenance_requests")
      .select("id,category,description,priority,status,created_at,updated_at")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) return next(error);
    res.json({ requests: data });
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const category = cleanString(req.body.category);
    const description = cleanString(req.body.description);
    const priority = cleanString(req.body.priority);
    if (!categories.includes(category)) return res.status(400).json({ error: "Choose a valid issue category." });
    if (!priorities.includes(priority)) return res.status(400).json({ error: "Choose a valid priority." });
    if (description.length < 8 || description.length > 1000) return res.status(400).json({ error: "Description must contain 8 to 1000 characters." });
    const { data, error } = await supabase.from("maintenance_requests")
      .insert({ user_id: req.user.id, category, description, priority }).select("id,category,description,priority,status,created_at").single();
    if (error) return next(error);
    res.status(201).json({ request: data });
  } catch (error) { next(error); }
});
module.exports = router;
