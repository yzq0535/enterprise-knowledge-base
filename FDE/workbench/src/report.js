/* 周报统计：以周（周一至周日）为单位汇总打卡、出入库、借阅 */
const { db } = require('./db');
const t = require('./time');

const BORROW_ACTIVE = 'returned_at IS NULL';

function bookMap() {
  const map = {};
  for (const b of db.prepare('SELECT * FROM books').all()) map[b.id] = b;
  return map;
}

function lastDayOfWeek(weekStart) {
  const end = t.addDays(weekStart, 6);
  return end > t.today() ? t.today() : end;
}

function statsFor(weekStart) {
  const weekEnd = t.addDays(weekStart, 6);
  const today = t.today();
  const isCurrent = weekStart === t.weekStartOf(today);
  const done = weekEnd < today;
  const denom = isCurrent ? t.daysBetween(weekStart, lastDayOfWeek(weekStart)) : 7;

  const checkins = db.prepare(
    "SELECT date, taken_at, photo FROM checkins WHERE date >= ? AND date <= ? ORDER BY date"
  ).all(weekStart, weekEnd);

  const inRow = db.prepare(
    "SELECT COALESCE(SUM(qty),0) qty, COUNT(*) cnt FROM records WHERE type='in' AND occurred_at >= ? AND occurred_at <= ?"
  ).get(weekStart, weekEnd + ' 23:59:59');
  const outRow = db.prepare(
    "SELECT COALESCE(SUM(qty),0) qty, COUNT(*) cnt FROM records WHERE type='out' AND occurred_at >= ? AND occurred_at <= ?"
  ).get(weekStart, weekEnd + ' 23:59:59');

  const borrowed = db.prepare(
    'SELECT COUNT(*) cnt FROM borrows WHERE borrowed_at >= ? AND borrowed_at <= ?'
  ).get(weekStart, weekEnd + ' 23:59:59').cnt;

  const returned = db.prepare(
    'SELECT COUNT(*) cnt FROM borrows WHERE returned_at >= ? AND returned_at <= ?'
  ).get(weekStart, weekEnd + ' 23:59:59').cnt;

  const onLoan = db.prepare(
    'SELECT COUNT(*) cnt FROM borrows WHERE borrowed_at <= ? AND (returned_at IS NULL OR returned_at > ?)'
  ).get(weekEnd + ' 23:59:59', weekEnd + ' 23:59:59').cnt;

  const overdue = db.prepare(
    `SELECT b.id, b.person, b.dept, b.due_at, bk.title
     FROM borrows b JOIN books bk ON bk.id = b.book_id
     WHERE b.borrowed_at <= ? AND (b.returned_at IS NULL OR b.returned_at > ?) AND b.due_at < ?
     ORDER BY b.due_at`
  ).all(weekEnd + ' 23:59:59', weekEnd + ' 23:59:59', weekEnd);

  const books = bookMap();
  const lowBooks = Object.values(books)
    .filter((b) => b.stock <= b.warn)
    .sort((a, b) => a.stock - b.stock)
    .map((b) => ({ id: b.id, title: b.title, stock: b.stock, warn: b.warn }));

  const stockTotal = Object.values(books).reduce((n, b) => n + b.stock, 0);
  const bookCount = Object.values(books).length;

  const weekEndTime = weekEnd + ' 23:59:59';
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const d = t.addDays(weekStart, i);
    const c = checkins.find((x) => x.date === d);
    daily.push({
      date: d,
      weekday: t.weekdayCN(d),
      checked: !!c,
      photo: c ? c.photo : null,
      time: c ? c.taken_at.slice(11, 16) : null,
      future: d > today
    });
  }

  return {
    weekStart,
    weekEnd,
    weekNo: t.weekNo(weekStart),
    rangeLabel: t.rangeLabel(weekStart, weekEnd),
    isCurrent,
    done,
    denom,
    checkinDays: checkins.length,
    checkinRate: denom ? Math.round((checkins.length / denom) * 100) : 0,
    photos: checkins.map((c) => ({ date: c.date, file: c.photo })),
    daily,
    inQty: inRow.qty,
    inCount: inRow.cnt,
    outQty: outRow.qty,
    outCount: outRow.cnt,
    borrowOut: borrowed,
    borrowReturn: returned,
    onLoan,
    overdue: overdue.map((o) => ({
      id: o.id,
      person: o.person,
      dept: o.dept,
      title: o.title,
      due: o.due_at,
      days: Math.max(1, t.daysBetween(o.due_at, weekEndTime.slice(0, 10)) - 1)
    })),
    lowBooks,
    lowCount: lowBooks.length,
    stockTotal,
    bookCount
  };
}

