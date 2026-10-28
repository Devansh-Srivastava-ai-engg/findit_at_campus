# FindIt@Campus — Lost & Found Directory

A pragmatic, full-stack campus lost-and-found system built with vanilla JavaScript, Express.js, and SQLite.

---

## Architecture & Practical Notes

- **Backend Runtime**: Uses Express.js with SQLite (`node:sqlite` on Node 22.5+, falling back to `better-sqlite3` on older engines).
- **Frontend Architecture**: Pure HTML5, CSS custom properties, and vanilla JS. No client bundler or hydration overhead.
- **Port Detection**: Automatically detects whether the client is being served directly from Express on `:3000` or through VS Code's Live Server on `:5500`.

---

## Quick Start

### 1. Node.js & Express (Primary)

```bash
cd FindIt_at_Campus
npm install
npm start
```

Open `http://localhost:3000` in your browser. The server automatically initializes the SQLite schema in `campus_reports.db` and seeds starter demo records.

For development with automatic file restarts:
```bash
npm run dev
```

### 2. Python Flask (Alternative)

If your environment prefers Python:

```bash
pip install flask flask-cors
python app.py
```

Runs on `http://localhost:5000` with the same database file and API endpoints.

---

## API Summary

- `GET /api/health` — Service health check
- `GET /api/reports` — Fetch all records (supports `?type=`, `?category=`, `?status=`, `?q=`)
- `POST /api/reports` — File a new record
- `PATCH /api/reports/:id/return` — Mark item returned
- `DELETE /api/reports/:id` — Delete a record
