/* 日常工作台 · 后端服务（Express + SQLite + 服务端水印） */
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const { db, DATA_DIR, getSetting, setSetting, tx } = require('./src/db');
const auth = require('./src/auth');
const t = require('./src/time');
const photo = require('./src/photo');
const report = require('./src/report');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '14mb' }));

/* 会话密钥：首次启动随机生成并落库 */
const SECRET = (() => {
  let s = getSetting('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', s);
  }
  return s;
})();

const isSecure = (req) =>
  req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function authRequired(req, res, next) {
  const cookies = auth.parseCookies(req.headers.cookie || '');
  const payload = auth.unsign(cookies[auth.COOKIE], SECRET);
  if (!payload) return res.status(401).json({ error: '未登录或登录已过期' });
  req.session = payload;
  next();
}

function fail(res, err, code = 400) {
  res.status(code).json({ error: err && err.message ? err.message : String(err) });
}

/* 登录失败限流 */
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now - rec.ts < 10 * 60 * 1000 && rec.count >= 10) return true;
  if (!rec || now - rec.ts >= 10 * 60 * 1000) attempts.set(ip, { count: 0, ts: now });
  return false;
}
function markFail(ip) {
  const rec = attempts.get(ip) || { count: 0, ts: Date.now() };
  rec.count += 1;
  rec.ts = Date.now();
  attempts.set(ip, rec);
}

function currentUser() {
  return db.prepare('SELECT id, username, salt, hash FROM users LIMIT 1').get();
}

/* ---------------- 登录 ---------------- */
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
  const password = String((req.body && req.body.password) || '');
  const user = currentUser();
  if (!user || !auth.verifyPassword(password, user.salt, user.hash)) {
    markFail(ip);
    return res.status(401).json({ error: '密码不正确' });
  }
  attempts.delete(ip);
  const token = auth.sign({ uid: user.id, exp: Date.now() + auth.MAX_AGE * 1000 }, SECRET);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, isSecure(req)));
  res.json({ ok: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearCookie());
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
  const user = currentUser();
  res.json({
    username: user.username,
    today: t.today(),
    serverTime: t.stamp(),
    weekStart: t.weekStartOf(),
    inbox: { unread: 0 }
  });
});

app.get('/api/time', (req, res) => {
  res.json({ now: t.stamp(), today: t.today(), weekStart: t.weekStartOf(t.today()) });
});

app.post('/api/password', authRequired, (req, res) => {
  const oldPwd = String((req.body && req.body.old) || '');
  const newPwd = String((req.body && req.body.next) || '');
  const user = currentUser();
  if (!auth.verifyPassword(oldPwd, user.salt, user.hash)) return fail(res, '原密码不正确');
  if (newPwd.length < 6) return fail(res, '新密码至少 6 位');
  const { salt, hash } = auth.hashPassword(newPwd);
  db.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').run(salt, hash, user.id);
  res.json({ ok: true });
});