function weekStartOrThrow(input) {
  const s = String(input || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('周起始日期格式不正确');
  return t.weekStartOf(s);
}

function suggest(stats) {
  const parts = [];
  if (stats.checkinDays) parts.push(`本周完成清洁打卡 ${stats.checkinDays} 天`);
  if (stats.inQty) parts.push(`图书入库 ${stats.inQty} 册（${stats.inCount} 笔）`);
  if (stats.outQty) parts.push(`出库 ${stats.outQty} 册（${stats.outCount} 笔）`);
  if (stats.borrowOut) parts.push(`新借出 ${stats.borrowOut} 册`);
  if (stats.borrowReturn) parts.push(`归还 ${stats.borrowReturn} 册`);
  const summary = parts.length ? parts.join('，') + '。' : '本周暂无业务数据，请补充。';

  const issues = [];
  if (stats.overdue && stats.overdue.length) issues.push(`有 ${stats.overdue.length} 笔借阅已逾期，需跟进催还`);
  if (stats.lowCount) issues.push(`${stats.lowCount} 种书刊库存低于预警值，需安排补充`);
  if (stats.checkinDays < stats.denom) issues.push(`打卡 ${stats.checkinDays}/${stats.denom} 天，存在漏打`);

  const plans = [];
  if (stats.overdue && stats.overdue.length) plans.push('逐一联系逾期借阅人，完成归还或续借登记');
  if (stats.lowCount) plans.push('核对低库存书刊清单，提交补充入库计划');
  plans.push('保持每日清洁打卡，及时录入出入库与借阅台账');

  return { summary, issue: issues.join('；') || '本周无突出问题。', plan: plans.join('；') + '。' };
}

function getReport(weekStartInput) {
  const weekStart = weekStartOrThrow(weekStartInput);
  const stats = statsFor(weekStart);
  const saved = db.prepare('SELECT * FROM reports WHERE week_start = ?').get(weekStart);
  const hasText = !!(saved && (saved.summary || saved.issue || saved.plan));
  return {
    ...stats,
    generated: hasText,
    saved: saved
      ? { summary: saved.summary, issue: saved.issue, plan: saved.plan, updatedAt: saved.updated_at }
      : { summary: '', issue: '', plan: '', updatedAt: null },
    suggest: suggest(stats)
  };
}

function saveReport(weekStartInput, body) {
  const weekStart = weekStartOrThrow(weekStartInput);
  const clean = (v) => String(v == null ? '' : v).slice(0, 2000);
  db.prepare(
    `INSERT INTO reports (week_start, summary, issue, plan, updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(week_start) DO UPDATE SET summary=excluded.summary, issue=excluded.issue, plan=excluded.plan, updated_at=excluded.updated_at`
  ).run(weekStart, clean(body.summary), clean(body.issue), clean(body.plan), t.stamp());
  return getReport(weekStart);
}

function history(limit = 10) {
  const first = db.prepare(
    `SELECT MIN(d) d FROM (
       SELECT MIN(date) d FROM checkins
       UNION ALL SELECT MIN(substr(created_at,1,10)) FROM books
       UNION ALL SELECT MIN(substr(borrowed_at,1,10)) FROM borrows
     )`
  ).get().d;
  const start = t.weekStartOf(first || t.today());
  const out = [];
  let cursor = t.weekStartOf(t.today());
  while (out.length < limit && cursor >= start) {
    const s = statsFor(cursor);
    const rep = db.prepare('SELECT summary, issue, plan, updated_at FROM reports WHERE week_start = ?').get(cursor);
    out.push({
      weekStart: cursor,
      weekEnd: s.weekEnd,
      weekNo: s.weekNo,
      rangeLabel: s.rangeLabel,
      done: s.done,
      isCurrent: s.isCurrent,
      generated: !!(rep && (rep.summary || rep.issue || rep.plan)),
      checkinDays: s.checkinDays,
      inQty: s.inQty,
      outQty: s.outQty,
      borrowOut: s.borrowOut
    });
    cursor = t.addDays(cursor, -7);
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = { statsFor, getReport, saveReport, history, weekStartOrThrow, suggest };
