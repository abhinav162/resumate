# Turso Database Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SQLite file-based database with Turso (cloud-hosted libSQL) so data persists independently of Docker containers and server state.

**Architecture:** The backend currently uses the `sqlite3` npm package via a custom `Database` singleton class (`database.js`) that wraps all queries. Turso's `@libsql/client` package is API-compatible with libSQL (a SQLite fork), so all raw SQL queries stay unchanged — only the driver in `database.js` is swapped. For local development, the same driver uses a `file:` URL pointing to a local SQLite file. For staging/production, it uses the Turso cloud URL and auth token.

**Tech Stack:** `@libsql/client` (Turso npm client), Turso cloud (free tier), Node.js/Express backend

---

## Pre-Work: Create Your Turso Database (Manual — Do This First)

Before running any code tasks, create your Turso account and database. This gives you the environment variables needed in Task 3.

- [ ] **Install Turso CLI**

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

- [ ] **Log in**

```bash
turso auth login
```

- [ ] **Create two databases (one per environment)**

```bash
turso db create resumate-staging
turso db create resumate-prod
```

- [ ] **Get connection details for staging**

```bash
turso db show resumate-staging
turso db tokens create resumate-staging
```

Save the output:
- `TURSO_DATABASE_URL` = the `URL` shown (starts with `libsql://`)
- `TURSO_AUTH_TOKEN` = the token from `tokens create`

- [ ] **Migrate existing SQLite data (if any production data exists)**

If the server has existing data in `/app/data/resumate.db`, export it first:

```bash
# SSH into the server, find the DB file, copy it locally
scp user@server:/path/to/project/data/resumate.db ./resumate-backup.db

# Import into Turso
turso db create resumate-staging --from-file ./resumate-backup.db
```

If this is a fresh staging environment with no data to preserve, skip this step.

---

## File Structure

| File | Change |
|------|--------|
| `apps/backend/package.json` | Remove `sqlite3`, remove `jsonwebtoken` (dead dep), add `@libsql/client` |
| `apps/backend/src/config/database.js` | Full rewrite — swap sqlite3 driver for `@libsql/client` |
| `apps/backend/.env.example` | Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, remove `DB_PATH` |
| `docker-compose.yml` | Remove `resumate-data` named volume (no longer needed) |

---

### Task 1: Swap npm dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install @libsql/client and remove sqlite3 + jsonwebtoken**

```bash
cd /path/to/resumate
npm uninstall sqlite3 jsonwebtoken --workspace=apps/backend
npm install @libsql/client --workspace=apps/backend
```

- [ ] **Step 2: Verify package.json looks correct**

Open `apps/backend/package.json`. Confirm:
- `"@libsql/client"` appears in `dependencies` (version `^0.14.0` or newer)
- `"sqlite3"` is gone
- `"jsonwebtoken"` is gone

- [ ] **Step 3: Verify install succeeded**

```bash
node -e "import('@libsql/client').then(m => console.log('OK:', Object.keys(m)))"
```

