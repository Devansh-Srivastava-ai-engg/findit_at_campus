import os
import sqlite3
import random
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

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
                contact TEXT NOT NULL DEFAULT '',
                image TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'returned')),
                claimedBy TEXT NOT NULL DEFAULT '',
                claimantId TEXT NOT NULL DEFAULT '',
                claimantContact TEXT NOT NULL DEFAULT '',
                claimProof TEXT NOT NULL DEFAULT '',
                claimantPhoto TEXT NOT NULL DEFAULT '',
                claimedAt DATETIME DEFAULT NULL,
                demo INTEGER NOT NULL DEFAULT 0,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(createdAt DESC);")

        # Migration check for new columns
        table_cols = [col["name"] for col in conn.execute("PRAGMA table_info(reports)").fetchall()]
        if "contact" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN contact TEXT NOT NULL DEFAULT ''")
        if "image" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN image TEXT NOT NULL DEFAULT ''")
        if "claimedBy" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimedBy TEXT NOT NULL DEFAULT ''")
        if "claimantId" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimantId TEXT NOT NULL DEFAULT ''")
        if "claimantContact" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimantContact TEXT NOT NULL DEFAULT ''")
        if "claimProof" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimProof TEXT NOT NULL DEFAULT ''")
        if "claimantPhoto" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimantPhoto TEXT NOT NULL DEFAULT ''")
        if "claimedAt" not in table_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN claimedAt DATETIME DEFAULT NULL")

        cur = conn.execute("SELECT COUNT(*) as count FROM reports")
        count = cur.fetchone()["count"]
        if count == 0:
            sample_reports = [
                ('demo-1', 'lost', 'ID & Cards', 'College ID Card', 'Central Library', '2026-10-08', 'Student ID with blue lanyard. Belongs to 2nd year CS student.', 'devansh.cs@campus.edu or WhatsApp 9876543210', '', 'active', '', '', '', '', '', None, 1, '2026-10-08 10:00:00'),
                ('demo-2', 'found', 'Electronics', 'Wireless Earbuds Case', 'Cafeteria, Block B', '2026-10-07', 'White charging case found on table near juice counter.', 'Handed to Cafeteria Manager (Counter 1)', '', 'active', '', '', '', '', '', None, 1, '2026-10-07 14:30:00'),
                ('demo-3', 'lost', 'Books & Notes', 'Calculus Notebook', 'Block A, Room 204', '2026-10-06', 'Blue spiral notebook with handwritten practice sets.', 'Contact via Class Group (Section B)', '', 'active', '', '', '', '', '', None, 1, '2026-10-06 11:15:00'),
                ('demo-4', 'found', 'Bags & Bottles', 'Steel Water Bottle', 'Sports Ground', '2026-10-08', 'Brushed stainless bottle left near basketball bleachers.', 'Kept at Sports Complex Equipment Desk', '', 'active', '', '', '', '', '', None, 1, '2026-10-08 16:45:00'),
                ('demo-5', 'lost', 'Electronics', 'Black USB Drive', 'Computer Lab 2', '2026-10-05', 'SanDisk 32GB thumb drive, left plugged into workstation 14.', 'priya.it@campus.edu', '', 'active', '', '', '', '', '', None, 1, '2026-10-05 09:20:00'),
                ('demo-6', 'found', 'Clothing', 'Grey Zip Hoodie', 'Auditorium Entrance', '2026-10-04', 'Medium size hoodie left on lobby chair after orientation.', 'Security Desk at Gate 1', '', 'returned', 'Rohan Verma', 'CS-2024-089', 'rohan.v@campus.edu', 'Showed matching initials on inner tag & college ID card', '', '2026-10-04 18:00:00', 1, '2026-10-04 18:00:00')
            ]
            conn.executemany("""
                INSERT INTO reports (id, type, category, name, location, date, description, contact, image, status, claimedBy, claimantId, claimantContact, claimProof, claimantPhoto, claimedAt, demo, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_reports)
            conn.commit()

def format_row(row):
    if not row:
        return None
    d = dict(row)
    d["demo"] = bool(d.get("demo", 0))
    d["contact"] = d.get("contact") or ""
    d["image"] = d.get("image") or ""
    d["claimedBy"] = d.get("claimedBy") or ""
    d["claimantId"] = d.get("claimantId") or ""
    d["claimantContact"] = d.get("claimantContact") or ""
    d["claimProof"] = d.get("claimProof") or ""
    d["claimantPhoto"] = d.get("claimantPhoto") or ""
    d["claimedAt"] = d.get("claimedAt")
    return d

@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "FindIt@Campus Flask API", "database": "connected"})

@app.route("/api/reports", methods=["GET"])
def get_reports():
    type_filter = request.args.get("type")
    category_filter = request.args.get("category")
    status_filter = request.args.get("status")
    query = request.args.get("q")

    sql = "SELECT * FROM reports WHERE 1=1"
    params = []

    if type_filter and type_filter != "all":
        sql += " AND type = ?"
        params.append(type_filter)
    if category_filter and category_filter != "all":
        sql += " AND category = ?"
        params.append(category_filter)
    if status_filter and status_filter != "all":
        sql += " AND status = ?"
        params.append(status_filter)
    if query and query.strip():
        sql += " AND (name LIKE ? OR location LIKE ? OR description LIKE ? OR category LIKE ? OR contact LIKE ? OR claimantId LIKE ? OR claimedBy LIKE ?)"
        term = f"%{query.strip()}%"
        params.extend([term, term, term, term, term, term, term])

    sql += " ORDER BY createdAt DESC"

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return jsonify([format_row(r) for r in rows])

@app.route("/api/reports", methods=["POST"])
def create_report():
    data = request.get_json() or {}
    report_type = data.get("type")
    category = (data.get("category") or "").strip()
    name = (data.get("name") or "").strip()
    location = (data.get("location") or "").strip()
    date_val = (data.get("date") or "").strip()
    description = (data.get("description") or "").strip()
    contact = (data.get("contact") or "").strip()[:120]
    image = (data.get("image") or "").strip()

    if report_type not in ["lost", "found"]:
        return jsonify({"error": "Type must be either 'lost' or 'found'."}), 400
    if not all([category, name, location, date_val, description]):
        return jsonify({"error": "All fields are required."}), 400

    report_id = f"item-{int(time.time()*1000)}-{hex(random.randint(4096, 65535))[2:]}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_db() as conn:
        conn.execute("""
            INSERT INTO reports (id, type, category, name, location, date, description, contact, image, status, demo, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
        """, (report_id, report_type, category, name, location, date_val, description, contact, image, now))
        conn.commit()
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        return jsonify(format_row(row)), 201

@app.route("/api/reports/<report_id>/return", methods=["PATCH", "POST"])
def mark_returned(report_id):
    data = request.get_json() or {}
    claimant_id = (data.get("claimantId") or "").strip()
    claimant_contact = (data.get("claimantContact") or "").strip()
    claimed_by = (data.get("claimedBy") or "").strip() or "Verified Student"
    claim_proof = (data.get("claimProof") or "").strip()
    claimant_photo = (data.get("claimantPhoto") or "").strip()

    if not claimant_id:
        return jsonify({"error": "College ID Card / Roll Number is required to claim an item."}), 400
    if not claimant_contact:
        return jsonify({"error": "Contact phone or email is required for verification."}), 400

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            return jsonify({"error": "Report not found."}), 404
        conn.execute("""
            UPDATE reports 
            SET status = 'returned',
                claimedBy = ?,
                claimantId = ?,
                claimantContact = ?,
                claimProof = ?,
                claimantPhoto = ?,
                claimedAt = ?
            WHERE id = ?
        """, (claimed_by, claimant_id, claimant_contact, claim_proof, claimant_photo, now, report_id))
        conn.commit()
        updated = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        return jsonify(format_row(updated))

@app.route("/api/reports/<report_id>", methods=["DELETE"])
def delete_report(report_id):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            return jsonify({"error": "Report not found."}), 404
        conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        conn.commit()
        return jsonify({"success": True, "deletedId": report_id})

if __name__ == "__main__":
    init_db()
    print("FindIt@Campus Flask server running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
