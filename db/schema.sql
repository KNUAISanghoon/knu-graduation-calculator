PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL UNIQUE,
  representative_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  credits REAL,

  is_major INTEGER NOT NULL DEFAULT 0 CHECK (is_major IN (0, 1)),
  is_liberal_arts INTEGER NOT NULL DEFAULT 0 CHECK (is_liberal_arts IN (0, 1)),
  is_major_required INTEGER NOT NULL DEFAULT 0 CHECK (is_major_required IN (0, 1)),
  is_general_elective INTEGER NOT NULL DEFAULT 0 CHECK (is_general_elective IN (0, 1)),

  liberal_category TEXT CHECK (
    liberal_category IS NULL OR liberal_category IN ('basic', 'core', 'literacy', 'unknown')
  ),
  is_sdg INTEGER NOT NULL DEFAULT 0 CHECK (is_sdg IN (0, 1)),

  department TEXT,
  college TEXT,
  sort_priority INTEGER NOT NULL DEFAULT 100,
  first_seen_year INTEGER,
  last_seen_year INTEGER,
  source TEXT NOT NULL DEFAULT 'unknown',
  raw_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_offerings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  semester TEXT NOT NULL,
  section_code TEXT,
  original_course_code TEXT NOT NULL,
  professor TEXT,
  department TEXT,
  class_type TEXT,
  raw_json TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',

  CHECK (year BETWEEN 2023 AND 2026)
);

CREATE TABLE IF NOT EXISTS major_required_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_year INTEGER NOT NULL,
  major_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT,
  note TEXT,

  UNIQUE (admission_year, major_name, course_code)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(course_name);
CREATE INDEX IF NOT EXISTS idx_courses_priority ON courses(sort_priority, course_name);
CREATE INDEX IF NOT EXISTS idx_courses_flags ON courses(
  is_major_required,
  is_major,
  is_liberal_arts,
  is_general_elective
);
CREATE INDEX IF NOT EXISTS idx_offerings_year_semester ON course_offerings(year, semester);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offerings_unique_section
ON course_offerings(year, semester, original_course_code, COALESCE(section_code, ''));
CREATE INDEX IF NOT EXISTS idx_major_required_admission ON major_required_courses(admission_year, major_name);

CREATE TRIGGER IF NOT EXISTS trg_courses_updated_at
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
  UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
