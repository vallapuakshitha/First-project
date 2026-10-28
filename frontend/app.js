const API = "/api";
let token = sessionStorage.getItem("hosteldesk_token") || "";
let currentUser = null;
let roomsCache = [];
let residentsCache = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showMessage(target, text, type = "success") {
  const el = $(target);
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
}
function hideMessage(target) { $(target).classList.add("hidden"); }
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function dateText(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"});
}
function statusLabel(value) { return String(value || "pending").replaceAll("_", " "); }
function statusBadge(value) {
  const safe = escapeHtml(value || "pending");
  return `<span class="status ${safe}">${escapeHtml(statusLabel(value))}</span>`;
}
async function api(path, options = {}) {
  const headers = {"Content-Type":"application/json", ...(options.headers || {})};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, {...options, headers});
  let data;
  try { data = await response.json(); } catch { data = {error:"The server returned an unreadable response."}; }
  if (!response.ok) {
    if (response.status === 401 && token) logout(false);
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
function setAuthTab(mode) {
  $$(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#loginForm").classList.toggle("hidden", mode !== "login");
  $("#registerForm").classList.toggle("hidden", mode !== "register");
  hideMessage("#authMessage");
}
function logout(show = true) {
  token = "";
  currentUser = null;
  sessionStorage.removeItem("hosteldesk_token");
  $("#authView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
  $("#nav").classList.add("hidden");
  if (show) showMessage("#authMessage", "You have been signed out.", "success");
}
function renderStats(items) {
  $("#stats").innerHTML = items.map(item => `<div class="stat-card"><div><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></div><span class="stat-icon">${item.icon}</span></div>`).join("");
}
function emptyState(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
}
async function startApp() {
  try {
    const result = await api("/auth/me");
    currentUser = result.user;
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#nav").classList.remove("hidden");
    $("#welcomeText").textContent = `Hi, ${currentUser.name}`;
    const isAdmin = currentUser.role === "admin";
    $("#dashboardTitle").textContent = isAdmin ? "Admin dashboard" : "Your dashboard";
    $("#dashboardSubtitle").textContent = isAdmin ? "Manage room inventory, residents, and maintenance." : "Your room details and maintenance, all in one place.";
    $("#residentPanel").classList.toggle("hidden", isAdmin);
    $("#adminPanel").classList.toggle("hidden", !isAdmin);
    if (isAdmin) await loadAdmin();
    else await loadResident();
  } catch (error) {
    logout(false);
    showMessage("#authMessage", error.message, "error");
  }
}
async function loadResident() {
  hideMessage("#appMessage");
  const [overview, requests] = await Promise.all([api("/resident/overview"), api("/maintenance")]);
  const room = overview.allocation;
  renderStats([
    {label:"Room allocation", value:room ? "Allocated" : "Pending", icon:"⌂"},
    {label:"Requests submitted", value:requests.requests.length, icon:"＋"},
    {label:"Requests in progress", value:requests.requests.filter(r => r.status === "in_progress").length, icon:"↻"}
  ]);
  $("#myRoom").innerHTML = room ? `
    <div class="room-banner"><div><small>YOUR ROOM</small><strong>${escapeHtml(room.room_number)}</strong><small>${escapeHtml(room.block)} · Floor ${room.floor}</small></div><span class="room-number">⌂</span></div>
    <div class="room-meta"><div><small>Room type</small><b>${escapeHtml(room.room_type)}</b></div><div><small>Capacity</small><b>${room.capacity} beds</b></div><div><small>Allocated on</small><b>${dateText(room.allocated_at)}</b></div></div>` :
    emptyState("Room not allocated yet", "The hostel administrator will assign your room. You can still submit maintenance-related questions to the office.");
  $("#myRequests").innerHTML = requests.requests.length ? `<table><thead><tr><th>Issue</th><th>Priority</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${requests.requests.map(r => `<tr><td><strong>${escapeHtml(r.category)}</strong><br><span class="muted">${escapeHtml(r.description)}</span></td><td><span class="priority ${escapeHtml(r.priority)}">${escapeHtml(r.priority)}</span></td><td>${dateText(r.created_at)}</td><td>${statusBadge(r.status)}</td></tr>`).join("")}</tbody></table>` : emptyState("No requests yet", "Your maintenance requests will appear here.");
}
async function loadAdmin() {
  hideMessage("#appMessage");
  const [rooms, requests, residents] = await Promise.all([api("/admin/rooms"), api("/admin/maintenance"), api("/admin/residents")]);
  roomsCache = rooms.rooms;
  residentsCache = residents.residents;
  renderStats([
    {label:"Total rooms", value:rooms.rooms.length, icon:"⌂"},
    {label:"Available beds", value:rooms.rooms.reduce((sum,r) => sum + r.available_beds, 0), icon:"✓"},
    {label:"Open maintenance", value:requests.requests.filter(r => !["resolved","cancelled"].includes(r.status)).length, icon:"＋"}
  ]);
  $("#residentSelect").innerHTML = `<option value="">Choose a resident</option>` + residents.residents.filter(r => !r.has_active_allocation).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} — ${escapeHtml(r.student_id)}</option>`).join("");
  $("#roomSelect").innerHTML = `<option value="">Choose an available room</option>` + rooms.rooms.filter(r => r.available_beds > 0).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.room_number)} (${r.available_beds} bed${r.available_beds === 1 ? "" : "s"} free)</option>`).join("");
  $("#roomsTable").innerHTML = rooms.rooms.length ? `<table><thead><tr><th>Room</th><th>Block / floor</th><th>Type</th><th>Capacity</th><th>Occupied</th><th>Available</th></tr></thead><tbody>${rooms.rooms.map(r => `<tr><td><strong>${escapeHtml(r.room_number)}</strong></td><td>${escapeHtml(r.block)} / ${r.floor}</td><td>${escapeHtml(r.room_type)}</td><td>${r.capacity}</td><td>${r.occupied_beds}</td><td>${r.available_beds}</td></tr>`).join("")}</tbody></table>` : emptyState("No rooms added", "Add the first room using the form above.");
  $("#allRequests").innerHTML = requests.requests.length ? `<table><thead><tr><th>Resident / issue</th><th>Priority</th><th>Submitted</th><th>Status</th><th>Update status</th></tr></thead><tbody>${requests.requests.map(r => `<tr><td><strong>${escapeHtml(r.resident_name)}</strong><br>${escapeHtml(r.category)} — ${escapeHtml(r.description)}</td><td><span class="priority ${escapeHtml(r.priority)}">${escapeHtml(r.priority)}</span></td><td>${dateText(r.created_at)}</td><td>${statusBadge(r.status)}</td><td><select class="action-select request-status" data-id="${escapeHtml(r.id)}" aria-label="Change request status"><option value="pending" ${r.status==="pending"?"selected":""}>Pending</option><option value="in_progress" ${r.status==="in_progress"?"selected":""}>In progress</option><option value="resolved" ${r.status==="resolved"?"selected":""}>Resolved</option><option value="cancelled" ${r.status==="cancelled"?"selected":""}>Cancelled</option></select></td></tr>`).join("")}</tbody></table>` : emptyState("No maintenance requests", "New resident requests will appear here.");
  $("#residentsTable").innerHTML = residents.residents.length ? `<table><thead><tr><th>Name</th><th>Student ID</th><th>Email</th><th>Room</th><th>Role</th></tr></thead><tbody>${residents.residents.map(r => `<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.student_id)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.room_number || "Not allocated")}</td><td>${escapeHtml(r.role)}</td></tr>`).join("")}</tbody></table>` : emptyState("No residents yet", "Registered accounts will appear here.");
}
$$(".tab").forEach(tab => tab.addEventListener("click", () => setAuthTab(tab.dataset.auth)));
$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault(); hideMessage("#authMessage");
  const form = new FormData(event.currentTarget);
  try {
    const result = await api("/auth/login", {method:"POST", body:JSON.stringify({email:form.get("email"), password:form.get("password")})});
    token = result.token; sessionStorage.setItem("hosteldesk_token", token);
    await startApp();
  } catch (error) { showMessage("#authMessage", error.message, "error"); }
});
$("#registerForm").addEventListener("submit", async event => {
  event.preventDefault(); hideMessage("#authMessage");
  const form = new FormData(event.currentTarget);
  try {
    await api("/auth/register", {method:"POST", body:JSON.stringify({name:form.get("name"),email:form.get("email"),student_id:form.get("student_id"),password:form.get("password")})});
    event.currentTarget.reset(); setAuthTab("login");
    showMessage("#authMessage", "Account created. Sign in to continue.", "success");
  } catch (error) { showMessage("#authMessage", error.message, "error"); }
});
$("#logoutBtn").addEventListener("click", () => logout());
$("#requestForm").addEventListener("submit", async event => {
  event.preventDefault(); hideMessage("#appMessage");
  const form = new FormData(event.currentTarget);
  try {
    await api("/maintenance", {method:"POST",body:JSON.stringify({category:form.get("category"),priority:form.get("priority"),description:form.get("description")})});
    event.currentTarget.reset(); showMessage("#appMessage","Maintenance request submitted successfully.","success"); await loadResident();
  } catch(error) { showMessage("#appMessage",error.message,"error"); }
});
$("#roomForm").addEventListener("submit", async event => {
  event.preventDefault(); hideMessage("#appMessage");
  const form = new FormData(event.currentTarget);
  try {
    await api("/admin/rooms", {method:"POST",body:JSON.stringify({room_number:form.get("room_number"),block:form.get("block"),floor:Number(form.get("floor")),capacity:Number(form.get("capacity")),room_type:form.get("room_type")})});
    event.currentTarget.reset(); showMessage("#appMessage","Room added to inventory.","success"); await loadAdmin();
  } catch(error) { showMessage("#appMessage",error.message,"error"); }
});
$("#allocationForm").addEventListener("submit", async event => {
  event.preventDefault(); hideMessage("#appMessage");
  const form = new FormData(event.currentTarget);
  try {
    await api("/admin/allocations", {method:"POST",body:JSON.stringify({user_id:form.get("user_id"),room_id:form.get("room_id")})});
    event.currentTarget.reset(); showMessage("#appMessage","Room allocated successfully.","success"); await loadAdmin();
  } catch(error) { showMessage("#appMessage",error.message,"error"); }
});
$("#allRequests").addEventListener("change", async event => {
  if (!event.target.matches(".request-status")) return;
  const select = event.target;
  try {
    await api(`/admin/maintenance/${encodeURIComponent(select.dataset.id)}`,{method:"PATCH",body:JSON.stringify({status:select.value})});
    showMessage("#appMessage","Request status updated.","success"); await loadAdmin();
  } catch(error) { showMessage("#appMessage",error.message,"error"); }
});
$("#refreshResident").addEventListener("click", async () => { try { await loadResident(); } catch(e) { showMessage("#appMessage",e.message,"error"); }});
$("#refreshAdmin").addEventListener("click", async () => { try { await loadAdmin(); } catch(e) { showMessage("#appMessage",e.message,"error"); }});

if (token) startApp();