/* ---------------- 工作台 ---------------- */
app.get('/api/dashboard', authRequired, (req, res) => {
  const today = t.today();
  const month = today.slice(0, 7);
  const todayCheck = db.prepare('SELECT * FROM checkins WHERE date = ?').get(today);
  const monthCheckins = db.prepare('SELECT COUNT(*) c FROM checkins WHERE date LIKE ?').get(month + '%').c;
  const lastCheck = db.prepare('SELECT * FROM checkins ORDER BY date DESC LIMIT 1').get();

  const books = db.prepare('SELECT * FROM books').all();
  const lowBooks = books.filter((b) => b.stock <= b.warn).sort((a, b) => a.stock - b.stock);
  const stockTotal = books.reduce((n, b) => n + b.stock, 0);

  const activeBorrows = db.prepare(
    'SELECT COUNT(*) c FROM borrows WHERE returned_at IS NULL'
  ).get().c;
  const overdueList = db.prepare(
    `SELECT b.id, b.person, b.dept, b.due_at, bk.title
     FROM borrows b JOIN books bk ON bk.id = b.book_id
     WHERE b.returned_at IS NULL AND b.due_at < ?
     ORDER BY b.due_at`
  ).all(today);

  const recentRecords = db.prepare(
    `SELECT r.*, bk.title FROM records r JOIN books bk ON bk.id = r.book_id
     ORDER BY r.occurred_at DESC, r.id DESC LIMIT 5`
  ).all();

  const recentCheckins = db.prepare(
    'SELECT date, taken_at, photo FROM checkins ORDER BY date DESC LIMIT 3'
  ).all();

  const week = report.statsFor(t.weekStartOf(today));

  res.json({
    today,
    serverTime: t.stamp(),
    todayCheck: todayCheck || null,
    lastCheck: lastCheck || null,
    monthCheckins,
    stats: {
      checkinDays: week.checkinDays,
      checkinDenom: week.denom,
      books: books.length,
      stockTotal,
      lowCount: lowBooks.length,
      activeBorrows,
      overdue: overdueList.length,
      weekIn: week.inQty,
      weekOut: week.outQty,
      borrowOut: week.borrowOut
    },
    lowBooks: lowBooks.slice(0, 4).map((b) => ({ id: b.id, title: b.title, stock: b.stock, warn: b.warn })),
    overdueList: overdueList.slice(0, 3).map((b) => ({
      ...b,
      days: Math.max(1, Math.round((t.parseDate(today) - t.parseDate(b.due_at)) / 86400000))
    })),
    recentRecords,
    recentCheckins
  });
});

