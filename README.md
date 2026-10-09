# DSA Exam Portal

A complete, production-ready online coding examination platform for Data Structures and Algorithms. Features secure proctored exams with code execution in Python, Java, C, and C++.

## Features

### Admin Portal
- 📋 **Student Management** — Upload via CSV/Excel, add individually, auto-generate passwords
- 📝 **Question Bank** — CRUD with bulk import (Excel/CSV/JSON), test cases (sample + hidden)
- 🎯 **Exam Management** — Create exams, assign questions, set schedule & proctoring rules
- 👁️ **Live Proctoring** — Real-time student monitoring (tab switches, fullscreen exits, online status)
- 📊 **Results & Export** — Per-student/question/test-case breakdown, Excel export
- ✏️ **Manual Scoring** — Override scores, re-run submissions

### Student Portal
- 🔐 **Login** — Registration number + password authentication
- 💻 **Monaco Editor** — Full-featured code editor with syntax highlighting
- ⚡ **Code Execution** — Run sample test cases, submit against all test cases
- 🛡️ **Proctoring** — Tab switch detection, fullscreen enforcement, copy/paste blocking
- 💾 **Autosave** — Code saved every 10 seconds
- ⏱️ **Server Timer** — Server-authoritative countdown
- 📈 **Results** — View published exam scores in profile

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Monaco Editor, Zustand |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL (local) |
| Code Execution | Judge0 CE (self-hosted via Docker) |
| Auth | JWT + bcrypt |
| File Handling | multer + exceljs |
| Validation | Zod |
| Queue/Cache | Redis (via Docker) |

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (installed locally)
- **pgAdmin 4** (optional, for DB inspection only — it is a GUI tool, NOT a database)
- **Docker** and **Docker Compose** (for Judge0 and Redis)

---

## Setup Instructions

### 1. Database Setup

You need PostgreSQL running locally. **pgAdmin 4 is only a GUI for viewing/managing your database — it does NOT replace PostgreSQL or Prisma.**

#### Option A: Using psql (command line)
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database and user
CREATE DATABASE exam_portal;
CREATE DATABASE judge0;
CREATE USER exam_user WITH PASSWORD 'exam_password';
GRANT ALL PRIVILEGES ON DATABASE exam_portal TO exam_user;
GRANT ALL PRIVILEGES ON DATABASE judge0 TO exam_user;

-- For PostgreSQL 15+, also grant schema access:
\c exam_portal
GRANT ALL ON SCHEMA public TO exam_user;
\c judge0
GRANT ALL ON SCHEMA public TO exam_user;
```

#### Option B: Using pgAdmin 4
1. Open pgAdmin 4 and connect to your local PostgreSQL server.
2. Right-click **Login/Group Roles** → Create → Login/Group Role:
   - Name: `exam_user`
   - Password tab: `exam_password`
   - Privileges tab: Can login ✓
3. Right-click **Databases** → Create → Database:
   - Name: `exam_portal`, Owner: `exam_user`
4. Create another database: `judge0`, Owner: `exam_user`

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and set your DATABASE_URL:
# DATABASE_URL="postgresql://exam_user:exam_password@localhost:5432/exam_portal?schema=public"
```

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run Prisma Migrations

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed the database with sample data
npx prisma db seed
```

After migration, you can inspect the created tables in pgAdmin 4:
- Connect to `exam_portal` database
- Expand **Schemas → public → Tables**
- You should see: users, students, admins, exams, questions, test_cases, etc.

### 5. Start Docker Services (Judge0 + Redis)

```bash
# From the project root directory
docker compose up -d
```

This starts:
- **Redis** on port 6379
- **Judge0 Server** on port 2358
- **Judge0 Workers** for processing submissions

### 6. Start the Application

```bash
# Terminal 1: Backend
cd backend
npm run dev
# Server starts at http://localhost:4000

