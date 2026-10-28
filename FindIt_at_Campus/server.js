const express = require('express');
const cors = require('cors');
const path = require('path');

// Prefer native node:sqlite (Node 22.5+) to avoid node-gyp build dependencies on Windows.
let Database;
try {
  Database = require('node:sqlite').DatabaseSync;
} catch {
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('SQLite unavailable. Requires Node >= 22.5.0 or better-sqlite3 installed.');
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'campus_reports.db');

app.use(cors());
// Set 10MB payload limit to accommodate compressed base64 item and claimant photos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

const db = new Database(DB_PATH);

db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
  CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(createdAt DESC);
`);

// Migrations: ensure columns exist if database was initialized with earlier schema
try {
  const tableCols = db.prepare('PRAGMA table_info(reports)').all().map(c => c.name);
  if (!tableCols.includes('contact')) {
    db.exec("ALTER TABLE reports ADD COLUMN contact TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('image')) {
    db.exec("ALTER TABLE reports ADD COLUMN image TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimedBy')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimedBy TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimantId')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimantId TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimantContact')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimantContact TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimProof')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimProof TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimantPhoto')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimantPhoto TEXT NOT NULL DEFAULT ''");
  }
  if (!tableCols.includes('claimedAt')) {
    db.exec("ALTER TABLE reports ADD COLUMN claimedAt DATETIME DEFAULT NULL");
  }
} catch (err) {
  console.error('Migration warning (schema columns):', err.message);
}

function serializeRow(row) {
  if (!row) return null;
  return {
    ...row,
    demo: Boolean(row.demo),
    contact: row.contact || '',
    image: row.image || '',
    claimedBy: row.claimedBy || '',
    claimantId: row.claimantId || '',
    claimantContact: row.claimantContact || '',
    claimProof: row.claimProof || '',
    claimantPhoto: row.claimantPhoto || '',
    claimedAt: row.claimedAt || null
  };
}

// Seed starter data if database is fresh
const countRow = db.prepare('SELECT COUNT(*) as count FROM reports').get();
if (countRow && countRow.count === 0) {
  const insert = db.prepare(`
    INSERT INTO reports (id, type, category, name, location, date, description, contact, image, status, claimedBy, claimantId, claimantContact, claimProof, claimantPhoto, claimedAt, demo, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRows = [
    ['demo-1', 'lost', 'ID & Cards', 'College ID Card', 'Central Library', '2026-10-08', 'Student ID with blue lanyard. Belongs to 2nd year CS student.', 'devansh.cs@campus.edu or WhatsApp 9876543210', '', 'active', '', '', '', '', '', null, 1, '2026-10-08 10:00:00'],
    ['demo-2', 'found', 'Electronics', 'Wireless Earbuds Case', 'Cafeteria, Block B', '2026-10-07', 'White charging case found on table near juice counter.', 'Handed to Cafeteria Manager (Counter 1)', '', 'active', '', '', '', '', '', null, 1, '2026-10-07 14:30:00'],
    ['demo-3', 'lost', 'Books & Notes', 'Calculus Notebook', 'Block A, Room 204', '2026-10-06', 'Blue spiral notebook with handwritten practice sets.', 'Contact via Class Group (Section B)', '', 'active', '', '', '', '', '', null, 1, '2026-10-06 11:15:00'],
    ['demo-4', 'found', 'Bags & Bottles', 'Steel Water Bottle', 'Sports Ground', '2026-10-08', 'Brushed stainless bottle left near basketball bleachers.', 'Kept at Sports Complex Equipment Desk', '', 'active', '', '', '', '', '', null, 1, '2026-10-08 16:45:00'],
    ['demo-5', 'lost', 'Electronics', 'Black USB Drive', 'Computer Lab 2', '2026-10-05', 'SanDisk 32GB thumb drive, left plugged into workstation 14.', 'priya.it@campus.edu', '', 'active', '', '', '', '', '', null, 1, '2026-10-05 09:20:00'],
    ['demo-6', 'found', 'Clothing', 'Grey Zip Hoodie', 'Auditorium Entrance', '2026-10-04', 'Medium size hoodie left on lobby chair after orientation.', 'Security Desk at Gate 1', '', 'returned', 'Rohan Verma', 'CS-2024-089', 'rohan.v@campus.edu', 'Showed matching initials on inner tag & college ID card', '', '2026-10-04 18:00:00', 1, '2026-10-04 18:00:00']
  ];

  db.exec('BEGIN');
  try {
    for (const r of initialRows) insert.run(...r);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Failed to seed starter records:', err);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FindIt@Campus API', database: 'connected' });
});

