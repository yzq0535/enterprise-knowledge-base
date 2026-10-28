/* SQLite 数据层（Node 22+ 内置 node:sqlite，无需编译原生模块） */
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { stamp } = require('./time');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'workbench.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  code TEXT DEFAULT '',
  location TEXT DEFAULT '',
  warn INTEGER NOT NULL DEFAULT 5,
  note TEXT DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  total_in INTEGER NOT NULL DEFAULT 0,
  total_out INTEGER NOT NULL DEFAULT 0,
  lent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  qty INTEGER NOT NULL,
  person TEXT DEFAULT '',
  note TEXT DEFAULT '',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS borrows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  dept TEXT DEFAULT '',
  person TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  borrowed_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  returned_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  taken_at TEXT NOT NULL,
  photo TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT UNIQUE NOT NULL,
  summary TEXT DEFAULT '',
  issue TEXT DEFAULT '',
  plan TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_book ON records(book_id);
CREATE INDEX IF NOT EXISTS idx_records_occurred ON records(occurred_at);
CREATE INDEX IF NOT EXISTS idx_borrows_book ON borrows(book_id);
CREATE INDEX IF NOT EXISTS idx_borrows_status ON borrows(returned_at, due_at);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
`);

/* 默认管理员：admin / 123456（首次启动生成，设置页可改密码） */
if (!db.prepare('SELECT id FROM users LIMIT 1').get()) {
  const { salt, hash } = hashPassword(process.env.INIT_PASSWORD || '123456');
  db.prepare('INSERT INTO users (username, salt, hash, created_at) VALUES (?,?,?,?)')
    .run('admin', salt, hash, stamp());
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

module.exports = { db, DATA_DIR, UPLOAD_DIR, getSetting, setSetting, tx };