Expected output: `OK: [ 'createClient', ... ]`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json package-lock.json
git commit -m "chore: replace sqlite3 with @libsql/client, remove dead jsonwebtoken dep"
```

---

### Task 2: Rewrite database.js to use libSQL client

**Files:**
- Modify: `apps/backend/src/config/database.js`

**Context:**
The current `Database` class wraps `sqlite3`. The new version wraps `@libsql/client`.

Key API differences:
- `createClient({ url, authToken })` replaces `new sqlite3.Database(path)`
- `client.execute({ sql, args })` replaces `db.run/get/all`
- Returns `{ rows, rowsAffected, lastInsertRowid }` — `lastInsertRowid` is a `bigint`, must be wrapped in `Number()`
- `rows[0]` for single-row queries
- No callback style — all async/await

For local development: `url = 'file:./data/resumate.db'` (no auth token needed)
For Turso cloud: `url = 'libsql://your-db.turso.io'` + `authToken = 'eyJ...'`

- [ ] **Step 1: Replace database.js**

Open `apps/backend/src/config/database.js` and replace the entire file with:

```js
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.client = null;
  }

  async connect() {
    // Turso cloud URL takes priority; fall back to local file for development
    const url = process.env.TURSO_DATABASE_URL || 'file:./data/resumate.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    this.client = createClient({ url, authToken });

    // Enable foreign key enforcement (SQLite default is OFF)
    await this.client.execute('PRAGMA foreign_keys = ON');

    console.log(`Connected to database: ${url.startsWith('libsql://') ? 'Turso cloud' : url}`);
  }

  async close() {
    if (this.client) {
      this.client.close();
      this.client = null;
      console.log('Database connection closed');
    }
  }

  // For INSERT / UPDATE / DELETE — returns { id, lastID, changes } to match previous API
  async run(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return {
      id: Number(result.lastInsertRowid),
      lastID: Number(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  }

  // For SELECT — returns single row object or null
  async get(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return result.rows[0] ?? null;
  }

  // For SELECT — returns array of row objects
  async all(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return result.rows;
  }
}

// Singleton instance shared across the app
const database = new Database();

export default database;
```

- [ ] **Step 2: Verify the server starts without errors**

Run:
```bash
cd /path/to/resumate && npm run dev:backend
```

Expected output:
```
Initializing database...
Connected to database: file:./data/resumate.db
All tables created successfully
...
Resumate backend server running on port 4300
```

If you see `Error: Cannot find module '@libsql/client'`, run `npm install` from the repo root first.

- [ ] **Step 3: Verify basic query works**

```bash
curl http://localhost:4300/health
```

Expected: `{"status":"ok","timestamp":"..."}`

```bash
curl http://localhost:4300/api/resumes -H "x-user-id: test-user-123"
```

Expected: `{"success":true,"data":[]}`  (empty array, not an error)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/config/database.js
git commit -m "feat: migrate database driver from sqlite3 to @libsql/client (Turso-compatible)"
```

---

### Task 3: Update environment configuration

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update .env.example**

Open `apps/backend/.env.example` and replace with:

```
# Backend Environment Variables
# Copy this file to .env and fill in real values
# Variables marked [REQUIRED] must be set for the app to function

# [REQUIRED] Server port
PORT=4300

# [REQUIRED] "development" or "production" — controls error verbosity and rate limits
NODE_ENV=production

# [REQUIRED] Frontend origin for CORS and Stripe redirect URLs
FRONTEND_URL=http://localhost:3160

# [REQUIRED] Must match FRONTEND_URL (used by CORS middleware)
CORS_ORIGIN=http://localhost:3160

# [REQUIRED] Google Gemini API key for AI features (scoring, tailoring, PDF parsing)
GEMINI_API_KEY=

# --- Database (Turso) ---
# Get these from: turso db show <db-name> && turso db tokens create <db-name>
# For LOCAL DEVELOPMENT only: leave both blank to use a local SQLite file at ./data/resumate.db

# [REQUIRED in production] Turso database URL (libsql://your-db.turso.io)
TURSO_DATABASE_URL=

# [REQUIRED in production] Turso auth token
TURSO_AUTH_TOKEN=

# --- Stripe (leave blank to disable credit purchases) ---

# [OPTIONAL] Stripe secret key (sk_test_* or sk_live_*)
STRIPE_SECRET_KEY=

# [OPTIONAL] Stripe webhook signing secret (whsec_*)
STRIPE_WEBHOOK_SECRET=

# [OPTIONAL] Stripe Price IDs for credit packs
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_MAX=
```

- [ ] **Step 2: Remove the Docker volume from docker-compose.yml**

Open `docker-compose.yml`. Remove the `volumes` section from the backend service and the top-level `volumes` declaration. The file should become:

```yaml
services:
  backend:
    image: ghcr.io/${GHCR_USERNAME:-abhinav162}/resumate-backend:${IMAGE_TAG:-latest}
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "${BACKEND_PORT:-4300}:4300"
    environment:
      - NODE_ENV=production
      - PORT=4300
    env_file:
      - apps/backend/.env
    restart: always

  frontend:
    image: ghcr.io/${GHCR_USERNAME:-abhinav162}/resumate-frontend:${IMAGE_TAG:-latest}
    build:
      context: .
      dockerfile: apps/frontend-v2/Dockerfile
    ports:
      - "${FRONTEND_PORT:-3160}:80"
    env_file:
      - apps/frontend/.env
    restart: always
    depends_on:
      - backend
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/.env.example docker-compose.yml
git commit -m "chore: update env config for Turso, remove Docker volume (DB is now in cloud)"
```

---

### Task 4: Wire up Turso credentials in deployment env files

**Files:**
- Modify: `.env.backend.staging` (on the server — must be done manually)
- Modify: `.env.backend.production` (on the server)

**Context:** The deploy script reads `.env.backend.staging` and `.env.backend.production` from the server's `$PROJECT_PATH`. These files are NOT in the repo (they're secrets). You need to SSH into the server and update them.

- [ ] **Step 1: SSH into the server and update staging env**

```bash
ssh user@your-server
cd $PROJECT_PATH

# Edit the staging env file — add these two lines:
# TURSO_DATABASE_URL=libsql://resumate-staging.turso.io
# TURSO_AUTH_TOKEN=eyJ...
nano .env.backend.staging
```

Add:
```
TURSO_DATABASE_URL=libsql://resumate-staging.<your-org>.turso.io
TURSO_AUTH_TOKEN=<token-from-pre-work-step>
```

Remove (if present):
```
DB_PATH=...
```

- [ ] **Step 2: Test the connection before deploying**

On the server, you can verify the credentials work by running a quick Node.js test:

```bash
node -e "
const { createClient } = await import('@libsql/client');
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await c.execute('SELECT 1 as ping');
console.log('Connection OK:', r.rows);
" 
```

Expected: `Connection OK: [ { ping: 1 } ]`

---

## Verification Checklist

After all tasks and deployment:

1. **Local dev still works** — `npm run dev:backend` connects to local file DB, all CRUD endpoints work
2. **Staging uses Turso** — deploy to staging, check logs: `Connected to database: Turso cloud`
3. **Data persists across deploys** — create a resume, trigger a deploy, resume still exists
4. **Credits persist across deploys** — register, use 1 credit, deploy, credit still shows 4 (not reset to 5)
5. **Staging and prod are isolated** — data in staging doesn't appear in prod

---

## What Does NOT Change

- All SQL queries (CREATE TABLE, SELECT, INSERT, UPDATE, DELETE) — unchanged
- `initDb.js` — unchanged
- All route files — unchanged
- All model files — unchanged
- Frontend — unchanged
