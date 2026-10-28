const express = require("express");
const supabase = require("../supabase");
const { cleanString, validUuid } = require("../utils/validation");
const router = express.Router();

router.get("/rooms", async (req, res, next) => {
  try {
    const { data: rooms, error } = await supabase.from("rooms")
      .select("id,room_number,block,floor,capacity,room_type,is_active,created_at").order("block").order("room_number");
    if (error) return next(error);
    const { data: allocations, error: allocError } = await supabase.from("allocations").select("room_id").eq("status","active");
    if (allocError) return next(allocError);
    const counts = {};
    (allocations || []).forEach(a => { counts[a.room_id] = (counts[a.room_id] || 0) + 1; });
    res.json({ rooms: (rooms || []).map(r => {
      const occupied_beds = counts[r.id] || 0;
      return { ...r, occupied_beds, available_beds: r.is_active ? Math.max(0, r.capacity - occupied_beds) : 0 };
    }) });
  } catch (error) { next(error); }
});
router.post("/rooms", async (req, res, next) => {
  try {
    const room_number = cleanString(req.body.room_number);
    const block = cleanString(req.body.block);
    const room_type = cleanString(req.body.room_type);
    const floor = Number(req.body.floor);
    const capacity = Number(req.body.capacity);
    if (!room_number || room_number.length > 20 || !block || block.length > 30) return res.status(400).json({ error: "Enter a valid room number and block." });
    if (!Number.isInteger(floor) || floor < 0 || floor > 100) return res.status(400).json({ error: "Floor must be a whole number from 0 to 100." });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 12) return res.status(400).json({ error: "Capacity must be between 1 and 12." });
    if (!["Shared","Single","Accessible"].includes(room_type)) return res.status(400).json({ error: "Choose a valid room type." });
    const { data, error } = await supabase.from("rooms").insert({ room_number, block, floor, capacity, room_type })
      .select("id,room_number,block,floor,capacity,room_type").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "That room number already exists in this block." });
      return next(error);
    }
    res.status(201).json({ room: data });
  } catch (error) { next(error); }
});
router.get("/residents", async (req, res, next) => {
  try {
    const { data: residents, error } = await supabase.from("users")
      .select("id,name,email,student_id,role,is_active").order("name");
    if (error) return next(error);
    const { data: allocations, error: allocError } = await supabase.from("allocations")
      .select("user_id,rooms(room_number)").eq("status","active");
    if (allocError) return next(allocError);
    const active = {};
    (allocations || []).forEach(a => { active[a.user_id] = a.rooms ? a.rooms.room_number : null; });
    res.json({ residents: (residents || []).map(u => ({ id:u.id,name:u.name,email:u.email,student_id:u.student_id,role:u.role,is_active:u.is_active,room_number:active[u.id] || null,has_active_allocation:Boolean(active[u.id]) })) });
  } catch (error) { next(error); }
});
router.post("/allocations", async (req, res, next) => {
  try {
    const user_id = req.body.user_id;
    const room_id = req.body.room_id;
    if (!validUuid(user_id) || !validUuid(room_id)) return res.status(400).json({ error: "Choose a valid resident and room." });
    const { data: resident, error: residentError } = await supabase.from("users").select("id,role,is_active").eq("id",user_id).maybeSingle();
    if (residentError) return next(residentError);
    if (!resident || resident.role !== "resident" || !resident.is_active) return res.status(400).json({ error: "Choose an active resident account." });
    const { data: room, error: roomError } = await supabase.from("rooms").select("id,capacity,is_active").eq("id",room_id).maybeSingle();
    if (roomError) return next(roomError);
    if (!room || !room.is_active) return res.status(400).json({ error: "Choose an active room." });
    const { data: existing, error: existingError } = await supabase.from("allocations").select("id").eq("user_id",user_id).eq("status","active").maybeSingle();
    if (existingError) return next(existingError);
    if (existing) return res.status(409).json({ error: "This resident already has an active room allocation." });
    // The database function locks the room row and checks capacity to prevent over-allocation.
    const { data, error } = await supabase.rpc("allocate_hostel_room", { p_user_id:user_id, p_room_id:room_id });
    if (error) {
      if (error.message && /capacity|already has|inactive/i.test(error.message)) return res.status(409).json({ error: error.message });
      return next(error);
    }
    res.status(201).json({ allocation_id: data, message: "Room allocated successfully." });
  } catch (error) { next(error); }
});
router.get("/maintenance", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("maintenance_requests")
      .select("id,user_id,category,description,priority,status,created_at,updated_at,users(name,student_id)")
      .order("created_at", { ascending:false });
    if (error) return next(error);
    res.json({ requests: (data || []).map(r => ({ id:r.id,user_id:r.user_id,resident_name:r.users ? r.users.name : "Resident",student_id:r.users ? r.users.student_id : "",category:r.category,description:r.description,priority:r.priority,status:r.status,created_at:r.created_at,updated_at:r.updated_at })) });
  } catch (error) { next(error); }
});
router.patch("/maintenance/:id", async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: "Invalid request ID." });
    const status = cleanString(req.body.status);
    if (!["pending","in_progress","resolved","cancelled"].includes(status)) return res.status(400).json({ error: "Choose a valid status." });
    const { data, error } = await supabase.from("maintenance_requests").update({status})
      .eq("id",req.params.id).select("id,status,updated_at").maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: "Maintenance request not found." });
    res.json({ request:data });
  } catch (error) { next(error); }
});
module.exports = router;
