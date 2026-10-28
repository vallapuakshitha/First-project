const express = require("express");
const supabase = require("../supabase");
const router = express.Router();

router.get("/overview", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("allocations")
      .select("allocated_at,rooms(id,room_number,block,floor,capacity,room_type)")
      .eq("user_id", req.user.id).eq("status", "active").maybeSingle();
    if (error) return next(error);
    const room = data && data.rooms ? { ...data.rooms, allocated_at: data.allocated_at } : null;
    res.json({ allocation: room });
  } catch (error) { next(error); }
});
module.exports = router;
