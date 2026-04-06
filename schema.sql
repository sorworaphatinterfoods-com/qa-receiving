-- SWI Foods Smart QA Factory — QA Receiving Database Schema
-- FM-QA-31 | SD-QA-08

CREATE TABLE IF NOT EXISTS receiving_header (
  doc_no            TEXT PRIMARY KEY,
  date              TEXT NOT NULL,
  time              TEXT,
  supplier_id       TEXT,
  supplier_name     TEXT,
  car_registration  TEXT,
  car_temp          REAL,
  qa_inspector      TEXT,
  note              TEXT,
  signer_name       TEXT,
  signed_at         TEXT,
  overall_result    TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receiving_detail (
  detail_id         TEXT PRIMARY KEY,
  doc_no            TEXT NOT NULL,
  date              TEXT,
  supplier_name     TEXT,
  material_code     TEXT,
  material_name     TEXT,
  material_type     TEXT,
  lot_no            TEXT,
  qty               REAL,
  unit              TEXT,
  mfg_date          TEXT,
  exp_date          TEXT,
  temp1             REAL,
  temp2             REAL,
  temp3             REAL,
  avg_temp          REAL,
  temp_status       TEXT,
  visual_check      TEXT,
  leak_check        TEXT,
  document_check    TEXT,
  result            TEXT,
  note              TEXT,
  photo1            TEXT,
  photo2            TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (doc_no) REFERENCES receiving_header(doc_no) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nc_log (
  nc_id             TEXT PRIMARY KEY,
  doc_no            TEXT,
  supplier_id       TEXT,
  supplier_name     TEXT,
  fail_type         TEXT,
  corrective_action TEXT,
  qa_supervisor     TEXT,
  status            TEXT DEFAULT 'Open',
  closed_date       TEXT,
  note              TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signatures (
  doc_no            TEXT PRIMARY KEY,
  signer_name       TEXT,
  signed_at         TEXT,
  sig_base64        TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_detail_docno ON receiving_detail(doc_no);
CREATE INDEX IF NOT EXISTS idx_header_date  ON receiving_header(date);
CREATE INDEX IF NOT EXISTS idx_nc_docno     ON nc_log(doc_no);
CREATE INDEX IF NOT EXISTS idx_nc_status    ON nc_log(status);
