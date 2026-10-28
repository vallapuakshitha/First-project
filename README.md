# HOSTEL ROOM ALLOCATION AND MAINTAINANCE REQUEST PORTAL

A beginner-friendly full-stack college project for managing hostel rooms, resident allocations, and maintenance requests. The interface uses HTML, CSS, and vanilla JavaScript; the server uses Node.js and Express; persistent data is stored in Supabase PostgreSQL.

## 1. Problem statement

Hostel room assignments and repair complaints are often tracked using paper registers or scattered messages. This portal keeps room capacity, resident allocations, and maintenance request statuses in one place.

## 2. Objectives

- Let residents register and securely sign in.
- Let residents view their room allocation and submit maintenance requests.
- Let administrators add rooms and allocate available beds.
- Let administrators review residents and update maintenance status.
- Store records in PostgreSQL so data persists between visits.

## 3. Users and permissions

- **Resident:** can view their own allocation and maintenance requests, and create a request.
- **Administrator:** can manage room inventory, allocate rooms, see the resident directory, and update all maintenance requests.

New registrations always receive the `resident` role. To make an account an administrator, register it first, then run the administrator promotion SQL shown below in the Supabase SQL Editor. Do not add an admin role selector to public registration.

## 4. Features

- Responsive sign-in and resident registration.
- Password hashing with bcrypt.
- JWT authentication; private API routes require a valid token.
- Room inventory with block, floor, capacity, and room type.
- Bed occupancy and availability calculation.
- Database function that locks a room row and prevents over-allocation.
- One active allocation per resident.
- Maintenance request categories, priorities, and statuses.
- Admin resident directory and request status management.
- Server-side input validation, Helmet security headers, and login rate limiting.
- Supabase service key is used only by the backend.

## 5. Technology stack

- HTML5, CSS3, Vanilla JavaScript
- Node.js LTS and Express.js
- Supabase PostgreSQL
- Git and GitHub
- npm packages: `@supabase/supabase-js`, `bcryptjs`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `jsonwebtoken`

## 6. Folder structure

```text
hostel-room-allocation-and-maintainance-request-portal/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── resident.js
│   │   ├── maintenance.js
│   │   └── admin.js
│   ├── utils/validation.js
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/schema.sql
├── .gitignore
└── README.md
```

## 7. Prerequisites

Install these free tools:

- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS (npm is included): https://nodejs.org/
- Git: https://git-scm.com/downloads
- A Supabase account: https://supabase.com/

Check installations in a new VS Code terminal:

```bash
node --version
npm --version
git --version
```

Each command should print a version number.

## 8. Supabase database setup

1. Sign in to Supabase and create a new project.
2. Wait until the database is ready.
3. In the project dashboard, open **SQL Editor** and choose a new query.
4. Open `database/schema.sql` in VS Code, copy all its contents, paste into the SQL Editor, and click **Run**.
5. Open **Table Editor**. Confirm `users`, `rooms`, `allocations`, and `maintenance_requests` exist.
6. The app uses the backend-only service-role/secret key. Never put it in `frontend/app.js`, HTML, GitHub, or a public document.

### Promote your own account to administrator

First create a normal account through the app. Then in Supabase **SQL Editor**, run the following after replacing the email with the exact email you registered:

```sql
update public.users
set role = 'admin'
where email = 'your-registered-email@example.com';
```

Run this only for an account you control. Sign out and sign in again so the dashboard loads with the updated role.

## 9. Configure environment variables

In VS Code, create `backend/.env` by copying `backend/.env.example`. Fill in your actual values from Supabase **Project Settings → API**:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

- `SUPABASE_URL`: URL of your Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: privileged database key for the server only. If your Supabase dashboard calls it a secret key, use the server-side secret key supported by your project.
- `JWT_SECRET`: used to sign login tokens. Generate a strong value from the `backend` directory:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `JWT_SECRET`. Do not commit `backend/.env`. `.env.example` contains placeholder values only and is safe to share.

## 10. Install and run on Windows

1. Open the project folder in VS Code.
2. Choose **Terminal → New Terminal**.
3. Move into the backend folder:

```bash
cd backend
```

4. Install dependencies:

```bash
npm install
```

5. Confirm `backend/.env` contains your real values.
6. Check JavaScript syntax:

```bash
npm run check
```

7. Start the server:

```bash
npm start
```

Expected terminal message:

```text
HostelDesk running at http://localhost:3000
```

8. Open Chrome and visit http://localhost:3000.
9. Check the health endpoint at http://localhost:3000/api/health. It should return JSON with `"status":"ok"`.

Keep the terminal open while using the application. Press `Ctrl+C` to stop the server.

## 11. First-time demo workflow

