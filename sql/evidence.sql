-- !preview conn=DBI::dbConnect(RSQLite::SQLite())

CREATE TABLE evidence (

id INTEGER PRIMARY KEY AUTOINCREMENT,

uuid TEXT UNIQUE,

number TEXT UNIQUE,

mission_uuid TEXT,

question_uuid TEXT,

filename_original TEXT,

filename_storage TEXT,

extension TEXT,

mime_type TEXT,

size_bytes INTEGER,

sha256 TEXT,

md5 TEXT,

pages INTEGER,

width INTEGER,

height INTEGER,

dpi INTEGER,

created_by TEXT,

created_at TEXT,

collected_at TEXT,

version INTEGER,

status TEXT,

comment TEXT,

storage_path TEXT,

thumbnail_path TEXT,

ocr_text TEXT,

signature TEXT,

deleted INTEGER DEFAULT 0

);SELECT 1
