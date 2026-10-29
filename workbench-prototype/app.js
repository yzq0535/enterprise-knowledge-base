/* 工作台账 · 高保真原型交互 */
(function () {
  'use strict';

  var PHOTOS = {
    office: 'assets/office.jpg',
    library: 'assets/library.jpg',
    corridor: 'assets/corridor.jpg',
    meeting: 'assets/meeting.jpg',
    archive: 'assets/archive.jpg'
  };

  var state = {
    page: 'login',
    activeBook: null,
    borrowFilter: 'active',
    weekIndex: 1,
    books: [
      { id: 'b1', title: '市政工程年鉴 2025', cat: '年鉴', no: 'TN-2025-018', loc: 'A区 3 排', stock: 12, warn: 5, totalIn: 20, totalOut: 7, lent: 1, color: '#3E567A', note: '年度工具书，仅限室内查阅，借阅需登记。' },
      { id: 'b2', title: '机关档案管理规范', cat: '规范', no: 'GF-2024-006', loc: 'A区 1 排', stock: 3, warn: 5, totalIn: 20, totalOut: 17, lent: 0, color: '#2F5D50', note: '常用规范，库存偏低，建议尽快补货。' },
      { id: 'b3', title: '公文写作规范', cat: '工具书', no: 'GJ-2023-011', loc: 'B区 2 排', stock: 0, warn: 3, totalIn: 10, totalOut: 9, lent: 1, color: '#6B5B3E', note: '已全部借出或发放，等待归还。' },
      { id: 'b4', title: '公共图书馆服务规范', cat: '规范', no: 'GF-2024-012', loc: 'A区 2 排', stock: 8, warn: 3, totalIn: 12, totalOut: 3, lent: 1, color: '#4A4458', note: '业务学习用书，按科室轮借。' },
      { id: 'b5', title: '党支部工作手册', cat: '手册', no: 'SC-2025-003', loc: 'C区 1 排', stock: 25, warn: 10, totalIn: 30, totalOut: 4, lent: 1, color: '#7A4B3A', note: '党建学习用书，按支部发放。' },
      { id: 'b6', title: '办公自动化实务', cat: '教材', no: 'JC-2023-009', loc: 'B区 1 排', stock: 16, warn: 5, totalIn: 20, totalOut: 4, lent: 0, color: '#5A6B3B', note: '新员工培训教材。' }
    ],
    records: [
      { date: '2026-10-25', bookId: 'b1', type: 'in', qty: 20, person: '王科长', note: '年度新书到货' },
      { date: '2026-10-23', bookId: 'b2', type: 'in', qty: 20, person: '王科长', note: '集中采购' },
      { date: '2026-10-25', bookId: 'b2', type: 'out', qty: 17, person: '综合科', note: '科室发放' },
      { date: '2026-10-24', bookId: 'b3', type: 'out', qty: 9, person: '办公室', note: '培训资料' },
      { date: '2026-10-22', bookId: 'b1', type: 'out', qty: 7, person: '业务一科', note: '科室借阅' },
      { date: '2026-10-22', bookId: 'b5', type: 'in', qty: 30, person: '李主任', note: '党建学习用书' },
      { date: '2026-10-21', bookId: 'b6', type: 'out', qty: 4, person: '财务科', note: '培训领用' },
      { date: '2026-10-20', bookId: 'b4', type: 'out', qty: 3, person: '人事科', note: '业务学习' },
      { date: '2026-10-18', bookId: 'b4', type: 'in', qty: 12, person: '王科长', note: '补充库存' }
    ],
    borrows: [
      { id: 'r1', bookId: 'b1', book: '市政工程年鉴 2025', dept: '业务一科', name: '刘洋', phone: '138****6621', out: '2026-10-20', due: '2026-10-24', status: 'overdue' },
      { id: 'r2', bookId: 'b3', book: '公文写作规范', dept: '综合科', name: '张伟', phone: '139****2210', out: '2026-10-21', due: '2026-11-03', status: 'active' },
      { id: 'r3', bookId: 'b4', book: '公共图书馆服务规范', dept: '人事科', name: '周敏', phone: '137****9082', out: '2026-10-23', due: '2026-11-06', status: 'active' },
      { id: 'r4', bookId: 'b5', book: '党支部工作手册', dept: '办公室', name: '赵磊', phone: '136****4477', out: '2026-10-24', due: '2026-11-07', status: 'active' },
      { id: 'r5', bookId: 'b6', book: '办公自动化实务', dept: '财务科', name: '孙倩', phone: '135****1123', out: '2026-10-10', due: '2026-10-24', returned: '2026-10-24', status: 'returned' },
      { id: 'r6', bookId: 'b2', book: '机关档案管理规范', dept: '综合科', name: '陈涛', phone: '138****7732', out: '2026-10-08', due: '2026-10-22', returned: '2026-10-21', status: 'returned' },
      { id: 'r7', bookId: 'b4', book: '公共图书馆服务规范', dept: '业务二科', name: '马丽', phone: '137****5568', out: '2026-10-09', due: '2026-10-23', returned: '2026-10-23', status: 'returned' }
    ],
    checkins: [
      { date: '10-27', wd: '周二', time: '08:12', loc: '办公楼三层', photo: 'office' },
      { date: '10-26', wd: '周一', time: '08:05', loc: '办公楼三层', photo: 'library' },
      { date: '10-23', wd: '周五', time: '08:20', loc: '图书室', photo: 'corridor' },
      { date: '10-22', wd: '周四', time: '08:11', loc: '办公楼三层', photo: 'meeting' },
      { date: '10-21', wd: '周三', time: '08:07', loc: '图书室', photo: 'archive' }
    ]
  };

  var weeks = [
    {
      id: 'w42', tag: '第 42 周', title: '第 42 周工作小结',
      range: '10月12日 — 10月18日', full: '2026年10月12日 — 10月18日', generatedAt: '2026-10-19 09:20',
      done: true, ratePct: 80,
      kpi: { rate: '4/5', inQty: 16, outQty: 22, borrowQty: 5 },
      gym: { expected: 5, actual: 4, missing: 1 },
      photos: ['office', 'meeting', 'library', 'corridor'], photoDates: ['10-12', '10-13', '10-14', '10-15'],
      stockIn: { types: 2, qty: 16 }, stockOut: { types: 3, qty: 22 }, stockTotal: 352, low: 1,
      lowNote: '《机关档案管理规范》库存接近预警值，建议关注补货。',
      borrowOut: { orders: 4, qty: 5 }, returnB: { orders: 3, qty: 4 }, onLoan: { orders: 3, qty: 3 },
      overdue: [],
      summary: '本周完成办公楼与图书室日常保洁 4 次，1 天因外出办事缺卡；完成规范类图书入库 16 册、科室发放 22 册；办理借阅 4 单，归还 3 单。',
      issue: '《机关档案管理规范》库存接近预警值，需关注补货。',
      plan: '下周按计划完成日常保洁；跟进图书补货；做好借阅台账核对。'
    },
    {
      id: 'w43', tag: '第 43 周', title: '第 43 周工作小结',
      range: '10月19日 — 10月25日', full: '2026年10月19日 — 10月25日', generatedAt: '2026-10-26 21:40',
      done: true, ratePct: 100,
      kpi: { rate: '5/5', inQty: 42, outQty: 18, borrowQty: 8 },
      gym: { expected: 5, actual: 5, missing: 0 },
      photos: ['office', 'library', 'corridor', 'meeting', 'archive'], photoDates: ['10-19', '10-20', '10-21', '10-22', '10-23'],
      stockIn: { types: 3, qty: 42 }, stockOut: { types: 2, qty: 18 }, stockTotal: 356, low: 2,
      lowNote: '《机关档案管理规范》仅剩 3 册，低于预警值 5 册；《公文写作规范》已无库存。',
      borrowOut: { orders: 6, qty: 8 }, returnB: { orders: 5, qty: 7 }, onLoan: { orders: 3, qty: 4 },
      overdue: [{ dept: '业务一科', name: '刘洋', book: '市政工程年鉴 2025', days: 3 }],
      summary: '本周完成办公楼三层、图书室日常保洁 5 次，全部按时打卡；完成年鉴与规范类图书入库 42 册，按科室需求发放 18 册；借阅 8 册、归还 7 册，催还逾期 1 单。',
      issue: '《机关档案管理规范》库存仅剩 3 册，低于预警值；业务一科 1 册年鉴逾期 3 天尚未归还。',
      plan: '下周完成低库存图书补货申请；跟进逾期图书归还；配合办公室完成年度图书盘点。'
    },
    {
      id: 'w44', tag: '本周', title: '本周工作小结',
      range: '10月26日 — 11月01日', full: '2026年10月26日 — 11月01日', generatedAt: '',
      done: false, ratePct: 100,
      kpi: { rate: '2/2', inQty: 8, outQty: 3, borrowQty: 2 },
      gym: { expected: 5, actual: 2, missing: 0 },
      photos: ['office', 'library'], photoDates: ['10-26', '10-27'],
      stockIn: { types: 1, qty: 8 }, stockOut: { types: 2, qty: 3 }, stockTotal: 356, low: 2,
      lowNote: '',
      borrowOut: { orders: 2, qty: 2 }, returnB: { orders: 1, qty: 1 }, onLoan: { orders: 4, qty: 4 },
      overdue: [{ dept: '业务一科', name: '刘洋', book: '市政工程年鉴 2025', days: 4 }],
      summary: '', issue: '', plan: ''
    }
  ];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 通用 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2000);
  }

  function openOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('is-open');
  }
  function closeOverlay(el) {
    if (el) el.classList.remove('is-open');
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
    window.scrollTo(0, 0);

    if (page === 'books') renderBooks();
    if (page === 'borrow') renderBorrows();
    if (page === 'checkin') { renderCalendar(); renderCheckins(); }
    if (page === 'reports') renderReportPage();
  }

  /* ---------- 图书 ---------- */
  function stockTag(b) {
    if (b.stock === 0) return '<span class="stock-tag tag-out">无库存</span>';
    if (b.stock <= b.warn) return '<span class="stock-tag tag-low">低库存</span>';
    return '<span class="stock-tag tag-ok">库存充足</span>';
  }

  function renderBooks() {
    var q = ($('#book-search').value || '').trim();
    var list = state.books.filter(function (b) {
      return !q || b.title.indexOf(q) > -1 || b.cat.indexOf(q) > -1;
    });
    var wrap = $('#book-list');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-tip">没有找到匹配的书刊</div>';
    } else {
      wrap.innerHTML = list.map(function (b) {
        return '<div class="book-card" data-book="' + b.id + '" role="button" tabindex="0">' +
          '<span class="cover" style="background:' + b.color + '">' + b.title.charAt(0) + '</span>' +
          '<span class="book-main">' +
            '<span class="book-title" style="display:block">' + b.title + '</span>' +
            '<span class="book-meta" style="display:block">' + b.cat + ' · ' + b.loc + ' · ' + b.no + '</span>' +
            '<span class="book-bottom">' + stockTag(b) + '<span class="book-meta">库存 ' + b.stock + ' 册</span></span>' +
          '</span>' +
          '<svg class="icon icon-sm chev"><use href="#i-chev-r"/></svg>' +
        '</div>';
      }).join('');
    }
    renderLedger();
  }

  function renderLedger() {
    var rows = state.records.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    $('#ledger-body').innerHTML = rows.map(function (r) {
      var b = state.books.filter(function (x) { return x.id === r.bookId; })[0];
      return '<tr>' +
        '<td class="num">' + r.date.slice(5) + '</td>' +
        '<td>' + (b ? b.title : '—') + '</td>' +
        '<td class="' + (r.type === 'in' ? 'type-in' : 'type-out') + '">' + (r.type === 'in' ? '入库' : '出库') + '</td>' +
        '<td class="num">' + r.qty + ' 册</td>' +
        '<td>' + r.person + '</td>' +
        '<td>' + r.note + '</td>' +
      '</tr>';
    }).join('');
  }

  function openBook(id) {
    state.activeBook = id;
    renderBookDetail();
    go('book-detail');
  }

  function renderBookDetail() {
    var b = state.books.filter(function (x) { return x.id === state.activeBook; })[0];
    if (!b) return;
    var recs = state.records.filter(function (r) { return r.bookId === b.id; });
    var pct = Math.min(100, Math.round(b.stock / Math.max(b.warn * 4, 8) * 100));
    var barCls = b.stock === 0 ? 'out' : (b.stock <= b.warn ? 'low' : '');
    var statusText = b.stock === 0 ? '已无库存' : (b.stock <= b.warn ? '低于预警值' : '库存正常');
    var statusCls = b.stock === 0 ? 'tag-out' : (b.stock <= b.warn ? 'tag-low' : 'tag-ok');

    $('#book-detail-content').innerHTML =
      '<div class="detail-top">' +
        '<div class="detail-cover" style="background:' + b.color + '">' + b.title.charAt(0) + '</div>' +
        '<div class="detail-main">' +
          '<div class="detail-title">' + b.title + '</div>' +
          '<div class="detail-tags"><span class="detail-tag">' + b.cat + '</span><span class="stock-tag ' + statusCls + '">' + statusText + '</span></div>' +
          '<div class="detail-sub">编号 ' + b.no + ' · 存放于 ' + b.loc + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="info-grid">' +
        '<div class="info-cell"><div class="info-label">入库累计</div><div class="info-value">' + b.totalIn + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">出库累计</div><div class="info-value">' + b.totalOut + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">在借未还</div><div class="info-value">' + b.lent + ' 册</div></div>' +
        '<div class="info-cell"><div class="info-label">预警值</div><div class="info-value">' + b.warn + ' 册</div></div>' +
      '</div>' +
      '<div class="stock-card">' +
        '<div class="stock-top">' +
          '<div><div class="stock-label">当前可用库存</div><div class="stock-value">' + b.stock + '<small>册</small></div></div>' +
          '<span class="stock-tag ' + statusCls + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="stock-bar"><span class="' + barCls + '" style="width:' + pct + '%"></span></div>' +
        (b.stock <= b.warn ? '<div class="stock-warn">建议尽快补货，避免影响借阅</div>' : '') +
      '</div>' +
      '<div class="detail-actions">' +
        '<button class="btn btn-secondary" data-open="stock" data-type="in" data-book-id="' + b.id + '" type="button">入库</button>' +
        '<button class="btn btn-primary" data-open="stock" data-type="out" data-book-id="' + b.id + '" type="button">出库</button>' +
      '</div>' +
      '<div class="section-head"><span class="section-title">最近流水</span><span class="section-more">' + recs.length + ' 条</span></div>' +
      '<div class="card timeline">' +
        (recs.length ? recs.map(function (r) {
          return '<div class="tl-row">' +
            '<div class="tl-date">' + r.date.slice(5) + '</div>' +
            '<div class="tl-main"><div class="tl-title">' + (r.type === 'in' ? '入库' : '出库') + ' · ' + r.person + '</div><div class="tl-sub">' + r.note + '</div></div>' +
            '<div class="tl-qty ' + r.type + '">' + (r.type === 'in' ? '+' : '-') + r.qty + '</div>' +
          '</div>';
        }).join('') : '<div class="empty-tip">暂无出入库记录</div>') +
      '</div>' +
      '<div class="section-head"><span class="section-title">备注</span></div>' +
      '<div class="card" style="padding:14px 16px;color:var(--muted);font-size:12px;line-height:1.7">' + (b.note || '暂无备注') + '</div>';
  }

  /* ---------- 借阅 ---------- */
  function maskPhone(p) {
    return String(p).replace(/\D/g, '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  }

  function renderBorrows() {
    var counts = { active: 0, overdue: 0, returned: 0 };
    state.borrows.forEach(function (b) {
      if (b.status === 'returned') counts.returned++;
      else if (b.status === 'overdue') { counts.active++; counts.overdue++; }
      else counts.active++;
    });
    $('#cnt-active').textContent = counts.active;
    $('#cnt-overdue').textContent = counts.overdue;
    $('#cnt-returned').textContent = counts.returned;

    var filter = state.borrowFilter;
    var list = state.borrows.filter(function (b) {
      if (filter === 'overdue') return b.status === 'overdue';
      if (filter === 'returned') return b.status === 'returned';
      return b.status !== 'returned';
    });

    $('#borrow-list').innerHTML = list.length ? list.map(function (b) {
      var badge = b.status === 'overdue'
        ? '<span class="badge badge-overdue">逾期 3 天</span>'
        : (b.status === 'returned' ? '<span class="badge badge-returned">已归还</span>' : '<span class="badge badge-active">借出中</span>');
      return '<div class="borrow-card' + (b.status === 'overdue' ? ' is-overdue' : '') + '">' +
        '<div class="borrow-top">' +
          '<div class="person">' +
            '<span class="mini-avatar">' + b.name.charAt(0) + '</span>' +
            '<div><div class="person-name">' + b.name + ' · ' + b.dept + '</div><div class="person-sub">' + b.out.slice(5) + ' 借出</div></div>' +
          '</div>' + badge +
        '</div>' +
        '<div class="borrow-book">《' + b.book + '》</div>' +
        '<div class="borrow-dates"><span>借出 ' + b.out.slice(5) + '</span><span>应还 ' + b.due.slice(5) + '</span>' + (b.returned ? '<span>归还 ' + b.returned.slice(5) + '</span>' : '') + '</div>' +
        '<div class="borrow-foot">' +
          '<span class="phone-chip"><svg class="icon"><use href="#i-phone"/></svg>' + b.phone + '</span>' +
          (b.status === 'returned'
            ? '<span class="returned-tag">已完成归还</span>'
            : '<button class="btn btn-secondary btn-sm" data-return="' + b.id + '" type="button">归还</button>') +
        '</div>' +
      '</div>';
    }).join('') : '<div class="empty-tip">当前分类下没有记录</div>';
  }

  function returnBook(id) {
    var b = state.borrows.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    b.status = 'returned';
    b.returned = '2026-10-27';
    var book = state.books.filter(function (x) { return x.id === b.bookId; })[0];
    if (book) { book.stock += 1; book.lent = Math.max(0, book.lent - 1); }
    renderBorrows();
    renderBooks();
    toast('已归还《' + b.book + '》');
  }

  /* ---------- 打卡 ---------- */
  function renderCheckins() {
    $('#checkin-list').innerHTML = state.checkins.map(function (c) {
      return '<div class="check-row">' +
        '<div class="check-thumb"><img src="' + PHOTOS[c.photo] + '" alt="" loading="lazy"><span class="thumb-wm">' + c.date + ' ' + c.time + '</span></div>' +
        '<div class="check-info"><div class="check-date">' + c.date + '<span>' + c.wd + ' · ' + c.time + '</span></div><div class="check-loc">' + c.loc + ' · 卫生打卡</div></div>' +
        '<span class="mini-ok">已完成</span>' +
      '</div>';
    }).join('');
  }

  function renderCalendar() {
    var weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    var done = { 1: 1, 2: 1, 5: 1, 6: 1, 7: 1, 8: 1, 12: 1, 13: 1, 14: 1, 15: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 26: 1, 27: 1 };
    var miss = { 9: 1, 16: 1 };
    var html = weekdays.map(function (d) { return '<div class="cal-wd">' + d + '</div>'; }).join('');
    for (var i = 0; i < 3; i++) html += '<div></div>';
    for (var d = 1; d <= 31; d++) {
      var cls = 'cal-day';
      if (done[d]) cls += ' done';
      if (miss[d]) cls += ' miss';
      if (d === 27) cls += ' today';
      html += '<div class="' + cls + '"><span>' + d + '</span>' + (done[d] ? '<i class="cal-dot"></i>' : '') + '</div>';
    }
    $('#calendar-grid').innerHTML = html;
    $('#cal-rate').textContent = '已打卡 17 天';
  }

  /* ---------- 报表 ---------- */
  function renderReportPage() {
    var w = weeks[state.weekIndex];
    $('#week-label').textContent = w.range;
    $('#week-tag').textContent = w.tag;
    $('#kpi-rate').innerHTML = w.kpi.rate + '<small>天</small>';
    $('#kpi-in').innerHTML = w.kpi.inQty + '<small>册</small>';
    $('#kpi-out').innerHTML = w.kpi.outQty + '<small>册</small>';
    $('#kpi-borrow').innerHTML = w.kpi.borrowQty + '<small>册</small>';
    $('#week-prev').disabled = state.weekIndex === 0;
    $('#week-next').disabled = state.weekIndex === weeks.length - 1;

    var btnEdit = $('#btn-edit');
    var btnGen = $('#btn-generate');
    var preview = $('#report-preview');

    if (!w.done) {
      preview.innerHTML =
        '<div class="empty-report">' +
          '<div class="empty-ic"><svg class="icon"><use href="#i-lock"/></svg></div>' +
          '<div class="empty-title">本周还未结束</div>' +
          '<div class="empty-sub">周日 24:00 后可生成完整周报<br>本页数据会持续累计</div>' +
        '</div>';
      btnEdit.disabled = true;
      btnGen.disabled = true;
    } else {
      preview.innerHTML =
        '<div class="report-card">' +
          '<div class="report-head">' +
            '<div>' +
              '<div class="report-kicker">WEEKLY REPORT</div>' +
              '<div class="report-title">' + w.title + '</div>' +
              '<div class="report-date">' + w.full + '</div>' +
            '</div>' +
            '<div class="report-rate"><strong>' + w.ratePct + '%</strong><span>打卡率</span></div>' +
          '</div>' +
          '<div class="report-body">' +
            '<div class="photo-strip">' + w.photos.slice(0, 3).map(function (p) {
              return '<div class="ph"><img src="' + PHOTOS[p] + '" alt="" loading="lazy"></div>';
            }).join('') + '</div>' +
            '<p class="report-summary">' + w.summary + '</p>' +
            '<button class="btn btn-ghost btn-block" data-open="report" type="button" style="margin-top:12px">查看完整周报长图</button>' +
          '</div>' +
        '</div>';
      btnEdit.disabled = false;
      btnGen.disabled = false;
    }
    renderHistory();
  }

  function renderHistory() {
    $('#report-history').innerHTML = weeks.filter(function (w) { return w.done; }).slice().reverse().map(function (w) {
      var index = weeks.indexOf(w);
      return '<button class="history-row" data-week="' + index + '" type="button">' +
        '<span class="history-date">' + w.tag + ' · ' + w.range + '</span>' +
        '<span class="history-ok">已生成</span>' +
        '<svg class="icon icon-sm chev"><use href="#i-chev-r"/></svg>' +
      '</button>';
    }).join('');
  }

  function buildLong(w) {
    var pct = Math.round(w.gym.actual / w.gym.expected * 100);
    var missingTxt = w.gym.missing > 0 ? '缺卡 ' + w.gym.missing + ' 天' : '全勤';
    var photos = w.photos.map(function (p, i) {
      return '<div class="long-ph"><img src="' + PHOTOS[p] + '" alt="" loading="lazy"><em>' + w.photoDates[i] + '</em></div>';
    }).join('');
    var overdue = w.overdue.length ? w.overdue.map(function (o) {
      return '<tr><td>' + o.dept + '</td><td>' + o.name + '</td><td>' + o.book + '</td><td class="long-flag">' + o.days + ' 天</td></tr>';
    }).join('') : '<tr><td colspan="4" style="color:var(--muted)">本周无逾期</td></tr>';

    return '<div class="long">' +
      '<div class="long-head">' +
        '<div class="long-kicker">后勤保障科 · 工作周报</div>' +
        '<div class="long-title">' + w.title + '</div>' +
        '<div class="long-range">' + w.full + '</div>' +
        '<div class="long-badge">打卡率 ' + pct + '% · ' + missingTxt + '</div>' +
      '</div>' +
      '<div class="long-body">' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">01</span><h3>卫生打卡</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + w.gym.expected + '</strong><span>应打卡（天）</span></div>' +
            '<div class="long-stat"><strong>' + w.gym.actual + '</strong><span>实际打卡（天）</span></div>' +
            '<div class="long-stat"><strong>' + w.gym.missing + '</strong><span>缺卡（天）</span></div>' +
          '</div>' +
          '<div class="long-photos">' + photos + '</div>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">02</span><h3>图书资料</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + w.stockIn.qty + '</strong><span>入库（' + w.stockIn.types + ' 种）</span></div>' +
            '<div class="long-stat"><strong>' + w.stockOut.qty + '</strong><span>出库（' + w.stockOut.types + ' 种）</span></div>' +
            '<div class="long-stat"><strong>' + w.stockTotal + '</strong><span>当前库存（册）</span></div>' +
          '</div>' +
          '<div class="long-note">' + w.lowNote + '</div>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">03</span><h3>图书借阅</h3></div>' +
          '<div class="long-stats">' +
            '<div class="long-stat"><strong>' + w.borrowOut.qty + '</strong><span>借出（' + w.borrowOut.orders + ' 单）</span></div>' +
            '<div class="long-stat"><strong>' + w.returnB.qty + '</strong><span>归还（' + w.returnB.orders + ' 单）</span></div>' +
            '<div class="long-stat"><strong>' + w.onLoan.qty + '</strong><span>在借（' + w.onLoan.orders + ' 单）</span></div>' +
          '</div>' +
          '<table class="long-table"><thead><tr><th>部门</th><th>对接人</th><th>书刊</th><th>逾期</th></tr></thead><tbody>' + overdue + '</tbody></table>' +
        '</div>' +
        '<div class="long-sec">' +
          '<div class="long-sec-head"><span class="long-index">04</span><h3>本周总结</h3></div>' +
          '<div class="long-text"><b>本周小结</b>' + w.summary + '</div>' +
          '<div class="long-text"><b>存在问题</b>' + w.issue + '</div>' +
          '<div class="long-text"><b>下周计划</b>' + w.plan + '</div>' +
        '</div>' +
        '<div class="long-footer">陈静 · 后勤保障科 · ' + w.generatedAt + ' 生成</div>' +
      '</div>' +
    '</div>';
  }

  function openReport() {
    var w = weeks[state.weekIndex];
    if (!w.done) { toast('本周还未结束，周日 24:00 后可生成'); return; }
    $('#report-long').innerHTML = buildLong(w);
    $('#report-overlay').classList.add('is-open');
    $('.ro-scroll').scrollTop = 0;
  }

  function closeReport() {
    $('#report-overlay').classList.remove('is-open');
  }

  function openEditReport() {
    var w = weeks[state.weekIndex];
    if (!w.done) return;
    $('#edit-summary').value = w.summary;
    $('#edit-issue').value = w.issue;
    $('#edit-plan').value = w.plan;
    openOverlay('ov-edit');
  }

  /* ---------- 表单与弹层 ---------- */
  function openStock(type, bookId) {
    type = type || 'in';
    $$('#stock-seg [data-stock-type]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.stockType === type);
    });
    $('#stock-type').value = type;
    $('#stock-sheet-title').textContent = type === 'in' ? '图书入库' : '图书出库';
    $('#stock-book').innerHTML = state.books.map(function (b) {
      return '<option value="' + b.id + '">' + b.title + '（库存 ' + b.stock + ' 册）</option>';
    }).join('');
    if (bookId) $('#stock-book').value = bookId;
    $('#stock-qty').value = 1;
    $('#stock-person').value = '';
    $('#stock-note').value = '';
    openOverlay('ov-stock');
  }

  function openNewBook() {
    $('#book-title').value = '';
    $('#book-cat').value = '年鉴';
    $('#book-loc').value = '';
    $('#book-qty').value = 10;
    $('#book-person').value = '';
    $('#book-note').value = '';
    openOverlay('ov-book');
  }

  function openBorrowForm() {
    $('#borrow-book').innerHTML = state.books.filter(function (b) { return b.stock > 0; }).map(function (b) {
      return '<option value="' + b.id + '">' + b.title + '（可借 ' + b.stock + ' 册）</option>';
    }).join('');
    $('#borrow-name').value = '';
    $('#borrow-phone').value = '';
    $('#borrow-note').value = '';
    $('#borrow-out').value = '2026-10-27';
    $('#borrow-due').value = '2026-11-10';
    openOverlay('ov-borrow');
  }

  function openCamera() {
    $('#cam').classList.add('is-open');
    $('#cam-live').classList.remove('is-off');
    $('#cam-result').classList.remove('is-on');
  }
  function closeCamera() {
    $('#cam').classList.remove('is-open');
  }

  /* ---------- 事件 ---------- */
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

    var close = e.target.closest('[data-close]');
    if (close) { closeOverlay(close.closest('.overlay')); return; }

    var toastEl = e.target.closest('[data-toast]');
    if (toastEl) { toast(toastEl.dataset.toast); return; }

    if (e.target.classList.contains('overlay')) { closeOverlay(e.target); }
  });

  /* 登录 */
  $('#login-btn').addEventListener('click', function () { go('home'); toast('欢迎回来，陈静'); });
  $('#login-skip').addEventListener('click', function () { go('home'); });

  /* 搜索 */
  $('#book-search').addEventListener('input', renderBooks);

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
      renderBorrows();
    });
  });

  /* 周报周切换 */
  $('#week-prev').addEventListener('click', function () {
    if (state.weekIndex > 0) { state.weekIndex--; renderReportPage(); }
  });
  $('#week-next').addEventListener('click', function () {
    if (state.weekIndex < weeks.length - 1) { state.weekIndex++; renderReportPage(); }
  });
  $('#report-history').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-week]');
    if (!btn) return;
    state.weekIndex = parseInt(btn.dataset.week, 10);
    renderReportPage();
    window.scrollTo(0, 0);
  });

  /* 周报按钮 */
  $('#btn-generate').addEventListener('click', openReport);
  $('#btn-edit').addEventListener('click', openEditReport);
  $('#report-save').addEventListener('click', function () { toast('长图已保存到相册（原型演示）'); });
  $('#report-close').addEventListener('click', closeReport);
  $('#report-back').addEventListener('click', closeReport);

  /* 设置 */
  $$('[data-switch]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-checked') === 'true';
      btn.setAttribute('aria-checked', on ? 'false' : 'true');
    });
  });
  $('#logout-btn').addEventListener('click', function () { go('login'); toast('已退出登录'); });
  $('#reset-demo').addEventListener('click', function () {
    toast('已重置演示数据');
    setTimeout(function () { location.reload(); }, 500);
  });

  /* 入库类型切换 */
  $$('#stock-seg [data-stock-type]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('#stock-seg [data-stock-type]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var type = btn.dataset.stockType;
      $('#stock-type').value = type;
      $('#stock-sheet-title').textContent = type === 'in' ? '图书入库' : '图书出库';
    });
  });

  /* 入库 / 出库提交 */
  $('#form-stock').addEventListener('submit', function (e) {
    e.preventDefault();
    var bookId = $('#stock-book').value;
    var type = $('#stock-type').value;
    var qty = parseInt($('#stock-qty').value, 10);
    var book = state.books.filter(function (b) { return b.id === bookId; })[0];
    if (!book) { toast('请选择书刊'); return; }
    if (!qty || qty < 1) { toast('请输入正确的数量'); return; }
    if (type === 'out' && qty > book.stock) { toast('库存不足，当前可用 ' + book.stock + ' 册'); return; }
    book.stock = type === 'in' ? book.stock + qty : book.stock - qty;
    if (type === 'in') book.totalIn += qty; else book.totalOut += qty;
    state.records.unshift({
      date: $('#stock-date').value || '2026-10-27',
      bookId: bookId,
      type: type,
      qty: qty,
      person: $('#stock-person').value.trim() || '—',
      note: $('#stock-note').value.trim() || '—'
    });
    closeOverlay($('#ov-stock'));
    renderBooks();
    if (state.page === 'book-detail') renderBookDetail();
    toast((type === 'in' ? '入库' : '出库') + '成功，当前库存 ' + book.stock + ' 册');
  });

  /* 新增图书 */
  $('#form-book').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('#book-title').value.trim();
    if (!title) { toast('请填写书刊名称'); return; }
    var qty = parseInt($('#book-qty').value, 10) || 0;
    var id = 'b' + Date.now();
    var colors = ['#3E567A', '#2F5D50', '#6B5B3E', '#4A4458', '#7A4B3A', '#5A6B3B'];
    state.books.unshift({
      id: id,
      title: title,
      cat: $('#book-cat').value,
      no: 'NEW-' + String(Date.now()).slice(-4),
      loc: $('#book-loc').value.trim() || '待分配',
      stock: qty,
      warn: 5,
      totalIn: qty,
      totalOut: 0,
      lent: 0,
      color: colors[state.books.length % colors.length],
      note: $('#book-note').value.trim() || '暂无备注'
    });
    if (qty > 0) {
      state.records.unshift({
        date: '2026-10-27', bookId: id, type: 'in', qty: qty,
        person: $('#book-person').value.trim() || '—', note: '新增档案首次入库'
      });
    }
    closeOverlay($('#ov-book'));
    renderBooks();
    toast('图书档案已保存');
  });

  /* 新增借阅 */
  $('#form-borrow').addEventListener('submit', function (e) {
    e.preventDefault();
    var bookId = $('#borrow-book').value;
    var book = state.books.filter(function (b) { return b.id === bookId; })[0];
    if (!book || book.stock <= 0) { toast('该图书暂无可借库存'); return; }
    var name = $('#borrow-name').value.trim();
    if (!name) { toast('请填写对接人'); return; }
    var phoneRaw = $('#borrow-phone').value.trim();
    if (phoneRaw && !/^1[3-9]\d{9}$/.test(phoneRaw)) { toast('请输入 11 位手机号'); return; }
    state.borrows.unshift({
      id: 'r' + Date.now(),
      bookId: bookId,
      book: book.title,
      dept: $('#borrow-dept').value,
      name: name,
      phone: phoneRaw ? maskPhone(phoneRaw) : '未填写',
      out: $('#borrow-out').value || '2026-10-27',
      due: $('#borrow-due').value || '2026-11-10',
      status: 'active'
    });
    book.stock -= 1;
    book.lent += 1;
    state.borrowFilter = 'active';
    $$('#borrow-seg [data-filter]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.filter === 'active');
    });
    closeOverlay($('#ov-borrow'));
    renderBorrows();
    renderBooks();
    toast('已借出《' + book.title + '》');
  });

  /* 编辑周报文字 */
  $('#form-report').addEventListener('submit', function (e) {
    e.preventDefault();
    var w = weeks[state.weekIndex];
    if (!w.done) return;
    w.summary = $('#edit-summary').value.trim() || w.summary;
    w.issue = $('#edit-issue').value.trim() || w.issue;
    w.plan = $('#edit-plan').value.trim() || w.plan;
    closeOverlay($('#ov-edit'));
    renderReportPage();
    toast('周报文字已保存');
  });

  /* 拍照 */
  $('#cam-close').addEventListener('click', closeCamera);
  $('#cam-shot').addEventListener('click', function () {
    $('#cam-live').classList.add('is-off');
    $('#cam-result').classList.add('is-on');
  });
  $('#cam-retry').addEventListener('click', function () {
    $('#cam-live').classList.remove('is-off');
    $('#cam-result').classList.remove('is-on');
  });
  $('#cam-use').addEventListener('click', function () {
    if (state.checkins.length) {
      state.checkins[0].time = '08:12';
      state.checkins[0].photo = 'office';
    }
    renderCheckins();
    closeCamera();
    toast('打卡成功，已生成时间水印');
  });

  /* 详情页底部操作 */
  $('#detail-in').addEventListener('click', function () { openStock('in', state.activeBook); });
  $('#detail-out').addEventListener('click', function () { openStock('out', state.activeBook); });

  /* 图片注入与失败兜底 */
  $$('img[data-photo]').forEach(function (img) {
    img.src = PHOTOS[img.dataset.photo] || '';
  });
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.target.classList.add('img-broken');
      if (e.target.parentElement) e.target.parentElement.classList.add('no-img');
    }
  }, true);

  /* 初始渲染 */
  renderBooks();
  renderBorrows();
  renderCalendar();
  renderCheckins();
  renderReportPage();
})();