/* ---------------- 存储占用 ---------------- */
app.get('/api/storage', authRequired, (req, res) => {
  let files = [];
  try { files = fs.readdirSync(UPLOAD_DIR); } catch (_) { files = []; }
  let bytes = 0;
  for (const f of files) {
    try { bytes += fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch (_) {}
  }
  const size = bytes >= 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : Math.round(bytes / 1024) + ' KB';
  res.json({ photos: files.length, bytes, size });
});

/* ---------------- 图书 ---------------- */
function bookRow(b) {
  return {
    ...b,
    low: b.stock <= b.warn,
    empty: b.stock === 0,
    cover: (b.title || '书').charAt(0)
  };
}

app.get('/api/books', authRequired, (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = q
    ? db.prepare('SELECT * FROM books WHERE title LIKE ? OR category LIKE ? ORDER BY id DESC').all(`%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM books ORDER BY id DESC').all();
  const list = rows.map(bookRow);
  const stats = {
    total: rows.length,
    stock: rows.reduce((n, b) => n + b.stock, 0),
    low: rows.filter((b) => b.stock <= b.warn).length
  };
  res.json({ list, stats });
});

app.post('/api/books', authRequired, (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return fail(res, '请填写书刊名称');
  const qty = Math.max(0, Math.min(99999, parseInt(b.qty, 10) || 0));
  const warn = Math.max(0, Math.min(9999, parseInt(b.warn, 10) || 5));
  const now = t.stamp();

  const id = tx(() => {
    const r = db.prepare(
      `INSERT INTO books (title, category, code, location, warn, note, stock, total_in, total_out, lent, created_at)
       VALUES (?,?,?,?,?,?,?,?,0,0,?)`
    ).run(title, String(b.category || ''), String(b.code || ''), String(b.location || ''),
      warn, String(b.note || ''), qty, qty, now);
    const newId = Number(r.lastInsertRowid);
    if (qty > 0) {
      db.prepare(
        `INSERT INTO records (book_id, type, qty, person, note, occurred_at, created_at)
         VALUES (?, 'in', ?, ?, ?, ?, ?)`
      ).run(newId, qty, String(b.person || ''), '新增档案首次入库', now, now);
    }
    return newId;
  });

  res.json({ ok: true, id, book: bookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(id)) });
});

app.get('/api/books/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!book) return fail(res, '图书不存在', 404);
  const records = db.prepare(
    'SELECT * FROM records WHERE book_id = ? ORDER BY occurred_at DESC, id DESC LIMIT 30'
  ).all(id);
  const borrows = db.prepare(
    'SELECT * FROM borrows WHERE book_id = ? ORDER BY id DESC LIMIT 20'
  ).all(id);
  res.json({ book: bookRow(book), records, borrows });
});

app.put('/api/books/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!book) return fail(res, '图书不存在', 404);
  const b = req.body || {};
  const title = String(b.title || book.title).trim();
  if (!title) return fail(res, '请填写书刊名称');
  db.prepare(
    'UPDATE books SET title = ?, category = ?, code = ?, location = ?, warn = ?, note = ? WHERE id = ?'
  ).run(title, String(b.category ?? book.category), String(b.code ?? book.code),
    String(b.location ?? book.location), Math.max(0, parseInt(b.warn, 10) || book.warn),
    String(b.note ?? book.note), id);
  res.json({ ok: true, book: bookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(id)) });
});

/* 出入库 */
app.post('/api/books/:id/stock', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const type = req.body && req.body.type;
  if (type !== 'in' && type !== 'out') return fail(res, '类型不正确');
  const qty = parseInt(req.body.qty, 10);
  if (!qty || qty < 1 || qty > 9999) return fail(res, '请输入正确的数量');

  let occurredAt;
  try {
    occurredAt = normalizeDateTime(req.body.occurredAt);
  } catch (e) {
    return fail(res, e);
  }

  const now = t.stamp();
  try {
    const book = tx(() => {
      const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
      if (!row) throw new Error('图书不存在');
      if (type === 'out' && row.stock < qty) throw new Error(`库存不足，当前可用 ${row.stock} 册`);
      if (type === 'in') {
        db.prepare('UPDATE books SET stock = stock + ?, total_in = total_in + ? WHERE id = ?').run(qty, qty, id);
      } else {
        db.prepare('UPDATE books SET stock = stock - ?, total_out = total_out + ? WHERE id = ?').run(qty, qty, id);
      }
      db.prepare(
        `INSERT INTO records (book_id, type, qty, person, note, occurred_at, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).run(id, type, qty, String(req.body.person || ''), String(req.body.note || ''), occurredAt, now);
      return db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    });
    res.json({ ok: true, book: bookRow(book) });
  } catch (e) {
    fail(res, e);
  }
});

app.get('/api/records', authRequired, (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const rows = db.prepare(
    `SELECT r.*, bk.title FROM records r JOIN books bk ON bk.id = r.book_id
     ORDER BY r.occurred_at DESC, r.id DESC LIMIT ?`
  ).all(limit);
  res.json({ list: rows });
});

/* ---------------- 借阅 ---------------- */
const borrowSelect = `
  SELECT br.*, bk.title, bk.category
  FROM borrows br JOIN books bk ON bk.id = br.book_id`;

function borrowRow(b, today = t.today()) {
  const status = b.returned_at ? 'returned' : (b.due_at < today ? 'overdue' : 'active');
  const days = status === 'overdue'
    ? Math.max(1, Math.round((t.parseDate(today) - t.parseDate(b.due_at)) / 86400000))
    : 0;
  return { ...b, status, overdueDays: days };
}

