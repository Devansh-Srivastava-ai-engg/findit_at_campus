# FindIt@Campus — Full-Stack Campus Lost and Found System

A student-friendly lost and found web application with a centralized REST API backend and SQLite database.

---

## 🚀 Quick Start Guide (VS Code)

### Option A: Run with Node.js & Express (Recommended)

1. **Open in VS Code**:
   - Open Visual Studio Code.
   - Go to **File -> Open Folder...** and select the `FindIt_at_Campus` folder.

2. **Open Integrated Terminal**:
   - Press ``Ctrl + ` `` (Backtick) or click **Terminal -> New Terminal**.

3. **Install Dependencies**:
   ```bash
   npm install
   ```
   This installs `express`, `cors`, and `better-sqlite3`.

4. **Start the Server**:
   ```bash
   npm start
   ```
   *(or `npm run dev` to automatically restart on code changes)*

5. **Open in Browser**:
   - Open your browser and go to:
     **http://localhost:3000**
   - That's it! The server serves both the frontend website and the backend REST API.

---

### Option B: Using VS Code "Live Server" Extension

If you prefer opening the frontend with VS Code's **Live Server** extension:
1. Start the backend in terminal: `npm start` (runs on `http://localhost:3000`).
2. Right-click `index.html` in VS Code and click **"Open with Live Server"** (runs on `http://127.0.0.1:5500`).
3. CORS is enabled in `server.js`, so your frontend will communicate seamlessly with `http://localhost:3000/api`.

---

### Option C: Run with Python Flask (Alternative)

If your college requires Python:
1. In the terminal, install requirements:
   ```bash
   pip install flask flask-cors
   ```
2. Start the Python server:
   ```bash
   python app.py
   ```
3. Open **http://localhost:5000** in your browser.

---

## 📁 Project Structure

- `index.html` — User interface (hero section, statistics, search/filter bar, item cards, report modal).
- `style.css` — Responsive design, modern color palette, loading spinner, and animations.
- `script.js` — Client-side logic making asynchronous `fetch()` calls to backend REST API.
- `server.js` — Express.js server, CORS middleware, SQLite database connection, and REST API routes.
- `schema.sql` — SQLite database table definitions, indexes, and initial demo seed queries.
- `package.json` — Node.js package configuration and launch scripts.
- `app.py` — Optional Python Flask backend alternative.
- `campus_reports.db` — SQLite database file (created automatically upon first run).

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports` | Fetch all reports (supports query filters: `?type=lost`, `?category=Electronics`, `?q=search`) |
| `POST` | `/api/reports` | Create a new lost/found report |
| `PATCH` | `/api/reports/:id/return` | Mark an item status as "returned" |
| `DELETE` | `/api/reports/:id` | Delete a report by ID |
| `GET` | `/api/health` | Backend and database health status |

---

## 🗄️ Database Schema (`reports` table)

- `id` (TEXT PRIMARY KEY) — Unique identifier (e.g., `item-1718000000-abc12`)
- `type` (TEXT) — `'lost'` or `'found'`
- `category` (TEXT) — Item category (`'ID & Cards'`, `'Electronics'`, etc.)
- `name` (TEXT) — Item name
- `location` (TEXT) — Campus location where lost or found
- `date` (TEXT) — Incident date (YYYY-MM-DD)
- `description` (TEXT) — Identifying details
- `status` (TEXT) — `'active'` or `'returned'`
- `demo` (INTEGER) — `1` for demo sample items, `0` for user-reported items
- `createdAt` (DATETIME) — Creation timestamp