app.get('/api/reports', (req, res) => {
  try {
    const { type, category, status, q } = req.query;
    let sql = 'SELECT * FROM reports WHERE 1=1';
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (q && q.trim()) {
      sql += ' AND (name LIKE ? OR location LIKE ? OR description LIKE ? OR category LIKE ? OR contact LIKE ? OR claimantId LIKE ? OR claimedBy LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term, term, term, term, term);
    }

    sql += ' ORDER BY createdAt DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(serializeRow));
  } catch (err) {
    console.error('GET /api/reports error:', err);
    res.status(500).json({ error: 'Database query failed.' });
  }
});

app.post('/api/reports', (req, res) => {
  try {
    const { type, category, name, location, date, description, contact, image } = req.body || {};

    if (!type || !['lost', 'found'].includes(type)) {
      return res.status(400).json({ error: "Field 'type' must be either 'lost' or 'found'." });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: "Field 'category' is required." });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Field 'name' is required." });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: "Field 'location' is required." });
    }
    if (!date || !date.trim()) {
      return res.status(400).json({ error: "Field 'date' is required." });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Field 'description' is required." });
    }

    const id = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const cleanContact = (contact || '').trim().substring(0, 120);
    const cleanImage = (image || '').trim();

    db.prepare(`
      INSERT INTO reports (id, type, category, name, location, date, description, contact, image, status, demo, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
    `).run(
      id,
      type,
      category.trim(),
      name.trim().substring(0, 70),
      location.trim().substring(0, 80),
      date.trim(),
      description.trim().substring(0, 300),
      cleanContact,
      cleanImage,
      now
    );

    const record = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    res.status(201).json(serializeRow(record));
  } catch (err) {
    console.error('POST /api/reports error:', err);
    res.status(500).json({ error: 'Failed to insert report record.' });
  }
});

// PATCH /api/reports/:id/return (or claim verification)
app.patch('/api/reports/:id/return', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: `Record '${id}' not found.` });
    }

    // Claimant verification fields
    const { claimedBy, claimantId, claimantContact, claimProof, claimantPhoto } = req.body || {};

    if (!claimantId || !claimantId.trim()) {
      return res.status(400).json({ error: 'College ID Card / Roll Number is required to claim an item.' });
    }
    if (!claimantContact || !claimantContact.trim()) {
      return res.status(400).json({ error: 'Contact phone/email of the claimant is required for security verification.' });
    }

    const name = (claimedBy || '').trim().substring(0, 60) || 'Verified Student';
    const idCard = claimantId.trim().substring(0, 40);
    const contact = claimantContact.trim().substring(0, 100);
    const proof = (claimProof || '').trim().substring(0, 200);
    const photo = (claimantPhoto || '').trim();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE reports 
      SET status = 'returned',
          claimedBy = ?,
          claimantId = ?,
          claimantContact = ?,
          claimProof = ?,
          claimantPhoto = ?,
          claimedAt = ?
      WHERE id = ?
    `).run(name, idCard, contact, proof, photo, now, id);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    res.json(serializeRow(updated));
  } catch (err) {
    console.error('PATCH /api/reports/:id/return error:', err);
    res.status(500).json({ error: 'Status update and verification failed.' });
  }
});

// POST /api/reports/:id/claim alias
app.post('/api/reports/:id/claim', (req, res) => {
  return app._router.handle({ ...req, method: 'PATCH', url: `/api/reports/${req.params.id}/return` }, res);
});

app.delete('/api/reports/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: `Record '${id}' not found.` });
    }

    db.prepare('DELETE FROM reports WHERE id = ?').run(id);
    res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('DELETE /api/reports/:id error:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint does not exist.' });
});

app.listen(PORT, () => {
  console.log(`FindIt@Campus listening on http://localhost:${PORT}`);
});