app.get('/api/borrows', authRequired, (req, res) => {
  const filter = String(req.query.status || 'active');
  const today = t.today();
  let rows;
  if (filter === 'returned') {
    rows = db.prepare(`${borrowSelect} WHERE br.returned_at IS NOT NULL ORDER BY br.returned_at DESC`).all();
  } else if (filter === 'overdue') {
    rows = db.prepare(`${borrowSelect} WHERE br.returned_at IS NULL AND br.due_at < ? ORDER BY br.due_at`).all(today);
  } else if (filter === 'active') {
    rows = db.prepare(`${borrowSelect} WHERE br.returned_at IS NULL ORDER BY br.borrowed_at DESC`).all();
  } else {
    rows = db.prepare(`${borrowSelect} ORDER BY br.id DESC`).all();
  }
  const list = rows.map((b) => borrowRow(b, today));
  res.json({
    list,
    counts: {
      active: db.prepare('SELECT COUNT(*) c FROM borrows WHERE returned_at IS NULL').get().c,
      overdue: db.prepare('SELECT COUNT(*) c FROM borrows WHERE returned_at IS NULL AND due_at < ?').get(today).c,
      returned: db.prepare('SELECT COUNT(*) c FROM borrows WHERE returned_at IS NOT NULL').get().c
    }
  });
});

app.post('/api/borrows', authRequired, (req, res) => {
  const body = req.body || {};
  const bookId = Number(body.bookId);
  const person = String(body.person || '').trim();
  const phone = String(body.phone || '').trim();
  if (!person) return fail(res, '请填写对接人');
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) return fail(res, '请输入 11 位手机号');
  const borrowedAt = normalizeDateTime(body.borrowedAt);
  const dueAt = normalizeDate(body.dueAt) || t.addDays(t.today(), 14);
  if (dueAt < borrowedAt.slice(0, 10)) return fail(res, '应还日期不能早于借出日期');

  try {
    const row = tx(() => {
      const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
      if (!book) throw new Error('图书不存在');
      if (book.stock <= 0) throw new Error('该图书暂无可借库存');
      db.prepare('UPDATE books SET stock = stock - 1, lent = lent + 1 WHERE id = ?').run(bookId);
      db.prepare(
        `INSERT INTO borrows (book_id, dept, person, phone, borrowed_at, due_at, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).run(bookId, String(body.dept || ''), person, phone, borrowedAt, dueAt, t.stamp());
      return db.prepare(`${borrowSelect} WHERE br.id = last_insert_rowid()`).get();
    });
    res.json({ ok: true, borrow: borrowRow(row) });
  } catch (e) {
    fail(res, e);
  }
});

app.post('/api/borrows/:id/return', authRequired, (req, res) => {
  const id = Number(req.params.id);
  try {
    const row = tx(() => {
      const br = db.prepare('SELECT * FROM borrows WHERE id = ?').get(id);
      if (!br) throw new Error('借阅记录不存在');
      if (br.returned_at) throw new Error('该记录已归还');
      db.prepare('UPDATE borrows SET returned_at = ? WHERE id = ?').run(t.stamp(), id);
      db.prepare('UPDATE books SET stock = stock + 1, lent = MAX(lent - 1, 0) WHERE id = ?').run(br.book_id);
      return db.prepare(`${borrowSelect} WHERE br.id = ?`).get(id);
    });
    res.json({ ok: true, borrow: borrowRow(row) });
  } catch (e) {
    fail(res, e);
  }
});

/* ---------------- 打卡 ---------------- */
app.get('/api/checkins', authRequired, (req, res) => {
  const month = String(req.query.month || t.today().slice(0, 7));
  const rows = db.prepare('SELECT * FROM checkins WHERE date LIKE ? ORDER BY date DESC').all(month + '%');
  res.json({ month, list: rows });
});

app.post('/api/checkins', authRequired, (req, res) => {
  const image = req.body && req.body.image;
  if (!image) return fail(res, '缺少照片');
  const today = t.today();
  const takenAt = t.stamp();
  const existing = db.prepare('SELECT * FROM checkins WHERE date = ?').get(today);

  photo.saveCheckinPhoto(image, takenAt).then((saved) => {
    tx(() => {
      if (existing) {
        db.prepare('UPDATE checkins SET taken_at = ?, photo = ?, note = ? WHERE date = ?')
          .run(takenAt, saved.file, String(req.body.note || ''), today);
      } else {
        db.prepare('INSERT INTO checkins (date, taken_at, photo, note, created_at) VALUES (?,?,?,?,?)')
          .run(today, takenAt, saved.file, String(req.body.note || ''), t.stamp());
      }
    });
    if (existing) photo.removePhoto(existing.photo);
    res.json({
      ok: true,
      checkin: { date: today, taken_at: takenAt, photo: saved.file, note: String(req.body.note || '') }
    });
  }).catch((e) => fail(res, e));
});

/* ---------------- 周报 ---------------- */
app.get('/api/reports/history', authRequired, (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
  res.json({ list: report.history(limit), today: t.today(), weekStart: t.weekStartOf() });
});

app.get('/api/reports/:weekStart', authRequired, (req, res) => {
  try {
    res.json(report.getReport(req.params.weekStart));
  } catch (e) {
    fail(res, e);
  }
});

app.put('/api/reports/:weekStart', authRequired, (req, res) => {
  try {
    res.json(report.saveReport(req.params.weekStart, req.body || {}));
  } catch (e) {
    fail(res, e);
  }
});

/* ---------------- 备份 ---------------- */
app.get('/api/backup', authRequired, (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="workbench-backup-${t.today()}.zip"`);
  const child = execFile('zip', ['-r', '-q', '-', '.'], { cwd: DATA_DIR });
  child.stdout.pipe(res);
  child.on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ error: '服务器未安装 zip：' + e.message });
    else res.end();
  });
});

