"""
FindIt@Campus — FastAPI & SQLite Backend
FastAPI with SQLite (file-based database) and CORS support.

To run:
  uvicorn main:app --reload --port 8000
"""

import os
import sqlite3
import random
import time
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="FindIt@Campus API")

# Enable CORS for frontend clients (Live Server, browser, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "campus_reports.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL CHECK(type IN ('lost', 'found')),
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned')),
                demo INTEGER NOT NULL DEFAULT 0,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(createdAt DESC);")

        count = conn.execute("SELECT COUNT(*) as count FROM reports").fetchone()["count"]
        if count == 0:
            sample_reports = [
                ('demo-1', 'lost', 'ID & Cards', 'College ID Card', 'Central Library', '2026-10-08', 'A student ID card with a blue lanyard. Please keep it safe if found.', 'active', 1, '2026-10-08 10:00:00'),
                ('demo-2', 'found', 'Electronics', 'Wireless Earbuds Case', 'Cafeteria, Block B', '2026-10-07', 'White earbuds case found near the seating area.', 'active', 1, '2026-10-07 14:30:00'),
                ('demo-3', 'lost', 'Books & Notes', 'Calculus Notebook', 'Block A, Room 204', '2026-10-06', 'A blue notebook with maths notes and a name written inside.', 'active', 1, '2026-10-06 11:15:00'),
                ('demo-4', 'found', 'Bags & Bottles', 'Steel Water Bottle', 'Sports Ground', '2026-10-08', 'Silver bottle found on the bench near the basketball court.', 'active', 1, '2026-10-08 16:45:00'),
                ('demo-5', 'lost', 'Electronics', 'Black USB Drive', 'Computer Lab 2', '2026-10-05', 'Small black USB drive. It may have been left near a desktop.', 'active', 1, '2026-10-05 09:20:00'),
                ('demo-6', 'found', 'Clothing', 'Grey Hoodie', 'Auditorium Entrance', '2026-10-04', 'Grey hoodie found after an afternoon event.', 'returned', 1, '2026-10-04 18:00:00')
            ]
            conn.executemany("""
                INSERT INTO reports (id, type, category, name, location, date, description, status, demo, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_reports)
            conn.commit()

init_db()

def format_row(row):
    if not row:
        return None
    d = dict(row)
    d["demo"] = bool(d.get("demo", 0))
    return d

class CreateReportDTO(BaseModel):
    type: str
    category: str
    name: str
    location: str
    date: str
    description: str

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "FindIt@Campus FastAPI", "database": "connected"}

@app.get("/api/reports")
def get_reports(type: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None, q: Optional[str] = None):
    sql = "SELECT * FROM reports WHERE 1=1"
    params = []

    if type and type != "all":
        sql += " AND type = ?"
        params.append(type)
    if category and category != "all":
        sql += " AND category = ?"
        params.append(category)
    if status and status != "all":
        sql += " AND status = ?"
        params.append(status)
    if q and q.strip():
        sql += " AND (name LIKE ? OR location LIKE ? OR description LIKE ? OR category LIKE ?)"
        term = f"%{q.strip()}%"
        params.extend([term, term, term, term])

    sql += " ORDER BY createdAt DESC"

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [format_row(r) for r in rows]

@app.post("/api/reports", status_code=201)
def create_report(dto: CreateReportDTO):
    if dto.type not in ["lost", "found"]:
        raise HTTPException(status_code=400, detail="Type must be 'lost' or 'found'.")
    if not all([dto.category.strip(), dto.name.strip(), dto.location.strip(), dto.date.strip(), dto.description.strip()]):
        raise HTTPException(status_code=400, detail="All fields are required.")

    report_id = f"item-{int(time.time()*1000)}-{hex(random.randint(4096, 65535))[2:]}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_db() as conn:
        conn.execute("""
            INSERT INTO reports (id, type, category, name, location, date, description, status, demo, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
        """, (report_id, dto.type, dto.category.strip(), dto.name.strip(), dto.location.strip(), dto.date.strip(), dto.description.strip(), now))
        conn.commit()
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        return format_row(row)

@app.patch("/api/reports/{report_id}/return")
def mark_returned(report_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        conn.execute("UPDATE reports SET status = 'returned' WHERE id = ?", (report_id,))
        conn.commit()
        updated = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        return format_row(updated.fetchone())

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
        return {"success": True, "message": "Report deleted successfully.", "deletedId": report_id}

# Mount static frontend files
app.mount("/", StaticFiles(directory=os.path.dirname(__file__), html=True), name="static")