1. Open the app and choose **Create account** to register a resident.
2. Register a second account if you want to demonstrate different users.
3. Promote your own admin account using the SQL in Section 8.
4. Sign in as admin and add room(s), for example A-204 in A Block with capacity 2.
5. Allocate an available room to a resident.
6. Sign in as the resident to see the room allocation.
7. Submit a maintenance request such as “The study light is not working.”
8. Sign in as admin and change the request from Pending to In progress or Resolved.
9. Sign in as the resident and refresh the page to see the updated status.

The project does not include demo accounts or fake records. The first administrator and rooms must be created by following the steps above.

## 12. API overview

All request/response bodies are JSON. Authenticated routes use `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Server health | Public |
| POST | `/api/auth/register` | Create resident account | Public |
| POST | `/api/auth/login` | Sign in | Public, rate limited |
| GET | `/api/auth/me` | Current account | Authenticated |
| GET | `/api/resident/overview` | Own active room allocation | Resident |
| GET | `/api/maintenance` | List own requests | Resident |
| POST | `/api/maintenance` | Submit a request | Resident |
| GET | `/api/admin/rooms` | List rooms and bed availability | Admin |
| POST | `/api/admin/rooms` | Add a room | Admin |
| GET | `/api/admin/residents` | List residents and allocations | Admin |
| POST | `/api/admin/allocations` | Allocate a room | Admin |
| GET | `/api/admin/maintenance` | List all requests | Admin |
| PATCH | `/api/admin/maintenance/:id` | Update request status | Admin |

Common errors: `400` invalid input, `401` missing/invalid login, `403` resident trying to access admin API, `404` unknown route/request, `409` duplicate account/room or allocation conflict, `500` unexpected server-side failure.

## 13. Architecture

```text
Browser (HTML + CSS + JavaScript)
           │ fetch() / JSON
           ▼
Express backend (validation + JWT + role checks)
           │ server-only Supabase client
           ▼
Supabase PostgreSQL
(users, rooms, allocations, maintenance_requests)
```

The browser never connects to Supabase directly. Express checks the token and role before accessing protected data. PostgreSQL RLS is enabled with no anonymous policies; the backend uses the privileged server key, so authorization checks in Express are essential.

## 14. Testing checklist

- [ ] `/api/health` returns `status: ok`.
- [ ] Registration with valid details creates a user.
- [ ] Duplicate email or student ID returns a conflict error.
- [ ] A password shorter than 8 characters is rejected.
- [ ] Correct login works; incorrect password is rejected.
- [ ] A resident cannot access `/api/admin/rooms` (403).
- [ ] Admin can add a room; duplicate block + room number is rejected.
- [ ] Admin can allocate a resident to an available room.
- [ ] A resident cannot be allocated a second active room.
- [ ] A room at full capacity cannot accept another resident.
- [ ] Resident can create a maintenance request with valid details.
- [ ] Empty/short descriptions and invalid categories are rejected.
- [ ] Resident sees only their own requests.
- [ ] Admin can update request status; resident cannot call admin status API.
- [ ] Refreshing the page preserves data because it is stored in PostgreSQL.
- [ ] Layout remains usable at phone and desktop widths.

## 15. Troubleshooting

- **Missing environment variable:** check spelling in `backend/.env`; restart the server after editing.
- **Invalid API key / database error:** copy the project URL and server-only key from the correct Supabase project.
- **Tables not found:** run `database/schema.sql` in the Supabase SQL Editor and confirm all four tables exist.
- **JWT secret error:** use a random secret at least 32 characters long.
- **Port in use:** set `PORT=3001` in `.env`, restart, and visit `http://localhost:3001`.
- **Admin dashboard not shown:** ensure your user row has `role = 'admin'`, then sign out and sign in again.
- **Room allocation fails:** check that the resident has no active allocation and the room has an available bed.
- **Browser shows an error message:** inspect the VS Code terminal for the server-side error. Never share secret keys in screenshots or chat.

## 16. Git and GitHub

1. Create a new repository on https://github.com/ (do not upload `.env`).
2. Open the VS Code terminal at the **project root**, not inside `backend`.
3. Run:

```bash
git init
git status
git add .
git status
git commit -m "Build hostel room allocation portal"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the URL of your repository. Check the second `git status` before committing: `backend/.env` and `node_modules/` must not appear in staged files. If GitHub asks you to authenticate, follow its current sign-in instructions.

Adding `.env` to `.gitignore` does not remove a secret already committed. If a secret is exposed, rotate it immediately in Supabase and remove it from repository history as appropriate.

## 17. Security and limitations

- Passwords are hashed with bcrypt; they are never stored as plain text.
- JWT tokens expire after eight hours and are stored in session storage for this learning MVP. A production system should consider secure, HTTP-only cookies and stronger session controls.
- The server-only Supabase key must never be exposed to the browser.
- RLS is enabled and no public policies are created. Because the server uses a privileged key, the backend is the enforcement layer.
- This MVP does not include password reset, email verification, room transfer, allocation cancellation, file/photo uploads, or deployment configuration. Add these only if required and review security before production use.
