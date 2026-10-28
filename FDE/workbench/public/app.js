/* 工作台账 · 前端交互（对接后端 API） */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = {
    page: 'login',
    me: null,
    dash: null,
    books: [],
    bookStats: { total: 0, stock: 0, low: 0 },
    activeBook: null,
    borrowFilter: 'active',
    borrowCounts: { active: 0, overdue: 0, returned: 0 },
    checkinMonth: '',
    checkins: [],
    weekOffset: 0,
    week: null,
    pendingImage: null,
    pendingImageTime: '',
    uploading: false
  };

  var COLORS = ['#3E567A', '#2F5D50', '#6B5B3E', '#4A4458', '#7A4B3A', '#5A6B3B'];

  /* ---------------- 基础工具 ---------------- */
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-show'); }, 2200);
  }

  function openOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('is-open');
  }

  function closeOverlay(el) {
    if (el) el.classList.remove('is-open');
    if (el === $('#cam')) closeCamera();
  }

  function go(page) {
    state.page = page;
    var pages = ['login', 'home', 'checkin', 'books', 'borrow', 'reports', 'settings', 'book-detail'];
    pages.forEach(function (p) {
      var el = document.getElementById('page-' + p);
      if (el) el.classList.toggle('is-active', p === page);
    });
    var tabPages = ['home', 'checkin', 'books', 'borrow', 'reports'];
    $('#tabbar').classList.toggle('is-visible', tabPages.indexOf(page) > -1);
    $('#detail-bar').classList.toggle('is-visible', page === 'book-detail');
    var tabKey = page === 'book-detail' ? 'books' : page;
    $$('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.nav === tabKey); });
    $$('.overlay.is-open').forEach(function (o) { o.classList.remove('is-open'); });
    if ($('#cam').classList.contains('is-open')) closeCamera();
    window.scrollTo(0, 0);

    if (page === 'home') loadDashboard();
    if (page === 'checkin') loadCheckins(state.checkinMonth || currentMonth());
    if (page === 'books') loadBooks($('#book-search').value);
    if (page === 'borrow') loadBorrows();
    if (page === 'reports') loadReport();
    if (page === 'settings') renderSettings();
  }

  async function api(path, options) {
    var opts = options || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var res = await fetch(path, opts);
    if (res.status === 401) {
      showLogin();
      throw new Error('未登录');
    }
    var data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  /* ---------------- 日期工具 ---------------- */
  function todayStr() {
    return (state.me && state.me.today) || new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    return todayStr().slice(0, 7);
  }

  function parseD(s) {
    var p = String(s).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function fmtD(dt) {
    return dt.toISOString().slice(0, 10);
  }

  function addDays(s, n) {
    var d = parseD(s);
    d.setUTCDate(d.getUTCDate() + n);
    return fmtD(d);
  }

  function weekdayCN(s) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseD(s).getUTCDay()];
  }

  function diffDays(a, b) {
    return Math.round((parseD(b) - parseD(a)) / 86400000);
  }

  function relDate(s) {
    var d = diffDays(todayStr(), s);
    if (d === 0) return '今天';
    if (d === 1) return '昨天';
    return s.slice(5);
  }

  function maskPhone(p) {
    return String(p || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function photoSrc(file) {
    if (!file) return '';
    return file.charAt(0) === '/' ? file : '/' + file;
  }

  function greeting() {
    var h = Number(((state.me && state.me.serverTime) || '00:00').slice(11, 13));
    if (h < 6) return '夜深了';
    if (h < 11) return '上午好';
    if (h < 13) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  /* ---------------- 登录 ---------------- */
  function showLogin() {
    state.me = null;
    go('login');
    $('#login-password').value = '';
    $('#login-error').textContent = '';
    $('#page-login').classList.add('is-active');
  }

  async function login() {
    var password = $('#login-password').value.trim();
    var err = $('#login-error');
    if (!password) { err.textContent = '请输入密码'; return; }
    err.textContent = '';
    var btn = $('#login-btn');
    btn.disabled = true;
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password: password }) });
      await boot();
      toast('欢迎回来');
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function boot() {
    var me = await api('/api/me');
    state.me = me;
    state.checkinMonth = me.today.slice(0, 7);
    go('home');
  }

  /* ---------------- 工作台 ---------------- */
  async function loadDashboard() {
    try {
      var d = await api('/api/dashboard');
      state.dash = d;
      if (state.me) state.me.today = d.today;
      renderHome();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function renderHome() {
    var d = state.dash;
    if (!d) return;
    var serverTime = d.serverTime || '';
    $('#home-date').textContent = d.today + ' · ' + weekdayCN(d.today);
    $('#home-greet').textContent = greeting() + '，' + ((state.me && state.me.username) === 'admin' ? '你好' : state.me.username);

    var hero = '';
    if (d.todayCheck) {
      hero = '<div class="hero">' +
        '<div class="hero-top"><span class="hero-label">今日卫生打卡</span><span class="hero-status">已完成</span></div>' +
        '<div class="hero-main">' +
          '<div><div class="hero-time">' + d.todayCheck.taken_at.slice(11, 16) + '</div>' +
          '<div class="hero-sub">已拍照留存 · 时间水印</div></div>' +
          '<button class="hero-photo" data-open="camera" type="button" style="border:0">' +
            '<img src="' + photoSrc(d.todayCheck.photo) + '" alt="">' +
            '<span class="wm-mini">' + d.todayCheck.taken_at.slice(5, 16).replace(/-/g, '-') + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="hero-foot"><span>本周已打卡 ' + d.stats.checkinDays + ' 天</span>' +
        '<button class="hero-link" data-nav="checkin" type="button">查看记录 <svg class="icon icon-xs"><use href="#i-chev-r"/></svg></button></div>' +
      '</div>';
    } else {
      hero = '<div class="hero">' +
        '<div class="hero-top"><span class="hero-label">今日卫生打卡</span><span class="hero-status">待打卡</span></div>' +
        '<div class="hero-main is-pending">' +
          '<div><div class="hero-time">尚未打卡</div><div class="hero-sub">拍下打扫后的现场，自动加时间水印</div></div>' +
          '<button class="hero-action" data-open="camera" type="button">去拍照</button>' +
        '</div>' +
        '<div class="hero-foot"><span>本周已打卡 ' + d.stats.checkinDays + ' 天</span>' +
        '<button class="hero-link" data-nav="checkin" type="button">查看记录 <svg class="icon icon-xs"><use href="#i-chev-r"/></svg></button></div>' +
      '</div>';
    }
    $('#home-hero').innerHTML = hero;

    $('#stat-checkin').innerHTML = d.stats.checkinDays + '<span class="stat-unit">/' + d.stats.checkinDenom + '</span>';
    $('#stat-borrow').innerHTML = d.stats.activeBorrows + '<span class="stat-unit">册</span>';
    $('#stat-out').innerHTML = d.stats.weekOut + '<span class="stat-unit">册</span>';

    var alert = $('#home-alert');
    if (d.overdueList.length) {
      var o = d.overdueList[0];
      alert.hidden = false;
      $('#alert-title').textContent = d.stats.overdue + ' 本图书已逾期';
      $('#alert-sub').textContent = (o.dept || '未填部门') + ' · ' + o.person + ' · 逾期 ' + o.days + ' 天';
    } else {
      alert.hidden = true;
    }

    var rows = '';
    if (d.todayCheck) {
      rows += '<div class="list-row"><span class="list-ic ok"><svg class="icon"><use href="#i-check"/></svg></span>' +
        '<span class="list-main"><span class="list-title" style="display:block">卫生打卡完成</span>' +
        '<span class="list-sub" style="display:block">' + d.todayCheck.taken_at.slice(11, 16) + ' 拍摄</span></span>' +
        '<span class="list-time">今天</span></div>';
    }
    (d.recentRecords || []).slice(0, 4).forEach(function (r) {
      var isIn = r.type === 'in';
      rows += '<div class="list-row"><span class="list-ic">' +
        '<svg class="icon"><use href="#' + (isIn ? 'i-arrow-in' : 'i-arrow-out') + '"/></svg></span>' +
        '<span class="list-main"><span class="list-title" style="display:block">' + (isIn ? '入库' : '出库') + '《' + escapeHtml(r.title) + '》</span>' +
        '<span class="list-sub" style="display:block">' + r.qty + ' 册 · ' + (r.person ? escapeHtml(r.person) : '未填对接人') + '</span></span>' +
        '<span class="list-time">' + relDate(r.occurred_at.slice(0, 10)) + '</span></div>';
    });
    if (!rows) rows = '<div class="empty-tip" style="padding:18px">还没有记录，从上方快捷操作开始</div>';
    $('#home-recent').innerHTML = rows;
  }

  /* ---------------- 图书 ---------------- */
  async function loadBooks(q) {
    try {
      var data = await api('/api/books' + (q ? '?q=' + encodeURIComponent(q) : ''));
      state.books = data.list;
      state.bookStats = data.stats;
      renderBooks();
      renderLedger();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function stockTag(b) {
    if (b.stock === 0) return '<span class="stock-tag tag-out">无库存</span>';
    if (b.low) return '<span class="stock-tag tag-low">低库存</span>';
    return '<span class="stock-tag tag-ok">库存充足</span>';
  }

  function renderBooks() {
    $('#sum-books').textContent = state.bookStats.total;
    $('#sum-stock').textContent = state.bookStats.stock;
    $('#sum-low').textContent = state.bookStats.low;

    var wrap = $('#book-list');
    if (!state.books.length) {
      wrap.innerHTML = '<div class="empty-tip">还没有图书档案，点右上角「+」新增</div>';
      return;
    }
    wrap.innerHTML = state.books.map(function (b) {
      var color = COLORS[b.id % COLORS.length];
      return '<div class="book-card" data-book="' + b.id + '" role="button" tabindex="0">' +
        '<span class="cover" style="background:' + color + '">' + escapeHtml(b.cover) + '</span>' +
        '<span class="book-main">' +
          '<span class="book-title" style="display:block">' + escapeHtml(b.title) + '</span>' +
          '<span class="book-meta" style="display:block">' + escapeHtml(b.category || '未分类') + ' · ' +
            escapeHtml(b.location || '待分配') + (b.code ? ' · ' + escapeHtml(b.code) : '') + '</span>' +
          '<span class="book-bottom">' + stockTag(b) +
            '<span class="book-meta">库存 ' + b.stock + ' 册</span></span>' +
        '</span>' +
        '<svg class="icon icon-sm chev"><use href="#i-chev-r"/></svg>' +
      '</div>';
    }).join('');
  }

  async function renderLedger() {
    try {
      var data = await api('/api/records?limit=100');
      $('#ledger-body').innerHTML = data.list.map(function (r) {
        return '<tr>' +
          '<td class="num">' + r.occurred_at.slice(5, 10) + '</td>' +
          '<td>' + escapeHtml(r.title) + '</td>' +
          '<td class="' + (r.type === 'in' ? 'type-in' : 'type-out') + '">' + (r.type === 'in' ? '入库' : '出库') + '</td>' +
          '<td class="num">' + r.qty + ' 册</td>' +
          '<td>' + escapeHtml(r.person || '—') + '</td>' +
          '<td>' + escapeHtml(r.note || '—') + '</td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">暂无出入库记录</td></tr>';
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  async function openBook(id) {
    try {
      var data = await api('/api/books/' + id);
      state.activeBook = data;
      renderBookDetail();
      go('book-detail');
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function renderBookDetail() {
    var data = state.activeBook;
    if (!data) return;
    var b = data.book;
    var pct = Math.min(100, Math.round(b.stock / Math.max(b.warn * 4, 8) * 100));
    var barCls = b.stock === 0 ? 'out' : (b.low ? 'low' : '');
    var statusText = b.stock === 0 ? '已无库存' : (b.low ? '低于预警值' : '库存正常');
    var statusCls = b.stock === 0 ? 'tag-out' : (b.low ? 'tag-low' : 'tag-ok');
    var color = COLORS[b.id % COLORS.length];

    var records = data.records.slice(0, 8).map(function (r) {
      return '<div class="mini-row">' +
        '<span class="mini-main"><span class="mini-title">' + (r.type === 'in' ? '入库' : '出库') + ' ' + r.qty + ' 册</span>' +
        '<span class="mini-sub">' + r.occurred_at.slice(0, 16) + ' · ' + escapeHtml(r.person || '未填对接人') + '</span></span>' +
        '<span class="mini-tag ' + (r.type === 'in' ? 'type-in' : 'type-out') + '">' + (r.type === 'in' ? '+' : '-') + r.qty + '</span>' +
      '</div>';
    }).join('') || '<div class="empty-tip">暂无出入库记录</div>';

    var borrowRows = data.borrows.slice(0, 6).map(function (x) {
      var status = x.returned_at ? '已归还' : (x.due_at < todayStr() ? '已逾期' : '借出中');
      var cls = x.returned_at ? '' : (x.due_at < todayStr() ? 'long-flag' : '');
      return '<div class="mini-row">' +
        '<span class="mini-main"><span class="mini-title">' + escapeHtml(x.person) + ' · ' + escapeHtml(x.dept || '未填部门') + '</span>' +
        '<span class="mini-sub">借出 ' + x.borrowed_at.slice(0, 10) + ' · 应还 ' + x.due_at + '</span></span>' +
        '<span class="mini-tag ' + cls + '">' + status + '</span>' +
      '</div>';
    }).join('') || '<div class="empty-tip">暂无借阅记录</div>';

    $('#book-detail-content').innerHTML =
      '<div class="detail-top">' +
        '<div class="detail-cover" style="background:' + color + '">' + escapeHtml(b.cover) + '</div>' +
        '<div class="detail-main">' +
          '<div class="detail-title">' + escapeHtml(b.title) + '</div>' +
          '<div class="detail-tags"><span class="detail-tag">' + escapeHtml(b.category || '未分类') + '</span>' +
            '<span class="stock-tag ' + statusCls + '">' + statusText + '</span></div>' +
          '<div class="detail-sub">' + (b.code ? '编号 ' + escapeHtml(b.code) + ' · ' : '') + '存放于 ' + escapeHtml(b.location || '待分配') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="info-grid">' +
        '<div class="info-cell"><div class="info-label">入库累计</div><div class="info-value">' + b.total_in + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">出库累计</div><div class="info-value">' + b.total_out + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">在借未还</div><div class="info-value">' + b.lent + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">预警值</div><div class="info-value">' + b.warn + ' 册</div></div>' +
      '</div>' +
      '<div class="stock-card">' +
        '<div class="stock-top"><span>当前可用库存</span><strong>' + b.stock + ' 册</strong></div>' +
        '<div class="stock-bar"><span class="' + barCls + '" style="width:' + pct + '%"></span></div>' +
        (b.low ? '<div class="stock-warn">' + (b.stock === 0 ? '库存已用完，请尽快补充' : '库存低于预警值 ' + b.warn + ' 册，建议补充') + '</div>' : '') +
      '</div>' +
      (b.note ? '<div class="detail-note">备注：' + escapeHtml(b.note) + '</div>' : '') +
      '<div class="section-head"><span class="section-title">最近出入库</span></div>' +
      '<div class="mini-card">' + records + '</div>' +
      '<div class="section-head"><span class="section-title">借阅记录</span></div>' +
      '<div class="mini-card">' + borrowRows + '</div>';
  }

  /* ---------------- 借阅 ---------------- */
  async function loadBorrows() {
    try {
      var data = await api('/api/borrows?status=' + state.borrowFilter);
      state.borrowCounts = data.counts;
      renderBorrows(data.list);
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function renderBorrows(list) {
    $('#cnt-active').textContent = state.borrowCounts.active;
    $('#cnt-overdue').textContent = state.borrowCounts.overdue;
    $('#cnt-returned').textContent = state.borrowCounts.returned;

    var wrap = $('#borrow-list');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-tip">当前分类没有记录</div>';
      return;
    }
    wrap.innerHTML = list.map(function (b) {
      var overdue = b.status === 'overdue';
      var returned = b.status === 'returned';
      var tag = returned ? '已归还' : (overdue ? '逾期 ' + b.overdueDays + ' 天' : '借出中');
      return '<div class="borrow-card ' + (overdue ? 'is-overdue' : '') + '">' +
        '<div class="borrow-top">' +
          '<div class="borrow-book">' + escapeHtml(b.title) + '</div>' +
          '<span class="borrow-tag ' + (returned ? 'tag-ok' : (overdue ? 'tag-out' : 'tag-low')) + '">' + tag + '</span>' +
        '</div>' +
        '<div class="borrow-info">' +
          '<span>' + escapeHtml(b.dept || '未填部门') + '</span><span>' + escapeHtml(b.person) + '</span>' +
          '<span>' + maskPhone(b.phone) + '</span>' +
        '</div>' +
        '<div class="borrow-dates">' +
          '<span>借出 <b>' + b.borrowed_at.slice(0, 10) + '</b></span>' +
          '<span>应还 <b>' + b.due_at + '</b></span>' +
          (returned ? '<span>归还 <b>' + b.returned_at.slice(0, 10) + '</b></span>' : '') +
        '</div>' +
        (returned ? '' : '<button class="btn btn-ghost btn-block borrow-return" data-return="' + b.id + '" type="button">办理归还</button>') +
      '</div>';
    }).join('');
  }

  async function returnBook(id) {
    try {
      var r = await api('/api/borrows/' + id + '/return', { method: 'POST', body: '{}' });
      toast('已归还《' + r.borrow.title + '》');
      await loadBorrows();
      loadDashboard();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  /* ---------------- 打卡 ---------------- */
  async function loadCheckins(month) {
    try {
      var data = await api('/api/checkins?month=' + month);
      state.checkinMonth = month;
      state.checkins = data.list;
      renderCalendar();
      renderTodayCard();
      renderCheckinList();
      renderHomeIfNeeded();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function renderTodayCard() {
    var today = todayStr();
    var c = state.checkins.filter(function (x) { return x.date === today; })[0];
    var wrap = $('#today-card-wrap');
    if (!c) {
      wrap.innerHTML = '<div class="empty-report" style="margin-bottom:4px">' +
        '<div class="empty-ic"><svg class="icon"><use href="#i-camera"/></svg></div>' +
        '<div class="empty-title">今天还没有打卡</div>' +
        '<p class="camera-tip" style="margin-top:6px">点下方按钮拍摄打扫后的现场</p></div>';
      return;
    }
    wrap.innerHTML = '<div class="today-card">' +
      '<div class="today-photo"><img src="' + photoSrc(c.photo) + '" alt="">' +
        '<div class="watermark"><strong>' + c.taken_at.slice(0, 16) + '</strong>服务器时间水印 · 卫生打卡</div>' +
      '</div>' +
      '<div class="today-body"><div class="today-row"><div>' +
        '<div class="today-title"><svg class="icon icon-sm"><use href="#i-check"/></svg> 今日已完成</div>' +
        '<div class="today-meta">' + c.taken_at.slice(11, 16) + ' 拍摄 · ' + (c.note || '时间水印已生成') + '</div>' +
      '</div><button class="again-btn" data-open="camera" type="button">再次打卡</button></div></div>' +
    '</div>';
  }

  function renderCalendar() {
    var month = state.checkinMonth;
    var parts = month.split('-').map(Number);
    var first = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
    var days = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
    var lead = (first.getUTCDay() + 6) % 7;
    var today = todayStr();
    var checked = {};
    state.checkins.forEach(function (c) { checked[c.date] = true; });

    $('#cal-title').textContent = parts[0] + '年' + parts[1] + '月';
    $('#cal-rate').textContent = '已打卡 ' + state.checkins.length + ' 天';
    $('#checkin-count').textContent = '共 ' + state.checkins.length + ' 次';

    var html = ['一', '二', '三', '四', '五', '六', '日'].map(function (w) {
      return '<div class="cal-wd">' + w + '</div>';
    }).join('');
    for (var i = 0; i < lead; i++) html += '<div class="cal-day is-empty"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = month + '-' + (d < 10 ? '0' + d : d);
      var cls = 'cal-day';
      if (checked[ds]) cls += ' is-done';
      else if (ds < today) cls += ' is-miss';
      if (ds === today) cls += ' is-today';
      if (ds > today) cls += ' is-future';
      html += '<div class="' + cls + '"><span>' + d + '</span></div>';
    }
    $('#calendar-grid').innerHTML = html;
  }

  function renderCheckinList() {
    var wrap = $('#checkin-list');
    if (!state.checkins.length) {
      wrap.innerHTML = '<div class="empty-tip">本月还没有打卡记录</div>';
      return;
    }
    wrap.innerHTML = state.checkins.map(function (c) {
      return '<div class="check-row">' +
        '<div class="check-thumb"><img src="' + photoSrc(c.photo) + '" alt="" loading="lazy">' +
          '<span class="thumb-wm">' + c.date.slice(5) + ' ' + c.taken_at.slice(11, 16) + '</span></div>' +
        '<div class="check-main"><div class="check-date">' + c.date + ' · ' + weekdayCN(c.date) + '</div>' +
          '<div class="check-sub">' + c.taken_at.slice(11, 16) + ' 拍摄</div></div>' +
        '<span class="check-ok">已打卡</span>' +
      '</div>';
    }).join('');
  }

  function renderHomeIfNeeded() {
    if (state.page === 'home' && state.dash) {
      state.dash.todayCheck = state.checkins.filter(function (c) { return c.date === todayStr(); })[0] || null;
      renderHome();
    }
  }

  /* ---------------- 相机 ---------------- */
  function openCamera() {
    state.pendingImage = null;
    state.pendingImageTime = (state.me && state.me.serverTime) || '';
    $('#cam').classList.add('is-open');
    $('#cam-pick').classList.remove('is-off');
    $('#cam-result').classList.remove('is-on');
    $('#cam-preview').removeAttribute('src');
  }

  function closeCamera() {
    $('#cam').classList.remove('is-open');
    state.pendingImage = null;
    $('#cam-file').value = '';
  }

  function pickPhoto() {
    $('#cam-file').click();
  }

  function handlePhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('请选择照片'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        state.pendingImage = canvas.toDataURL('image/jpeg', 0.86);
        $('#cam-preview').src = state.pendingImage;
        $('#cam-wm').innerHTML = '<strong>' + (state.pendingImageTime || '') + '</strong>服务器时间水印 · 卫生打卡';
        $('#cam-pick').classList.add('is-off');
        $('#cam-result').classList.add('is-on');
      };
      img.onerror = function () { toast('照片读取失败，请重试'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function uploadCheckin() {
    if (!state.pendingImage || state.uploading) return;
    var btn = $('#cam-use');
    state.uploading = true;
    btn.disabled = true;
    btn.textContent = '上传中…';
    try {
      await api('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({ image: state.pendingImage })
      });
      closeCamera();
      toast('打卡成功，已生成服务器时间水印');
      await loadCheckins(currentMonth());
      await loadDashboard();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    } finally {
      state.uploading = false;
      btn.disabled = false;
      btn.textContent = '上传打卡';
    }
  }

  /* ---------------- 周报 ---------------- */
  function currentWeekStart() {
    return (state.me && state.me.weekStart) || todayStr();
  }

  function weekStartForOffset(offset) {
    return addDays(currentWeekStart(), offset * 7);
  }

  async function loadReport() {
    try {
      var ws = weekStartForOffset(state.weekOffset);
      var week = await api('/api/reports/' + ws);
      state.week = week;
      renderReportPage(week);
      renderHistory();
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function reportText(week) {
    var s = week.saved || {};
    var d = week.suggest || {};
    return {
      summary: (s.summary || '').trim() || d.summary || '',
      issue: (s.issue || '').trim() || d.issue || '',
      plan: (s.plan || '').trim() || d.plan || '',
      edited: !!(s.updatedAt)
    };
  }

  function renderReportPage(week) {
    $('#week-label').textContent = week.rangeLabel;
    $('#week-tag').textContent = week.isCurrent ? '本周 · 进行中' : '第 ' + week.weekNo + ' 周';
    $('#week-next').disabled = state.weekOffset >= 0;
    $('#kpi-rate').innerHTML = week.checkinDays + '/' + week.denom + '<small>天</small>';
    $('#kpi-in').innerHTML = week.inQty + '<small>册</small>';
    $('#kpi-out').innerHTML = week.outQty + '<small>册</small>';
    $('#kpi-borrow').innerHTML = week.borrowOut + '<small>册</small>';

    var text = reportText(week);
    var photos = (week.photos || []).slice(0, 3);
    var photoStrip = photos.length
      ? '<div class="photo-strip">' + photos.map(function (p) {
          return '<div class="ph"><img src="' + photoSrc(p.file) + '" alt="" loading="lazy"></div>';
        }).join('') + '</div>'
      : '';

    $('#report-preview').innerHTML =
      '<div class="report-card">' +
        '<div class="report-head">' +
          '<div><div class="report-kicker">WEEKLY REPORT</div>' +
            '<div class="report-title">' + (week.isCurrent ? '本周工作周报' : '第 ' + week.weekNo + ' 周工作周报') + '</div>' +
            '<div class="report-date">' + week.rangeLabel + '</div></div>' +
          '<div class="report-rate"><strong>' + week.checkinRate + '%</strong><span>打卡率</span></div>' +
        '</div>' +
        '<div class="report-body">' +
          photoStrip +
          '<p class="report-summary">' + escapeHtml(text.summary) + '</p>' +
          '<div class="report-tags">' +
            '<span class="report-chip">入库 ' + week.inQty + ' 册</span>' +
            '<span class="report-chip">出库 ' + week.outQty + ' 册</span>' +
            '<span class="report-chip">借出 ' + week.borrowOut + ' 单</span>' +
            '<span class="report-chip' + (week.overdue.length ? ' is-warn' : '') + '">逾期 ' + week.overdue.length + ' 单</span>' +
          '</div>' +
          '<button class="btn btn-ghost btn-block" data-open="report" type="button" style="margin-top:12px">预览完整长图</button>' +
        '</div>' +
      '</div>' +
      '<p class="report-note">' + (text.edited ? '文字已手动保存 · ' : '文字为自动生成草稿，可点「编辑小结」修改 · ') +
        '自动统计截至 ' + todayStr() + '</p>';

    $('#btn-edit').disabled = false;
  }

  async function renderHistory() {
    try {
      var data = await api('/api/reports/history?limit=10');
      var cur = currentWeekStart();
      $('#report-history').innerHTML = data.list.map(function (w) {
        var off = diffDays(w.weekStart, cur) / 7;
        return '<button class="history-row" data-week-offset="' + off + '" type="button">' +
          '<span class="history-date">' + (w.isCurrent ? '本周 · ' : '第 ' + w.weekNo + ' 周 · ') + w.rangeLabel + '</span>' +
          '<span class="history-ok">' + (w.generated ? '已撰写' : (w.done ? '待生成' : '进行中')) + '</span>' +
          '<svg class="icon icon-sm chev"><use href="#i-chev-r"/></svg>' +
        '</button>';
      }).join('');
    } catch (e) {
      if (e.message !== '未登录') toast(e.message);
    }
  }

  function buildLong(week) {
    var text = reportText(week);
    var missing = week.denom - week.checkinDays;
    var photos = (week.photos || []).slice(0, 6).map(function (p) {
      return '<div class="long-ph"><img src="' + photoSrc(p.file) + '" alt=""><em>' + p.date.slice(5) + '</em></div>';
    }).join('') || '<div class="long-note">本周暂无打卡照片</div>';
    var overdue = week.overdue.length
      ? week.overdue.map(function (o) {
          return '<tr><td>' + escapeHtml(o.dept || '—') + '</td><td>' + escapeHtml(o.person) + '</td><td>' + escapeHtml(o.title) + '</td><td class="long-flag">' + o.days + ' 天</td></tr>';
        }).join('')
      : '<tr><td colspan="4" style="color:var(--muted)">本周无逾期</td></tr>';
    var low = week.lowBooks.length
      ? '低库存预警：' + week.lowBooks.slice(0, 4).map(function (b) { return b.title + '（剩 ' + b.stock + ' 册）'; }).join('、')
      : '库存充足，无预警';

    return '<div class="long">' +
      '<div class="long-head">' +
        '<div class="long-kicker">日常工作台账 · 工作周报</div>' +
        '<div class="long-title">' + (week.isCurrent ? '本周工作周报' : '第 ' + week.weekNo + ' 周工作周报') + '</div>' +
        '<div class="long-range">' + week.rangeLabel + '</div>' +
        '<div class="long-badge">打卡率 ' + week.checkinRate + '% · ' + (missing > 0 ? '缺卡 ' + missing + ' 天' : '全勤') + '</div>' +
      '</div>' +
      '<div class="long-body">' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">01</span><h3>卫生打卡</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + week.denom + '</strong><span>应打卡（天）</span></div>' +
            '<div class="long-stat"><strong>' + week.checkinDays + '</strong><span>实际打卡（天）</span></div>' +
            '<div class="long-stat"><strong>' + Math.max(0, missing) + '</strong><span>缺卡（天）</span></div>' +
          '</div>' +
          '<div class="long-photos">' + photos + '</div>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">02</span><h3>图书资料</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + week.inQty + '</strong><span>入库（' + week.inCount + ' 笔）</span></div>' +
            '<div class="long-stat"><strong>' + week.outQty + '</strong><span>出库（' + week.outCount + ' 笔）</span></div>' +
            '<div class="long-stat"><strong>' + week.stockTotal + '</strong><span>当前库存（册）</span></div>' +
          '</div>' +
          '<div class="long-note">' + escapeHtml(low) + '</div>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">03</span><h3>图书借阅</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + week.borrowOut + '</strong><span>借出（单）</span></div>' +
            '<div class="long-stat"><strong>' + week.borrowReturn + '</strong><span>归还（单）</span></div>' +
            '<div class="long-stat"><strong>' + week.onLoan + '</strong><span>在借（单）</span></div>' +
          '</div>' +
          '<table class="long-table"><thead><tr><th>部门</th><th>对接人</th><th>书刊</th><th>逾期</th></tr></thead><tbody>' + overdue + '</tbody></table>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">04</span><h3>本周总结</h3></div>' +
          '<div class="long-text"><b>本周小结</b>' + escapeHtml(text.summary) + '</div>' +
          '<div class="long-text"><b>存在问题</b>' + escapeHtml(text.issue) + '</div>' +
          '<div class="long-text"><b>下周计划</b>' + escapeHtml(text.plan) + '</div>' +
        '</div>' +
        '<div class="long-footer">工作台账 · ' + todayStr() + ' 生成</div>' +
      '</div>' +
    '</div>';
  }

  function openReport() {
    if (!state.week) return;
    $('#report-long').innerHTML = buildLong(state.week);
    $('#report-overlay').classList.add('is-open');
    $('.ro-scroll').scrollTop = 0;
  }

  function closeReport() {
    $('#report-overlay').classList.remove('is-open');
    $('#report-saving') && ($('#report-saving').hidden = true);
  }

  function openEditReport() {
    var week = state.week;
    if (!week) return;
    var text = reportText(week);
    $('#edit-summary').value = text.summary;
    $('#edit-issue').value = text.issue;
    $('#edit-plan').value = text.plan;
    openOverlay('ov-edit');
  }

  async function saveReportText(e) {
    e.preventDefault();
    if (!state.week) return;
    try {
      var week = await api('/api/reports/' + weekStartForOffset(state.weekOffset), {
        method: 'PUT',
        body: JSON.stringify({
          summary: $('#edit-summary').value.trim(),
          issue: $('#edit-issue').value.trim(),
          plan: $('#edit-plan').value.trim()
        })
      });
      state.week = week;
      closeOverlay($('#ov-edit'));
      renderReportPage(week);
      renderHistory();
      toast('周报文字已保存');
    } catch (err) {
      if (err.message !== '未登录') toast(err.message);
    }
  }

  async function saveReportImage() {
    if (!state.week) return;
    var btn = $('#report-save');
    var target = $('#report-long');
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = '生成中…';
    try {
      var canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: target.scrollWidth
      });
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png', 0.95); });
      if (!blob) throw new Error('长图生成失败');
      var name = '工作周报-' + state.week.weekStart + '.png';
      var file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '工作周报' });
        toast('已打开分享，可保存到相册');
      } else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast('长图已开始下载');
      }
    } catch (e) {
      if (e && e.name !== 'AbortError') toast(e.message || '生成失败，请重试');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  /* ---------------- 表单 ---------------- */
  async function openStock(type, bookId) {
    type = type || 'in';
    if (!state.books.length) { toast('请先新增图书档案'); openNewBook(); return; }
    try { await loadBooks(''); } catch (_) {}
    var sel = $('#stock-book');
    sel.innerHTML = state.books.map(function (b) {
      return '<option value="' + b.id + '">' + escapeHtml(b.title) + '（库存 ' + b.stock + '）</option>';
    }).join('');
    if (bookId) sel.value = String(bookId);
    setStockType(type);
    $('#stock-qty').value = 1;
    $('#stock-person').value = '';
    $('#stock-note').value = '';
    $('#stock-date').value = todayStr();
    openOverlay('ov-stock');
  }

  function setStockType(type) {
    $$('#stock-seg [data-stock-type]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.stockType === type);
    });
    $('#stock-type').value = type;
    $('#stock-sheet-title').textContent = type === 'in' ? '图书入库' : '图书出库';
  }

  async function submitStock(e) {
    e.preventDefault();
    var id = $('#stock-book').value;
    var type = $('#stock-type').value;
    var qty = parseInt($('#stock-qty').value, 10);
    if (!qty || qty < 1) { toast('请输入正确的数量'); return; }
    try {
      var r = await api('/api/books/' + id + '/stock', {
        method: 'POST',
        body: JSON.stringify({
          type: type,
          qty: qty,
          person: $('#stock-person').value.trim(),
          note: $('#stock-note').value.trim(),
          occurredAt: $('#stock-date').value || todayStr()
        })
      });
      closeOverlay($('#ov-stock'));
      toast((type === 'in' ? '入库' : '出库') + '成功，当前库存 ' + r.book.stock + ' 册');
      await loadBooks($('#book-search').value);
      if (state.page === 'book-detail' && Number(id) === Number(state.activeBook && state.activeBook.book.id)) {
        await openBook(id);
        go('book-detail');
      }
      loadDashboard();
    } catch (err) {
      if (err.message !== '未登录') toast(err.message);
    }
  }

  function openNewBook() {
    $('#book-title').value = '';
    $('#book-cat').selectedIndex = 0;
    $('#book-loc').value = '';
    $('#book-code').value = '';
    $('#book-warn').value = 5;
    $('#book-qty').value = 10;
    $('#book-person').value = '';
    $('#book-note').value = '';
    openOverlay('ov-book');
  }

  async function submitBook(e) {
    e.preventDefault();
    var title = $('#book-title').value.trim();
    if (!title) { toast('请填写书刊名称'); return; }
    try {
      await api('/api/books', {
        method: 'POST',
        body: JSON.stringify({
          title: title,
          category: $('#book-cat').value,
          location: $('#book-loc').value.trim(),
          code: $('#book-code').value.trim(),
          warn: parseInt($('#book-warn').value, 10) || 5,
          note: $('#book-note').value.trim(),
          qty: parseInt($('#book-qty').value, 10) || 0,
          person: $('#book-person').value.trim()
        })
      });
      closeOverlay($('#ov-book'));
      toast('图书档案已保存');
      await loadBooks($('#book-search').value);
      loadDashboard();
    } catch (err) {
      if (err.message !== '未登录') toast(err.message);
    }
  }

  async function openBorrowForm() {
    try { await loadBooks(''); } catch (_) {}
    var available = state.books.filter(function (b) { return b.stock > 0; });
    if (!available.length) { toast('暂无可借图书，请先入库'); return; }
    $('#borrow-book').innerHTML = available.map(function (b) {
      return '<option value="' + b.id + '">' + escapeHtml(b.title) + '（可借 ' + b.stock + '）</option>';
    }).join('');
    $('#borrow-name').value = '';
    $('#borrow-phone').value = '';
    $('#borrow-out').value = todayStr();
    $('#borrow-due').value = addDays(todayStr(), 14);
    openOverlay('ov-borrow');
  }

  async function submitBorrow(e) {
    e.preventDefault();
    var name = $('#borrow-name').value.trim();
    if (!name) { toast('请填写对接人'); return; }
    var phone = $('#borrow-phone').value.trim();
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) { toast('请输入 11 位手机号'); return; }
    try {
      var r = await api('/api/borrows', {
        method: 'POST',
        body: JSON.stringify({
          bookId: Number($('#borrow-book').value),
          dept: $('#borrow-dept').value,
          person: name,
          phone: phone,
          borrowedAt: $('#borrow-out').value || todayStr(),
          dueAt: $('#borrow-due').value || addDays(todayStr(), 14)
        })
      });
      closeOverlay($('#ov-borrow'));
      state.borrowFilter = 'active';
      $$('#borrow-seg [data-filter]').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.filter === 'active');
      });
      toast('已借出《' + r.borrow.title + '》');
      await loadBorrows();
      loadDashboard();
    } catch (err) {
      if (err.message !== '未登录') toast(err.message);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    var oldPwd = $('#pwd-old').value;
    var next = $('#pwd-next').value;
    if (next.length < 6) { toast('新密码至少 6 位'); return; }
    if (next !== $('#pwd-confirm').value) { toast('两次输入的新密码不一致'); return; }
    try {
      await api('/api/password', { method: 'POST', body: JSON.stringify({ old: oldPwd, next: next }) });
      closeOverlay($('#ov-password'));
      await api('/api/logout', { method: 'POST', body: '{}' });
      showLogin();
      toast('密码已修改，请重新登录');
    } catch (err) {
      if (err.message !== '未登录') toast(err.message);
    }
  }

  /* ---------------- 设置 ---------------- */
  async function renderSettings() {
    if (state.me) {
      $('#server-time').textContent = (state.me.serverTime || '').slice(0, 16);
    }
    try {
      var s = await api('/api/storage');
      $('#photo-size').textContent = s.photos + ' 张 · ' + s.size;
    } catch (_) {
      $('#photo-size').textContent = '—';
    }
  }

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch (_) {}
    showLogin();
    toast('已退出登录');
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    var ret = e.target.closest('[data-return]');
    if (ret) { returnBook(ret.dataset.return); return; }

    var open = e.target.closest('[data-open]');
    if (open) {
      var kind = open.dataset.open;
      if (kind === 'stock') openStock(open.dataset.type || 'in', open.dataset.bookId || null);
      else if (kind === 'new-book') openNewBook();
      else if (kind === 'borrow') openBorrowForm();
      else if (kind === 'camera') openCamera();
      else if (kind === 'report') openReport();
      return;
    }

    var book = e.target.closest('[data-book]');
    if (book) { openBook(book.dataset.book); return; }

    var off = e.target.closest('[data-week-offset]');
    if (off) {
      state.weekOffset = parseInt(off.dataset.weekOffset, 10) || 0;
      loadReport();
      window.scrollTo(0, 0);
      return;
    }

    var close = e.target.closest('[data-close]');
    if (close) { closeOverlay(close.closest('.overlay')); return; }

    var toastEl = e.target.closest('[data-toast]');
    if (toastEl) { toast(toastEl.dataset.toast); return; }

    if (e.target.classList.contains('overlay')) closeOverlay(e.target);
  });

  /* 登录 */
  $('#login-btn').addEventListener('click', login);
  $('#login-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });

  /* 搜索 */
  var searchTimer = null;
  $('#book-search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { loadBooks(e.target.value.trim()); }, 220);
  });

  /* 图书视图切换 */
  $$('#book-seg [data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('#book-seg [data-view]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var isList = btn.dataset.view === 'list';
      $('#book-list').style.display = isList ? 'block' : 'none';
      $('#ledger-view').style.display = isList ? 'none' : 'block';
      if (!isList) renderLedger();
    });
  });

  /* 借阅筛选 */
  $$('#borrow-seg [data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('#borrow-seg [data-filter]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.borrowFilter = btn.dataset.filter;
      loadBorrows();
    });
  });

  /* 周报周切换 */
  $('#week-prev').addEventListener('click', function () {
    state.weekOffset -= 1;
    loadReport();
  });
  $('#week-next').addEventListener('click', function () {
    if (state.weekOffset < 0) { state.weekOffset += 1; loadReport(); }
  });
  $('#btn-generate').addEventListener('click', openReport);
  $('#btn-edit').addEventListener('click', openEditReport);
  $('#report-close').addEventListener('click', closeReport);
  $('#report-back').addEventListener('click', closeReport);
  $('#report-save').addEventListener('click', saveReportImage);

  /* 设置 */
  $$('[data-switch]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-checked') === 'true';
      btn.setAttribute('aria-checked', on ? 'false' : 'true');
    });
  });
  $('#logout-btn').addEventListener('click', logout);
  $('#password-row').addEventListener('click', function () {
    $('#pwd-old').value = '';
    $('#pwd-next').value = '';
    $('#pwd-confirm').value = '';
    openOverlay('ov-password');
  });
  $('#backup-row').addEventListener('click', function () {
    toast('正在打包数据，请稍候…');
    location.href = '/api/backup';
  });
  $('#clear-photos-row').addEventListener('click', function () {
    toast('照片会随「数据备份」一起打包，不会自动清理');
  });
  $('#about-row').addEventListener('click', function () {
    toast('所有时间均以服务器为准');
  });

  /* 打卡日历 */
  $('#cal-prev').addEventListener('click', function () {
    state.checkinMonth = shiftMonth(state.checkinMonth, -1);
    loadCheckins(state.checkinMonth);
  });
  $('#cal-next').addEventListener('click', function () {
    var next = shiftMonth(state.checkinMonth, 1);
    if (next > currentMonth()) { toast('还没有到下个月'); return; }
    state.checkinMonth = next;
    loadCheckins(state.checkinMonth);
  });

  function shiftMonth(month, delta) {
    var p = month.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  }

  /* 相机 */
  $('#cam-close').addEventListener('click', closeCamera);
  $('#cam-open').addEventListener('click', pickPhoto);
  $('#cam-file').addEventListener('change', function (e) { handlePhoto(e.target.files[0]); });
  $('#cam-retry').addEventListener('click', function () {
    state.pendingImage = null;
    $('#cam-file').value = '';
    $('#cam-pick').classList.remove('is-off');
    $('#cam-result').classList.remove('is-on');
  });
  $('#cam-use').addEventListener('click', uploadCheckin);

  /* 表单 */
  $('#form-stock').addEventListener('submit', submitStock);
  $('#form-book').addEventListener('submit', submitBook);
  $('#form-borrow').addEventListener('submit', submitBorrow);
  $('#form-report').addEventListener('submit', saveReportText);
  $('#form-password').addEventListener('submit', savePassword);

  /* 入库类型切换 */
  $$('#stock-seg [data-stock-type]').forEach(function (btn) {
    btn.addEventListener('click', function () { setStockType(btn.dataset.stockType); });
  });

  /* 详情页底部操作 */
  $('#detail-in').addEventListener('click', function () {
    if (state.activeBook) openStock('in', state.activeBook.book.id);
  });
  $('#detail-out').addEventListener('click', function () {
    if (state.activeBook) openStock('out', state.activeBook.book.id);
  });

  /* 图片错误兜底 */
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.target.classList.add('img-broken');
      if (e.target.parentElement) e.target.parentElement.classList.add('no-img');
    }
  }, true);

  /* 启动 */
  (async function init() {
    try {
      await boot();
    } catch (_) {
      showLogin();
    }
  })();
})();
