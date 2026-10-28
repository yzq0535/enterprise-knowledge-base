/* 时区与日期工具：统一使用 Asia/Shanghai，所有时间以服务器为准 */
const TZ = process.env.APP_TZ || 'Asia/Shanghai';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

function parts(d = new Date()) {
  const o = {};
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** 2026-10-28 */
function dateStr(d = new Date()) {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 2026-10-28 08:12:33 */
function stamp(d = new Date()) {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** 08:12 */
function hhmm(d = new Date()) {
  const p = parts(d);
  return `${p.hour}:${p.minute}`;
}

function today() {
  return dateStr();
}

/** 解析 YYYY-MM-DD 为 UTC 零点，仅用于日期加减 */
function parseDate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatDate(dt) {
  return dt.toISOString().slice(0, 10);
}

function addDays(s, n) {
  const dt = parseDate(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return formatDate(dt);
}

/** 周一为一周的开始 */
function weekStartOf(s = today()) {
  const dt = parseDate(s);
  const wd = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (wd - 1));
  return formatDate(dt);
}

/** 该日期所在周的周日 */
function weekEndOf(s = today()) {
  return addDays(weekStartOf(s), 6);
}

/** ISO 周序号 */
function weekNo(s = today()) {
  const dt = parseDate(s);
  const target = new Date(dt.valueOf());
  const dayNr = (dt.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target - firstThursday;
  return 1 + Math.round(diff / (7 * 86400000));
}

/** 10月26日 */
function cnDate(s) {
  const [, m, d] = s.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

/** 10月26日 — 11月1日 */
function rangeLabel(start, end) {
  const a = start.split('-');
  const b = end.split('-');
  if (a[0] === b[0]) return `${Number(a[1])}月${Number(a[2])}日 — ${Number(b[1])}月${Number(b[2])}日`;
  return `${Number(a[1])}月${Number(a[2])}日 — ${Number(b[1])}月${Number(b[2])}日`;
}

function weekdayCN(s) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDate(s).getUTCDay()];
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000) + 1;
}

/** 当前时间向前偏移的周起点，offset=0 本周，-1 上周 */
function weekStartOffset(offset) {
  return addDays(weekStartOf(today()), offset * 7);
}

module.exports = {
  TZ, dateStr, stamp, hhmm, today, addDays, weekStartOf, weekEndOf, weekNo,
  cnDate, rangeLabel, weekdayCN, daysBetween, weekStartOffset, parseDate
};
