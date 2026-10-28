-- FindIt@Campus Database Schema (SQLite)

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

-- Index for faster filtering and sorting
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(createdAt DESC);

-- Initial Demo/Seed Data
INSERT OR IGNORE INTO reports (id, type, category, name, location, date, description, contact, image, status, claimedBy, claimantId, claimantContact, claimProof, claimantPhoto, claimedAt, demo, createdAt) VALUES
('demo-1', 'lost', 'ID & Cards', 'College ID Card', 'Central Library', '2026-10-08', 'Student ID with blue lanyard. Belongs to 2nd year CS student.', 'devansh.cs@campus.edu or WhatsApp 9876543210', '', 'active', '', '', '', '', '', NULL, 1, '2026-10-08 10:00:00'),
('demo-2', 'found', 'Electronics', 'Wireless Earbuds Case', 'Cafeteria, Block B', '2026-10-07', 'White charging case found on table near juice counter.', 'Handed to Cafeteria Manager (Counter 1)', '', 'active', '', '', '', '', '', NULL, 1, '2026-10-07 14:30:00'),
('demo-3', 'lost', 'Books & Notes', 'Calculus Notebook', 'Block A, Room 204', '2026-10-06', 'Blue spiral notebook with handwritten practice sets.', 'Contact via Class Group (Section B)', '', 'active', '', '', '', '', '', NULL, 1, '2026-10-06 11:15:00'),
('demo-4', 'found', 'Bags & Bottles', 'Steel Water Bottle', 'Sports Ground', '2026-10-08', 'Brushed stainless bottle left near basketball bleachers.', 'Kept at Sports Complex Equipment Desk', '', 'active', '', '', '', '', '', NULL, 1, '2026-10-08 16:45:00'),
('demo-5', 'lost', 'Electronics', 'Black USB Drive', 'Computer Lab 2', '2026-10-05', 'SanDisk 32GB thumb drive, left plugged into workstation 14.', 'priya.it@campus.edu', '', 'active', '', '', '', '', '', NULL, 1, '2026-10-05 09:20:00'),
('demo-6', 'found', 'Clothing', 'Grey Zip Hoodie', 'Auditorium Entrance', '2026-10-04', 'Medium size hoodie left on lobby chair after orientation.', 'Security Desk at Gate 1', '', 'returned', 'Rohan Verma', 'CS-2024-089', 'rohan.v@campus.edu', 'Showed matching initials on inner tag & college ID card', '', '2026-10-04 18:00:00', 1, '2026-10-04 18:00:00');