/* ---------------- 静态资源 ---------------- */
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', immutable: true }));
app.use(express.static(PUBLIC_DIR, {
  etag: true,
  setHeaders(res, filePath) {
    // 页面与脚本每次校验，避免更新后手机仍用旧缓存；图片等长缓存
    if (/\.(html|js|css|webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));
app.get('/healthz', (req, res) => res.json({ ok: true, time: t.stamp() }));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

/* 统一错误处理 */
app.use((err, req, res, next) => {
  console.error('[server]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器错误：' + err.message });
});

/* ---------------- 工具 ---------------- */
function normalizeDate(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeDateTime(v) {
  if (v == null || v === '') return t.stamp();
  const s = String(v).trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' ' + t.stamp().slice(11, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  throw new Error('时间格式不正确');
}

app.listen(PORT, () => {
  console.log(`工作台账已启动: http://localhost:${PORT}  数据目录: ${DATA_DIR}`);
  const needSeed = process.argv.includes('--demo');
  if (needSeed) seedDemo();
});

/* 可选：--demo 生成演示数据（首次部署想看效果时用） */
function seedDemo() {
  if (db.prepare('SELECT COUNT(*) c FROM books').get().c > 0) return console.log('已有数据，跳过演示数据');
  const today = t.today();
  const demo = [
    ['市政工程年鉴 2025', '年鉴', 'SZ-2025', '档案室 A2', 5, 8],
    ['城市建设统计年报', '统计', 'TJ-2024', '档案室 A3', 3, 4],
    ['规划文件汇编（上册）', '文件', 'GH-01', '资料室 B1', 2, 3],
    ['标准规范目录', '标准', 'BZ-07', '资料室 B2', 5, 6]
  ];
  for (const [title, cat, code, loc, warn, qty] of demo) {
    const now = t.stamp();
    const r = db.prepare(
      `INSERT INTO books (title, category, code, location, warn, note, stock, total_in, total_out, lent, created_at)
       VALUES (?,?,?,?,?,'',?,?,0,0,?)`
    ).run(title, cat, code, loc, warn, qty, qty, now);
    db.prepare(
      `INSERT INTO records (book_id, type, qty, person, note, occurred_at, created_at) VALUES (?, 'in', ?, '演示', '演示数据', ?, ?)`
    ).run(Number(r.lastInsertRowid), qty, now, now);
  }
  console.log('演示数据已生成，默认密码 123456');
}