# Terminal 2: Frontend
cd frontend
npm run dev
# App starts at http://localhost:3000
```

### 7. Generate Excel Templates (Optional)

```bash
cd backend
npx ts-node scripts/generate-templates.ts
# Templates saved to templates/ directory
```

---

## Default Credentials

| Role | Login | Password |
|------|-------|----------|
| Admin | admin@examportal.com | admin123 |
| Student | STU001 | student123 |
| Student | STU002 | student123 |
| Student | STU003 | student123 |

---

## API Endpoints

### Auth
- `POST /api/auth/login` — Admin login (email/password)
- `POST /api/auth/student/login` — Student login (regNo/password)
- `GET /api/auth/me` — Get current user

### Admin
- `GET/POST /api/admin/students` — List/create students
- `POST /api/admin/students/upload` — Bulk upload students
- `GET/POST /api/admin/questions` — List/create questions
- `PUT/DELETE /api/admin/questions/:id` — Update/delete question
- `POST /api/admin/questions/upload` — Bulk upload questions
- `GET/POST /api/admin/exams` — List/create exams
- `PUT/DELETE /api/admin/exams/:id` — Update/delete exam
- `PATCH /api/admin/exams/:id/publish` — Publish/unpublish exam
- `PATCH /api/admin/exams/:id/publish-results` — Publish results
- `GET /api/admin/exams/:id/sessions` — Proctoring dashboard
- `GET /api/admin/exams/:id/submissions` — View submissions
- `GET /api/admin/exams/:id/export` — Export results to Excel

### Student
- `GET /api/student/exams` — Available exams
- `POST /api/student/exams/:id/start` — Start exam
- `POST /api/student/sessions/:id/heartbeat` — Heartbeat
- `POST /api/student/sessions/:id/autosave` — Save code
- `POST /api/student/sessions/:id/run` — Run sample test cases
- `POST /api/student/sessions/:id/submit` — Submit code
- `POST /api/student/sessions/:id/finish` — Submit entire exam
- `POST /api/student/sessions/:id/proctor-event` — Report proctor event
- `GET /api/student/results` — Published results
- `GET /api/student/profile` — Student profile

---

## Scoring Logic

1. Each question has multiple test cases with equal weight by default.
2. **Question Score** = (passed_test_cases / total_test_cases) × max_marks
3. **Final Score** = (sum_of_question_scores / sum_of_max_marks) × 100
4. Unattempted questions score 0.
5. Time taken is recorded but NOT included in final score.
6. Tab switch penalty is configurable (default 0).

---

## Docker Setup Details

### Default Setup (Local PostgreSQL + Docker services)

The `docker-compose.yml` runs Judge0 and Redis only. PostgreSQL runs on your host machine.

Docker services connect to host PostgreSQL using `host.docker.internal`.

### Linux Users

On Linux, `host.docker.internal` may not resolve automatically. The `docker-compose.yml` includes:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If that doesn't work, replace `host.docker.internal` with your machine's LAN IP:
```bash
# Find your IP
ip addr show | grep "inet " | grep -v 127.0.0.1
# Example: 192.168.1.100
```

Then update the POSTGRES_HOST in docker-compose.yml accordingly.

### Alternative: Dockerized PostgreSQL

If you prefer running PostgreSQL in Docker (e.g., no local PostgreSQL):

1. Uncomment the `postgres` service in `docker-compose.yml`.
2. Uncomment `postgres-data` in the `volumes` section.
3. Note: It maps to **port 5433** on the host to avoid conflicts with local PostgreSQL.
4. Update your backend `.env`:
   ```
   DATABASE_URL="postgresql://exam_user:exam_password@localhost:5433/exam_portal?schema=public"
   ```

---

## Troubleshooting

### Port 5432 conflict
If you see "port already in use" for PostgreSQL:
- Your local PostgreSQL is already using port 5432 (expected).
- The Docker PostgreSQL (if enabled) uses port 5433 to avoid conflict.

### Prisma shadow database
During `prisma migrate dev`, Prisma creates a temporary "shadow database". This requires CREATE DATABASE permission.
- Ensure your `exam_user` has the CREATEDB privilege, or use the `postgres` superuser for migrations.
- For production, use `prisma migrate deploy` instead (no shadow database needed).

```sql
ALTER USER exam_user CREATEDB;
```

### Judge0 not connecting
1. Check if Judge0 is running: `curl http://localhost:2358/about`
2. Ensure Redis is running: `docker compose ps`
3. Check Judge0 logs: `docker compose logs judge0-server`
4. The Judge0 database (`judge0`) must exist in your PostgreSQL.

### CORS errors
Ensure the `CORS_ORIGIN` in your backend `.env` matches your frontend URL:
```
CORS_ORIGIN=http://localhost:3000
```

### Node.js version
This project requires Node.js 18+. Check with `node --version`.

---

## Upload Templates

### Students (CSV)
```csv
name,regNo,className,email,password
John Doe,STU101,CS-A,john@student.com,pass1234
Jane Smith,STU102,CS-A,,
```
- `email` and `password` are optional. Passwords auto-generate if blank.

### Questions (Excel - two sheets)

**Sheet 1: "Questions"**
| question_id | title | description | max_marks | allowed_languages | time_limit_ms |
|-------------|-------|-------------|-----------|-------------------|---------------|
| Q1 | Two Sum | Given an array... | 100 | python,java,c,cpp | 2000 |

**Sheet 2: "TestCases"**
| question_id | input | expected_output | is_sample | weight | order |
|-------------|-------|-----------------|-----------|--------|-------|
| Q1 | 2 7 11 15\n9 | 0 1 | true | 1.0 | 1 |
| Q1 | 3 3\n6 | 0 1 | false | 1.0 | 2 |

### Questions (JSON)
See `templates/questions_template.json` for the full format.

---

## Project Structure

```
dsa-portal/
├── docker-compose.yml          # Judge0 + Redis (PostgreSQL optional)
├── templates/                  # Upload templates
│   ├── students_template.csv
│   └── questions_template.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # Seed data
│   ├── src/
│   │   ├── index.ts            # Express server entry
│   │   ├── config/             # Environment config
│   │   ├── middleware/         # Auth, upload, error handling
│   │   ├── routes/             # API routes
│   │   ├── services/           # Judge0 integration
│   │   ├── validators/         # Zod schemas
│   │   └── lib/                # Prisma client
│   ├── scripts/                # Utility scripts
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── admin/          # Admin portal pages
│   │   │   └── student/        # Student portal pages
│   │   ├── lib/                # API client
│   │   └── store/              # Zustand state
│   ├── .env.local
│   └── package.json
└── README.md
```

---

## License

MIT
