# Saathi · Race-Proof Team Formation at Scale

> **Saathi — Race-Proof Team Formation for 10,000 Hackathon Participants**  
> **Zero Oversold Seats. Zero Split Brains. Zero Stale Views.**  
> A production-grade team formation platform engineered with strict PostgreSQL row-level concurrency control (`SELECT ... FOR UPDATE`), distributed request idempotency, live Server-Sent Events (SSE), and a high-density engineering console React frontend.

---

## 🚀 Key Highlights & Verifiable Proofs

- **Proven Concurrency (`tests/race.test.ts`):** 50 concurrent transactions race for the final available team seat at the exact same millisecond. **Strictly 1 succeeds (200 OK) and 49 receive 409 Conflict (`TEAM_FULL`)**. Verified by database ground truth.
- **Chaos Resilience & Clean Rollback (`tests/chaos.test.ts`):** The server process is abruptly killed with `SIGKILL` while a join transaction is held mid-flight. PostgreSQL automatically aborts the transaction, preserving uncorrupted member counts and releasing row locks cleanly.
- **Micro-Cached Board Performance (`scripts/load-test.ts`):** Load tested using Autocannon with **100 concurrent connections** over 10 seconds:
  - **12,131 requests/sec** (121,315 total requests)
  - **p95 Latency: 2 ms** (Threshold: $< 200\text{ ms}$)
  - **0 timeouts, 0 errors**
  - Full report: [`LOAD_TEST_REPORT.md`](LOAD_TEST_REPORT.md)
- **42 Automated Tests Passing Across 3 Test Suites:**
  - 3 Concurrency & Invariant tests ([`tests/race.test.ts`](tests/race.test.ts))
  - 38 API Specification, Auth & Helper tests ([`tests/api.test.ts`](tests/api.test.ts))
  - 1 Mid-Flight Process Crash Chaos test ([`tests/chaos.test.ts`](tests/chaos.test.ts))
- **Live SSE Event Stream (`/api/events`):** Zero page refresh. Team updates, seat claims, requests, and leaves reflect in real-time across all connected clients.
- **Precision Engineering Frontend (`client/`):**
  - Built with Vite, React 18, Tailwind CSS, Lucide icons.
  - **Quick Demo User Switcher:** 1-click dropdown to switch between Team Leader, Members, and Solo Hackers without typing passwords.
  - **Visual Concurrency Simulator:** Run the 50-way race test directly in the browser and inspect the 1 winner vs 49 rejections live.
  - **Optimistic UI:** Instant visual feedback with automatic rollback on 409 Conflict.
  - **Keyboard Navigation:** 100% accessible via Tab, Enter, Escape with high-contrast visible focus rings.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Node.js 20, Fastify 5, Zod validation, `pg` (PostgreSQL client).
- **Concurrency & Transaction Engine:** PostgreSQL pessimistic locking (`SELECT ... FOR UPDATE`), transaction-isolated audit logging, and `Idempotency-Key` tracking via `pg_advisory_xact_lock`.
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite.
- **Testing & Benchmarks:** Vitest 2.1, Autocannon.
- **CI / CD:** GitHub Actions with PostgreSQL 16 Alpine service container ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

---

## 🏁 Quickstart

### 1. Prerequisites
- **Node.js** >= 20.x
- **PostgreSQL** instance (or use the configured Supabase remote database in `.env`)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/parvjain/race-proof-teams.git
cd race-proof-teams

# Install root dependencies
npm install

# Install client dependencies
npm --prefix client install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is configured.

### 4. Seed the Database (10,000 Users, 2,000 Teams)
```bash
npm run seed
```
*Seeds 10,000 users with randomized skill vectors and timezones, plus 2,000 teams in ~6 seconds using batch multi-row inserts.*

### 5. Build and Run Saathi
```bash
# Build React client
npm run build

# Start Fastify server (serves API at /api/* and React app at /)
npm start
```
Visit **http://localhost:4000** in your browser!

---

## 🧪 Testing & Verification Commands

### Run Full Test Suite (All 42 Tests)
```bash
npm test
```

### Run Individual Test Suites
```bash
# 1. 50-way Concurrency Race & Idempotency Suite
npm run test:race

# 2. Complete API Specification & Auth Suite (38 tests)
npm run test:api

# 3. Process Crash & Chaos Resilience Suite (SIGKILL mid-flight)
npm run test:chaos
```

### Run Autocannon Load Benchmark
```bash
npm run loadtest
```
Simulates 100 concurrent users querying `GET /api/board` and writes results to [`LOAD_TEST_REPORT.md`](LOAD_TEST_REPORT.md).

---

## 📖 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/board` | Paginated listing of open teams with skill filter | Optional |
| `GET` | `/api/demo-users` | 6 curated demo personas for 1-click user switcher | Optional |
| `GET` | `/api/my-team` | Current user's team, roster, invites & requests | Yes (`x-user-id`) |
| `POST` | `/api/teams` | Create a new team | Yes (`x-user-id`) |
| `POST` | `/api/teams/:teamId/invites` | Generate expiring invite code (TTL & max uses) | Leader only |
| `POST` | `/api/teams/join-by-invite` | Join team via invite code (rate-limited, race-proof) | Yes |
| `POST` | `/api/teams/:teamId/requests` | Submit join request to a team | Yes |
| `POST` | `/api/requests/:requestId/respond` | Accept or decline pending join request | Leader only |
| `POST` | `/api/teams/:teamId/leave` | Leave team (auto-succession or deletion) | Member only |
| `DELETE` | `/api/teams/:teamId/members/:targetUserId` | Kick member from team | Leader only |
| `GET` | `/api/suggestions` | Teammate recommendations with score breakdown | Yes |
| `GET` | `/api/teams/:teamId/audit-logs` | Chronological immutable audit trail | Member only |
| `GET` | `/api/events` | Server-Sent Events (SSE) real-time stream | None |
| `POST` | `/api/demo/simulate-race` | Run real-time 50-way concurrency race simulation | None |

---

## 📑 Design Document
Read the complete 1-page system architecture, concurrency defense, trade-offs, and future roadmap in [`DESIGN.md`](DESIGN.md).
