-- RxGuardian AI SQLite Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  clinic_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  patient_name TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  allergies TEXT,
  renal_impairment INTEGER DEFAULT 0,
  hepatic_impairment INTEGER DEFAULT 0,
  is_pregnant INTEGER DEFAULT 0,
  raw_ocr_text TEXT,
  rxscore INTEGER NOT NULL,
  band TEXT NOT NULL,
  medicines_json TEXT NOT NULL,
  alerts_json TEXT NOT NULL,
  summary_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medicine_cache (
  term TEXT PRIMARY KEY,
  rxcui TEXT,
  name TEXT,
  confidence REAL,
  synonyms_json TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS openfda_cache (
  rxcui_or_name TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,          -- clinic/pharmacist account that owns this record
  full_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,
  allergies TEXT,                    -- free text, same shape as existing PatientContext.allergies
  current_medications TEXT,          -- JSON array of {name, rxcui, started_at}
  past_prescriptions_ref TEXT,       -- JSON array of analysis IDs (FK-ish, references analyses.id)
  previous_reactions TEXT,           -- free text
  is_pregnant INTEGER DEFAULT 0,
  renal_impairment INTEGER DEFAULT 0,
  hepatic_impairment INTEGER DEFAULT 0,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  qr_token TEXT UNIQUE NOT NULL,     -- opaque random token encoded in the QR, NOT the raw record
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,         -- this pharmacy's own account
  drug_name TEXT NOT NULL,
  rxcui TEXT,
  stock_status TEXT NOT NULL,       -- 'in_stock' | 'low_stock' | 'out_of_stock'
  quantity INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

