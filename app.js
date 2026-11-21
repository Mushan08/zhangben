/* ==========================================================================
   记账本 — 应用逻辑
   纯前端、零依赖、本地优先。金额一律以「分」为整数存储，避免浮点误差。
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'mozhang.v2';

  /* 分类配色：取自传统色的一小组灰调色，避免高饱和撞色 */
  var PALETTE = [
    '#C24A32', '#C97B2E', '#B4913C', '#8A9440', '#4F8A5B', '#2E7D6E',
    '#3E7C8C', '#4E6C93', '#7A5C86', '#A85566', '#8C5A4A', '#6E6A63'
  ];

  /* 够用就好的十个支出、五个收入，正好排满两行与一行 */
  var EXPENSE_CATS = [
    ['餐饮', 'food'], ['交通', 'transport'], ['购物', 'shopping'], ['学习', 'study'], ['娱乐', 'fun'],
    ['日用', 'home'], ['通讯', 'phone'], ['住宿', 'rent'], ['医疗', 'medical'], ['其他', 'other']
  ];

  var INCOME_CATS = [
    ['生活费', 'salary'], ['兼职', 'parttime'], ['奖学金', 'bonus'], ['红包', 'redpacket'], ['其他', 'other']
  ];

  var ACCOUNT_TYPES = [
    ['现金', 'cash'], ['储蓄卡', 'bank'], ['信用卡', 'credit'],
    ['电子钱包', 'wallet'], ['投资', 'invest']
  ];

  /* ---------- 状态 ---------- */
  var DB = null;
  var UI = {
    tab: 'home',
    month: mk(today()),
    statsKind: 'expense',
    ledgerPick: null,
    panel: null,
    stack: [],
    draft: null,
    picker: null,
    confirm: null,
    search: '',
    drillCat: null,
    pickYear: null,
    heroShown: 0
  };

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function nowTime() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function dp(s) { var p = String(s).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function mk(s) { return String(s).slice(0, 7); }
  function monthKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function shiftMonth(k, n) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return monthKey(d); }
  function daysInMonth(k) { var p = k.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  function monthLabel(k) { var p = k.split('-'); return p[0] + '年' + (+p[1]) + '月'; }
  function monthShort(k) { var p = k.split('-'); return (+p[1]) + '月'; }
  var DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function dowLabel(s) { var p = dp(s); return DOW[new Date(p.y, p.m - 1, p.d).getDay()]; }
  function dayLabel(s) {
    var p = dp(s), t = dp(today());
    if (s === today()) return '今天';
    var yd = new Date(); yd.setDate(yd.getDate() - 1);
    if (s === (yd.getFullYear() + '-' + pad2(yd.getMonth() + 1) + '-' + pad2(yd.getDate()))) return '昨天';
    return p.m + '月' + p.d + '日';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmt(cents) {
    var neg = cents < 0, v = Math.abs(Math.round(cents));
    var s = (v / 100).toFixed(2), p = s.split('.');
    return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
  }
  function fmtShort(cents) {
    var v = Math.abs(cents) / 100;
    if (v >= 10000) return (cents < 0 ? '-' : '') + (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万';
    return fmt(cents);
  }
  function cat(id) { return DB.categories.filter(function (c) { return c.id === id; })[0] || { name: '未分类', icon: 'other', color: PALETTE[11] }; }
  function acct(id) { return DB.accounts.filter(function (a) { return a.id === id; })[0] || { name: '未知账户', icon: 'wallet' }; }
  function ledgerName(id) {
    var l = DB.ledgers.filter(function (x) { return x.id === id; })[0];
    return l ? l.name : '账本';
  }
  function activeLedger() { return DB.currentLedger || (DB.ledgers[0] && DB.ledgers[0].id); }

  /* ---------- 默认数据 ---------- */
  var SETTING_DEFAULTS = {
    theme: 'auto',        // light / dark / auto
    accent: 'cinnabar',   // 主题：cinnabar / jade / indigo / violet / amber（整套配色）
    font: 'sans',         // 字体：sans / system / serif / kai / mono（数字一起换）
    fontScale: 1,         // 字号：0.92 / 1 / 1.08 / 1.16
    currency: '¥',
    budget: 0,
    autoSave: true,       // 每天自动备份一次 JSON
    lastAutoSave: ''      // 上次自动备份的日期（YYYY-MM-DD）
  };
  function buildDefaults() {
    var cats = [], i;
    for (i = 0; i < EXPENSE_CATS.length; i++) {
      cats.push({ id: 'c' + (i + 1), name: EXPENSE_CATS[i][0], icon: EXPENSE_CATS[i][1], color: PALETTE[i % PALETTE.length], kind: 'expense', order: i });
    }
    for (i = 0; i < INCOME_CATS.length; i++) {
      cats.push({ id: 'i' + (i + 1), name: INCOME_CATS[i][0], icon: INCOME_CATS[i][1], color: PALETTE[(i * 3 + 5) % PALETTE.length], kind: 'income', order: i });
    }
    return normalizeDB({
      version: 1,
      settings: {},
      ledgers: [{ id: 'ld1', name: '日常账本' }],
      currentLedger: 'ld1',
      accounts: [
        { id: 'a1', name: '现金', type: '现金', icon: 'cash', color: '#8A9440', initial: 0 },
        { id: 'a2', name: '微信零钱', type: '电子钱包', icon: 'wallet', color: '#4F8A5B', initial: 0 },
        { id: 'a3', name: '支付宝', type: '电子钱包', icon: 'wallet', color: '#3E7C8C', initial: 0 },
        { id: 'a4', name: '银行卡', type: '储蓄卡', icon: 'bank', color: '#C24A32', initial: 0 }
      ],
      categories: cats,
      txns: []
    });
  }

  /* 旧备份 / 旧版本数据缺字段时在这里补齐，保证升级后设置不丢 */
  function normalizeDB(d) {
    if (!d.settings) d.settings = {};
    for (var k in SETTING_DEFAULTS) {
      if (d.settings[k] == null) d.settings[k] = SETTING_DEFAULTS[k];
    }
    d.ledgers = d.ledgers && d.ledgers.length ? d.ledgers : [{ id: 'ld1', name: '日常账本' }];
    d.currentLedger = d.currentLedger || d.ledgers[0].id;
    d.txns = Array.isArray(d.txns) ? d.txns : [];
    d.accounts = Array.isArray(d.accounts) ? d.accounts : [];
    d.categories = Array.isArray(d.categories) ? d.categories : [];
    return d;
  }

  /* ---------- 存取 ---------- */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) { DB = buildDefaults(); save(); return; }
    try {
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.categories) || !d.categories.length) throw new Error('bad');
      DB = normalizeDB(d);
    } catch (e) {
      DB = buildDefaults();
    }
    save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* 忽略配额错误 */ }
  }
  /* 数据变更统一走 commit：写盘 + 失效缓存 + 排自动备份 */
  var rev = 0;
  var dirty = false;   // 本会话是否有变更；防止陈旧标签页把旧数据写回磁盘
  function commit() {
    save();
    rev++;
    dirty = true;
    scheduleAutoSave();
  }

  /* ---------- 派生计算 ----------
     渲染路径上 ledgerTxns / monthTxns / 余额会被反复调用，
     这里按数据版本 rev 做一层 memo，同一轮渲染只算一遍。 */
  var memoLedger = { rev: -1, ledger: null, list: null };
  var memoMonth = { rev: -1, ledger: null, month: null, list: null };
  var memoBal = { rev: -1, ledger: null, map: null };
  function inMonth(t, k) { return mk(t.date) === k; }
  function ledgerTxns() {
    var ld = activeLedger();
    if (memoLedger.rev === rev && memoLedger.ledger === ld) return memoLedger.list;
    var list = DB.txns.filter(function (t) { return (t.ledger || 'ld1') === ld; });
    memoLedger = { rev: rev, ledger: ld, list: list };
    return list;
  }
  function monthTxns(k) {
    var ld = activeLedger();
    if (memoMonth.rev === rev && memoMonth.ledger === ld && memoMonth.month === k) return memoMonth.list;
    var list = ledgerTxns().filter(function (t) { return inMonth(t, k); })
      .sort(function (a, b) { return (b.date + b.time) < (a.date + a.time) ? -1 : 1; });
    memoMonth = { rev: rev, ledger: ld, month: k, list: list };
    return list;
  }
  function totals(list) {
    var inc = 0, exp = 0;
    list.forEach(function (t) {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
    });
    return { inc: inc, exp: exp, net: inc - exp };
  }
  function catTotals(list, kind) {
    var m = {}, out = [];
    list.forEach(function (t) {
      if (t.type !== kind) return;
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    Object.keys(m).forEach(function (id) { out.push({ id: id, name: cat(id).name, color: cat(id).color, icon: cat(id).icon, amount: m[id] }); });
    out.sort(function (a, b) { return b.amount - a.amount; });
    return out;
  }
  /* 所有账户余额一次遍历算完，避免逐账户全表扫描 */
  function balances() {
    var ld = activeLedger();
    if (memoBal.rev === rev && memoBal.ledger === ld) return memoBal.map;
    var map = {};
    DB.accounts.forEach(function (a) { map[a.id] = a.initial || 0; });
    ledgerTxns().forEach(function (t) {
      if (t.type === 'income') map[t.account] = (map[t.account] || 0) + t.amount;
      else if (t.type === 'expense') map[t.account] = (map[t.account] || 0) - t.amount;
      else if (t.type === 'transfer') {
        map[t.account] = (map[t.account] || 0) - t.amount;
        map[t.toAccount] = (map[t.toAccount] || 0) + t.amount;
      }
    });
    memoBal = { rev: rev, ledger: ld, map: map };
    return map;
  }
  function accountBalance(id) {
    var a = acct(id);
    var map = balances();
    return map[id] != null ? map[id] : (a.initial || 0);
  }
  function monthSeries(k, n) {
    var out = [], i, all = ledgerTxns();
    for (i = n - 1; i >= 0; i--) {
      var key = shiftMonth(k, -i), tt = totals(all.filter(function (t) { return inMonth(t, key); }));
      out.push({ key: key, label: monthShort(key), inc: tt.inc, exp: tt.exp });
    }
    return out;
  }
  function groupByDay(list) {
    var out = [], cur = null;
    list.forEach(function (t) {
      if (!cur || cur.date !== t.date) { cur = { date: t.date, items: [] }; out.push(cur); }
      cur.items.push(t);
    });
    out.forEach(function (g) {
      g.exp = g.items.reduce(function (s, t) { return s + (t.type === 'expense' ? t.amount : 0); }, 0);
      g.inc = g.items.reduce(function (s, t) { return s + (t.type === 'income' ? t.amount : 0); }, 0);
    });
    return out;
  }

  /* ---------- 主题 ---------- */
  function systemDark() {
    try {
      if (window.Android && window.Android.isSystemDark) return window.Android.isSystemDark();
    } catch (e) { /* 浏览器环境 */ }
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  /* 每套主题的纸面底色（浅 / 深），与 styles.css 各主题的 --bg 一一对应 */
  var ACCENT_BG = {
    cinnabar: { light: '#F7F8F6', dark: '#0F1211' },
    jade:     { light: '#EFF5EF', dark: '#0C1410' },
    indigo:   { light: '#F0F3F9', dark: '#0D1119' },
    violet:   { light: '#F5F3F9', dark: '#120F18' },
    amber:    { light: '#F8F2E6', dark: '#14100A' }
  };
  function applyTheme() {
    var s = DB.settings;
    var t = s.theme || 'auto';
    var dark = t === 'dark' || (t === 'auto' && systemDark());
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    var accent = ACCENT_BG[s.accent] ? s.accent : 'cinnabar';
    root.setAttribute('data-accent', accent);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ACCENT_BG[accent][dark ? 'dark' : 'light']);
    try { if (window.Android && window.Android.setChrome) window.Android.setChrome(dark); } catch (e) { /* noop */ }
  }
  function applyFont() {
    var root = document.documentElement;
    var f = DB.settings.font || 'sans';
    root.setAttribute('data-font', f);
    var sc = +DB.settings.fontScale || 1;
    root.style.setProperty('--fsz', sc);
  }

  /* ---------- 片段 ---------- */
  function amountLabel(t) {
    if (t.type === 'income') return '+' + fmt(t.amount);
    if (t.type === 'expense') return '−' + fmt(t.amount);
    return fmt(t.amount);
  }
  function txnRow(t, inCat) {
    var c = t.type === 'transfer'
      ? { name: '转账', icon: 'transfer', color: '#6E6A63' }
      : cat(t.category);
    /* 在分类下钻里，分类名已写在标题上，这里改用备注做主标题 */
    var title = (inCat && t.note) ? t.note : (t.type === 'transfer' ? '转账' : c.name);
    var meta;
    if (t.type === 'transfer') {
      meta = '<div class="row-transit">' + esc(acct(t.account).name) + ' → ' + esc(acct(t.toAccount).name) + '</div>';
    } else if (inCat) {
      meta = '<div class="row-note">' + esc([dayLabel(t.date), acct(t.account).name].join(' · ')) + '</div>';
    } else {
      meta = '<div class="row-note">' + esc([acct(t.account).name, t.note].filter(Boolean).join(' · ')) + '</div>';
    }
    return '' +
      '<button class="row" data-act="edit" data-id="' + t.id + '">' +
        '<span class="row-cat">' + ICON(c.icon, 17) + '</span>' +
        '<span class="row-main">' +
          '<span class="row-name">' + esc(title) + '</span>' +
          meta +
        '</span>' +
        '<span class="row-amt ' + (t.type === 'income' ? 'is-income' : t.type === 'transfer' ? 'is-transfer' : '') + '">' + amountLabel(t) + '</span>' +
      '</button>';
  }
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function emptyState(icon, title, text, action) {
    return '<div class="empty">' +
      '<div class="empty-mark">' + ICON(icon, 30) + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (action || '') + '</div>';
  }

  /* ---------- 顶栏 ---------- */
  function renderTop() {
    var el = document.getElementById('topbar'), h = '';
    if (UI.tab === 'home') {
      h = '<div class="mh-row">' +
            '<div class="mh-title"><h1>' + esc(ledgerName(activeLedger())) + '</h1>' +
            '<div class="mh-sub">共 ' + ledgerTxns().length + ' 笔 · ' + DB.accounts.length + ' 个账户</div></div>' +
            '<button class="mh-btn" data-act="panel" data-panel="search" title="搜索">' + ICON('search', 19) + '</button>' +
            '<button class="mh-btn" data-act="panel" data-panel="ledgers" title="账本">' + ICON('ledger', 19) + '</button>' +
          '</div>' + monthBar();
    } else if (UI.tab === 'stats') {
      h = '<div class="mh-row"><div class="mh-title"><h1>统计</h1>' +
            '<div class="mh-sub">' + esc(ledgerName(activeLedger())) + '</div></div></div>' + monthBar();
    } else if (UI.tab === 'accounts') {
      var net = DB.accounts.reduce(function (s, a) { return s + accountBalance(a.id); }, 0);
      h = '<div class="mh-row"><div class="mh-title"><h1>账户</h1>' +
            '<div class="mh-sub">净资产 ' + esc(DB.settings.currency) + ' ' + fmt(net) + '</div></div>' +
            '<button class="mh-btn" data-act="acct-new" title="新增账户">' + ICON('plus', 19) + '</button></div>';
    } else {
      h = '<div class="mh-row"><div class="mh-title"><h1>设置</h1>' +
            '<div class="mh-sub">本地存储 · 无需联网</div></div></div>';
    }
    el.className = 'topbar';
    el.innerHTML = h;
    var v = document.getElementById('view');
    if (v && v.scrollTop > 6) el.classList.add('is-stuck');
  }
  function monthBar() {
    var p = UI.month.split('-');
    return '<div class="monthbar">' +
      '<button class="mb-arrow" data-act="month" data-n="-1" title="上一个月">' + ICON('back', 17) + '</button>' +
      '<button class="mb-label" data-act="panel" data-panel="month-pick" title="选择月份">' +
        '<span class="mb-min">' + p[0] + '·</span>' + pad2(+p[1]) + '</button>' +
      '<button class="mb-arrow" data-act="month" data-n="1" title="下一个月">' + ICON('next', 17) + '</button>' +
    '</div>';
  }

  /* ---------- 首页 ---------- */
  function viewHome() {
    var list = monthTxns(UI.month), tt = totals(list), out = '';
    var days = list.length ? groupByDay(list) : [];
    var dayCount = uniqueDays(list);
    var avg = dayCount ? Math.round(tt.exp / dayCount) : 0;

    var cur = esc(DB.settings.currency);
    var budgetHtml = '';
    if (DB.settings.budget > 0) {
      var pct = Math.min(100, Math.round(tt.exp / DB.settings.budget * 100));
      var over = tt.exp > DB.settings.budget;
      budgetHtml = '<div class="sum-budget' + (over ? ' is-over' : '') + '">' +
        '<div class="sb-head"><span>月度预算 ' + cur + ' ' + fmt(DB.settings.budget) + '</span>' +
        '<b>' + pct + '%' + (over ? ' · 超 ' + fmt(tt.exp - DB.settings.budget) : '') + '</b></div>' +
        '<span class="track' + (over ? ' is-over' : '') + '"><i style="width:' + pct + '%"></i></span></div>';
    }

    out += '<section class="summary">' +
      '<div class="sum-head"><span class="sum-rule"></span><span class="sum-label">本月支出</span></div>' +
      '<div class="sum-amount">' +
        '<span class="cur">' + cur + '</span>' +
        '<span id="sum-int">' + fmtInt(Math.floor(tt.exp / 100)) + '</span>' +
        '<span class="dec" id="sum-dec">.' + pad2(Math.abs(tt.exp) % 100) + '</span>' +
      '</div>' +
      '<div class="sum-meta">日均 ' + cur + ' ' + fmt(avg) + ' · ' + list.length + ' 笔记录</div>' +
      '<div class="sum-split">' +
        '<div class="ss-cell is-income"><span class="ss-k">' + ICON('in', 13) + '收入</span>' +
          '<span class="ss-v">' + fmt(tt.inc) + '</span></div>' +
        '<div class="ss-cell' + (tt.net < 0 ? ' is-neg' : '') + '"><span class="ss-k">' + ICON('balance', 13) + '结余</span>' +
          '<span class="ss-v">' + fmt(tt.net) + '</span></div>' +
      '</div>' + budgetHtml +
    '</section>';

    if (!list.length) {
      out += emptyState('ledger', '本月还没有记录',
        '记下第一笔，账簿就开始有了脉络。',
        '<button class="btn btn--primary" data-act="new">' + ICON('plus', 17) + '记一笔</button>');
      return out;
    }

    out += '<section class="ledger">';
    days.forEach(function (g, gi) {
      out += '<div class="day' + (gi === days.length - 1 ? ' is-last' : '') + '" style="--i:' + Math.min(gi, 12) + '">' +
        '<div class="day-head"><span class="tick"></span>' +
          '<span class="day-date">' + dayLabel(g.date) + '</span>' +
          '<span class="day-dow">' + dowLabel(g.date) + '</span>' +
          '<span class="day-rule"></span>' +
          '<span class="day-total">' + (g.exp ? '−' + fmt(g.exp) : (g.inc ? '+' + fmt(g.inc) : '—')) + '</span>' +
        '</div>' +
        '<div class="day-body">' + g.items.map(function (t) { return txnRow(t); }).join('') + '</div>' +
      '</div>';
    });
    out += '</section>';

    /* 账簿的收口：本月合计 */
    out += '<section class="ledger-sum">' +
      '<div class="ls-head">本月合计</div>' +
      '<div class="ls-row"><span>收入</span><b class="pos">+' + fmt(tt.inc) + '</b></div>' +
      '<div class="ls-row"><span>支出</span><b>−' + fmt(tt.exp) + '</b></div>' +
      '<div class="ls-total"><span>结余</span><b class="' + (tt.net < 0 ? 'is-neg' : '') + '">' +
        fmt(tt.net) + '</b></div>' +
    '</section>';
    return out;
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function uniqueDays(list) {
    var s = {}; list.forEach(function (t) { s[t.date] = 1; }); return Object.keys(s).length;
  }

  /* ---------- 统计 ---------- */
  function viewStats() {
    var list = monthTxns(UI.month), kind = UI.statsKind;
    var rows = catTotals(list, kind);
    var tt = totals(list);
    var sum = rows.reduce(function (s, r) { return s + r.amount; }, 0);
    var out = '';

    out += '<div class="switch" style="margin:6px 0 2px">' +
      '<button data-act="stats-kind" data-kind="expense" class="' + (kind === 'expense' ? 'is-on' : '') + '">支出</button>' +
      '<button data-act="stats-kind" data-kind="income" class="' + (kind === 'income' ? 'is-on' : '') + '">收入</button>' +
    '</div>';

    if (!rows.length) {
      out += emptyState('chart', '这个月还没有' + (kind === 'expense' ? '支出' : '收入'),
        '记一笔之后，这里会显示分类占比与趋势。');
      out += trendBlock();
      return out;
    }

    out += '<div class="donut-wrap">' + donut(rows, sum, kind) +
      '<div class="donut-center"><span class="dk">' + (kind === 'expense' ? '支出合计' : '收入合计') + '</span>' +
      '<span class="dv">' + esc(DB.settings.currency) + ' ' + fmtShort(sum) + '</span></div></div>';

    out += '<div class="catlist">';
    rows.forEach(function (r, ri) {
      var pct = sum ? (r.amount / sum * 100) : 0;
      out += '<button class="catrow" style="--i:' + Math.min(ri, 14) + '" data-act="cat-drill" data-id="' + r.id + '">' +
        '<span class="row-cat" style="background:' + hexA(r.color, .17) + ';color:' + r.color + ';box-shadow:none">' + ICON(r.icon, 17) + '</span>' +
        '<span class="bar">' +
          '<span class="bar-top"><span class="nm">' + esc(r.name) + '</span>' +
          '<span class="pv">' + pct.toFixed(pct < 10 ? 1 : 0) + '%</span></span>' +
          '<span class="track"><i style="width:' + pct.toFixed(1) + '%;background:' + r.color + '"></i></span>' +
        '</span>' +
        '<span class="amt">' + fmt(r.amount) + '</span>' +
      '</button>';
    });
    out += '</div>';
    out += trendBlock();
    return out;
  }
  function donut(rows, sum, kind) {
    var R = 74, C = 2 * Math.PI * R, off = 0, segs = '';
    var gap = rows.length > 1 ? 3.2 : 0;   // 段与段之间留一道细缝
    rows.forEach(function (r) {
      var len = sum ? (r.amount / sum) * C : 0;
      var span = Math.max(0.6, len - gap);
      segs += '<circle cx="100" cy="100" r="' + R + '" stroke="' + r.color + '" stroke-width="20"' +
        ' stroke-dasharray="' + span.toFixed(2) + ' ' + (C - span).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-(off + gap / 2)).toFixed(2) + '"></circle>';
      off += len;
    });
    return '<svg class="donut" width="200" height="200" viewBox="0 0 200 200">' +
      '<circle cx="100" cy="100" r="' + R + '" stroke="var(--surface-3)" stroke-width="20"></circle>' + segs + '</svg>';
  }
  function trendBlock() {
    var s = monthSeries(UI.month, 6);
    var max = Math.max.apply(null, s.map(function (m) { return Math.max(m.exp, m.inc); }).concat([1]));
    var h = '<div class="group-title" style="margin-top:26px">近六个月</div><div class="bars">';
    s.forEach(function (m, mi) {
      h += '<div class="bar-col' + (m.key === UI.month ? ' is-on' : '') + '">' +
        '<div class="bar-pair">' +
          '<i class="b-exp" style="--i:' + mi + ';height:' + Math.max(2, Math.round(m.exp / max * 100)) + '%"></i>' +
          '<i class="b-inc" style="--i:' + (mi + .5) + ';height:' + Math.max(2, Math.round(m.inc / max * 100)) + '%"></i>' +
        '</div><span class="bm">' + m.label + '</span></div>';
    });
    h += '</div><div class="legend"><span><i style="background:var(--ink)"></i>支出</span>' +
         '<span><i style="background:var(--jade);opacity:.5"></i>收入</span></div>';
    return h;
  }

  /* ---------- 账户 ---------- */
  function viewAccounts() {
    var gross = DB.accounts.reduce(function (s, a) { return s + Math.abs(accountBalance(a.id)); }, 0) || 1;
    var out = '';
    if (!DB.accounts.length) {
      return out + emptyState('wallet', '还没有账户', '添加现金、银行卡或电子钱包，记账时就能选择来源。',
        '<button class="btn btn--primary" data-act="acct-new">' + ICON('plus', 17) + '新增账户</button>');
    }
    out += DB.accounts.map(function (a) {
      var b = accountBalance(a.id);
      var share = Math.max(2, Math.round(Math.abs(b) / gross * 100));
      return '<button class="acct" data-act="acct-edit" data-id="' + a.id + '">' +
        '<span class="bubble">' + ICON(a.icon, 19) + '</span>' +
        '<span class="am"><span class="an">' + esc(a.name) + '</span>' +
          '<span class="at">' + esc(a.type) + '</span>' +
          '<span class="track"><i style="width:' + share + '%"></i></span>' +
        '</span>' +
        '<span class="av' + (b < 0 ? ' is-neg' : '') + '">' + fmt(b) + '</span>' +
      '</button>';
    }).join('');
    out += '<div style="margin-top:22px"><button class="btn btn--ghost btn--block" data-act="acct-new">' +
      ICON('plus', 17) + '新增账户</button></div>';
    return out;
  }

  /* ---------- 设置 ---------- */
  var ACCENTS = [
    ['cinnabar', '朱砂'], ['jade', '松绿'], ['indigo', '黛蓝'], ['violet', '紫棠'], ['amber', '琥珀']
  ];
  var ACCENT_SWATCH = { cinnabar: '#C24A32', jade: '#1E7A5F', indigo: '#2D5FA8', violet: '#7D4E9F', amber: '#B07414' };
  var FONTS = [['sans', '默认'], ['system', '系统'], ['serif', '宋体'], ['kai', '楷体'], ['mono', '等宽']];
  var FONT_SCALES = [[0.92, '小'], [1, '标准'], [1.08, '大'], [1.16, '特大']];
  function viewSettings() {
    var s = DB.settings;
    return '' +
    '<div class="group"><div class="group-title">外观</div>' +
      '<div class="item"><span class="il"><span class="iname">主题</span>' +
        '<span class="isub">深色模式跟随系统或手动指定</span></span>' +
        '<span class="seg-mini">' +
          '<button data-act="theme" data-v="light" class="' + (s.theme === 'light' ? 'is-on' : '') + '">浅色</button>' +
          '<button data-act="theme" data-v="dark" class="' + (s.theme === 'dark' ? 'is-on' : '') + '">深色</button>' +
          '<button data-act="theme" data-v="auto" class="' + (s.theme === 'auto' ? 'is-on' : '') + '">跟随</button>' +
        '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">配色</span>' +
        '<span class="isub">整套纸面色随主题更换</span></span>' +
        '<span class="swatches">' + ACCENTS.map(function (a) {
          return '<button class="swatch' + (s.accent === a[0] ? ' is-on' : '') + '" data-act="accent" data-v="' + a[0] +
            '" title="' + a[1] + '" style="background:' + ACCENT_SWATCH[a[0]] + '"></button>';
        }).join('') + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">字体</span>' +
        '<span class="isub">正文与数字一起换，宋体楷体看设备字库</span></span>' +
        '<span class="seg-mini seg-wrap">' + FONTS.map(function (f) {
          return '<button data-act="font" data-v="' + f[0] + '" class="' + (s.font === f[0] ? 'is-on' : '') + '">' + f[1] + '</button>';
        }).join('') + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">字号</span></span>' +
        '<span class="seg-mini">' + FONT_SCALES.map(function (f) {
          return '<button data-act="fontscale" data-v="' + f[0] + '" class="' + ((+s.fontScale || 1) === f[0] ? 'is-on' : '') + '">' + f[1] + '</button>';
        }).join('') + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">货币符号</span></span>' +
        '<span class="seg-mini">' +
          ['¥', '$', '€', '£'].map(function (c) {
            return '<button data-act="currency" data-v="' + c + '" class="' + (s.currency === c ? 'is-on' : '') + '">' + c + '</button>';
          }).join('') +
        '</span></div>' +
    '</div>' +

    '<div class="group"><div class="group-title">记账</div>' +
      item('ledger', '账本', '当前：' + ledgerName(activeLedger()), 'ledgers', DB.ledgers.length + ' 个') +
      item('tag', '分类管理', '新增、改名、换色与图标', 'categories', '') +
      item('wallet', '账户管理', '现金、银行卡、电子钱包', 'accounts', '') +
      item('target', '月度预算', s.budget > 0 ? esc(s.currency) + ' ' + fmt(s.budget) : '未设置', 'budget', '') +
    '</div>' +

    '<div class="group"><div class="group-title">数据</div>' +
      item('reset', '自动备份', (s.autoSave ? '已开启' : '已关闭') + (s.lastAutoSave ? ' · 上次 ' + s.lastAutoSave : ''), 'auto-backup', '') +
      item('download', '导出 CSV', '可用 Excel 或表格软件打开', 'export-csv', '') +
      item('file', '备份为 JSON', '完整保留分类、账户与流水', 'export-json', '') +
      item('reset', '从备份恢复', '选择之前导出的 JSON 文件', 'import', '') +
      item('ledger', '载入示例数据', '清除现有记录并填入演示账目', 'demo', '') +
      item('trash', '清空所有数据', '删除全部流水，保留分类与账户', 'clear-txns', '', true) +
    '</div>' +

    '<div class="group"><div class="group-title">关于</div>' +
      item('info', '记账本', '版本 ' + APP_VERSION + ' · 本地优先，数据不出设备', 'about', '') +
    '</div>';
  }
  function item(icon, name, sub, panel, val, danger) {
    return '<button class="item' + (danger ? ' is-danger' : '') + '" data-act="panel" data-panel="' + panel + '">' +
      '<span class="fico" style="color:var(--ink-3)">' + ICON(icon, 19) + '</span>' +
      '<span class="il"><span class="iname">' + esc(name) + '</span>' +
      (sub ? '<span class="isub">' + esc(sub) + '</span>' : '') + '</span>' +
      (val ? '<span class="ival">' + esc(val) + '</span>' : '') +
      '<span class="chev">' + ICON('next', 16) + '</span></button>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    renderTop();
    var v = document.getElementById('view');
    var body = UI.tab === 'home' ? viewHome() : UI.tab === 'stats' ? viewStats()
      : UI.tab === 'accounts' ? viewAccounts() : viewSettings();
    v.innerHTML = body;
    renderTabbar();
    renderFab();
    if (UI.panel) renderPanel();
    if (UI.tab === 'home') animateHero(totals(monthTxns(UI.month)).exp);
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* 月份切换时，抬头数字从上一个值滚到新值 */
  function animateHero(cents) {
    var ei = document.getElementById('sum-int'), ed = document.getElementById('sum-dec');
    if (!ei || !ed) return;
    var from = UI.heroShown;
    UI.heroShown = cents;
    if (reducedMotion() || from === cents) return;
    var span = cents - from, t0 = 0, dur = 620;
    function paint(v) {
      var a = Math.abs(v);
      ei.textContent = fmtInt(Math.floor(a / 100));
      ed.textContent = '.' + pad2(a % 100);
    }
    function tick(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      paint(Math.round(from + span * (1 - Math.pow(1 - p, 3))));
      if (p < 1 && document.getElementById('sum-int')) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function renderTabbar() {
    var tabs = [['home', '明细', 'list'], ['stats', '统计', 'chart'], ['accounts', '账户', 'wallet'], ['settings', '设置', 'settings']];
    document.getElementById('tabbar').innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (UI.tab === t[0] ? ' is-on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' +
        '<span class="tabicon">' + ICON(t[2], 21) + '</span><span>' + t[1] + '</span></button>';
    }).join('');
  }
  function renderFab() {
    var old = document.querySelector('.compose-fab');
    if (old) old.remove();
    if (UI.tab === 'settings' || UI.panel) return;
    var b = document.createElement('button');
    b.className = 'compose-fab';
    b.setAttribute('data-act', 'new');
    b.innerHTML = ICON('plus', 19) + '<span>记一笔</span>';
    document.getElementById('phone').appendChild(b);
  }
  /* 应用标记：一张带装订线的账页，和启动图标同一套几何。
     currentColor 是纸面颜色，线条用容器底色「镂空」出来。 */
  function ledgerMark(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 108 108" aria-hidden="true">' +
      '<rect x="33" y="29" width="42" height="50" rx="5" fill="currentColor"/>' +
      '<g stroke="var(--accent)" stroke-linecap="round" fill="none">' +
        '<path d="M44.5,35 V73" stroke-width="4.5"/>' +
        '<path d="M52,41 H69" stroke-width="5.5"/>' +
        '<path d="M52,54 H69" stroke-width="5.5"/>' +
        '<path d="M52,67 H61" stroke-width="5.5"/>' +
      '</g></svg>';
  }
  function scrollTop() { var v = document.getElementById('view'); if (v) v.scrollTop = 0; }

  /* ---------- 面板 ---------- */
  var ov, panelEl;
  function openPanel(name, data) {
    if (UI.panel && UI.panel !== name) UI.stack.push(UI.panel);
    UI.panel = name;
    if (name === 'compose') UI.draft = data || newDraft();
    if (name === 'picker') UI.picker = data || UI.picker;
    if (name === 'confirm') UI.confirm = data || UI.confirm;
    render();
  }
  function closePanel() {
    UI.picker = null; UI.confirm = null;
    if (UI.stack.length) { UI.panel = UI.stack.pop(); renderPanel(); return; }
    UI.panel = null;
    if (ov) {
      ov.classList.remove('is-in');
      var o = ov;
      setTimeout(function () { o.hidden = true; o.innerHTML = ''; }, 200);
    }
    render();
  }
  /* 直接跳到某个面板并清空返回栈（用于选择完成后回到记账面板） */
  function setPanel(name) { UI.stack = []; UI.panel = name; render(); }
  function renderPanel() {
    ov = document.getElementById('overlay');
    var html = '', wide = false;
    if (UI.panel === 'compose') html = panelCompose();
    else if (UI.panel === 'picker') html = panelPicker();
    else if (UI.panel === 'confirm') { html = panelConfirm(); wide = true; }
    else if (UI.panel === 'search') html = panelSearch();
    else if (UI.panel === 'categories') html = panelCategories();
    else if (UI.panel === 'ledgers') html = panelLedgers();
    else if (UI.panel === 'budget') html = panelBudget();
    else if (UI.panel === 'about') html = panelAbout();
    else if (UI.panel === 'month-pick') html = panelMonthPick();
    else if (UI.panel === 'cat-drill') html = panelCatDrill();
    else if (UI.panel === 'acct-edit') html = panelAccountEdit();
    else if (UI.panel === 'cat-edit') html = panelCategoryEdit();
    else if (UI.panel === 'auto-backup') html = panelAutoBackup();
    ov.hidden = false;
    ov.innerHTML = html;
    requestAnimationFrame(function () { ov.classList.add('is-in'); });
    var focus = ov.querySelector('[data-autofocus]');
    if (focus) setTimeout(function () { focus.focus(); }, 220);
  }
  function panelHead(title, right) {
    return '<div class="panel-head">' +
      '<button class="iconbtn" data-act="close" title="返回">' + ICON('back', 20) + '</button>' +
      '<h2>' + esc(title) + '</h2>' + (right || '') + '</div>';
  }
  function panelShell(title, bodyHtml, footHtml, cls) {
    return '<div class="panel' + (cls ? ' ' + cls : '') + '">' + panelHead(title) +
      '<div class="panel-body">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="panel-foot">' + footHtml + '</div>' : '') + '</div>';
  }
  function panelConfirm() {
    var c = UI.confirm || { title: '', text: '', ok: '确定', onOk: function () {} };
    return '<div class="dialog"><h3>' + esc(c.title) + '</h3><p>' + esc(c.text) + '</p>' +
      '<div class="dialog-actions">' +
        '<button class="btn btn--ghost" data-act="close">取消</button>' +
        '<button class="btn ' + (c.danger ? 'btn--warn' : 'btn--primary') + '" data-act="confirm-ok">' + esc(c.ok) + '</button>' +
      '</div></div>';
  }

  /* ---------- 记账面板 ---------- */
  function newDraft() {
    return {
      id: null, type: 'expense', typeDraft: 'expense', amountStr: '',
      category: null, account: DB.accounts[0] ? DB.accounts[0].id : null,
      toAccount: DB.accounts[1] ? DB.accounts[1].id : null,
      date: today(), time: nowTime(), note: ''
    };
  }
  function panelCompose() {
    var d = UI.draft, isT = d.typeDraft === 'transfer';
    var cats = DB.categories.filter(function (c) { return c.kind === d.typeDraft && !c.archived; })
      .sort(function (a, b) { return a.order - b.order; });

    /* 固定区：类型切换 + 金额，滚动时始终可见 */
    var top = '<div class="segmented">' +
      ['expense', 'income', 'transfer'].map(function (k) {
        var label = k === 'expense' ? '支出' : k === 'income' ? '收入' : '转账';
        return '<button data-act="kind" data-kind="' + k + '" class="' + (d.typeDraft === k ? 'is-on' : '') + '">' + label + '</button>';
      }).join('') + '</div>' +
      '<div class="amount-box">' +
        '<div class="amount-line"><span class="cur">' + esc(DB.settings.currency) + '</span>' +
        (d.amountStr ? '<span class="amt-str">' + d.amountStr + '</span>' : '') +
        '<span class="caret"></span></div>' +
        '<div class="amount-hint">' + (d.amountStr
          ? (isT ? '账户之间转移，不计入收支' : d.typeDraft === 'income' ? '记一笔收入' : '记一笔支出')
          : '输入金额') + '</div>' +
      '</div>';

    /* 滚动区：分类九宫格 + 明细字段 */
    var body = '';

    if (!isT) {
      body += '<div class="catgrid">' + cats.map(function (c) {
        var on = d.category === c.id;
        return '<button class="cat' + (on ? ' is-on' : '') + '" data-act="pick-cat" data-id="' + c.id + '" data-kind="' + c.kind + '">' +
          '<span class="bubble">' + ICON(c.icon, 19) + '</span>' +
          '<span>' + esc(c.name) + '</span></button>';
      }).join('') + '</div>';
      body += '<div style="text-align:center;margin:8px 0 2px"><button class="btn btn--ghost" data-act="panel" data-panel="categories" style="height:32px;font-size:12.5px">' +
        ICON('edit', 14) + '管理分类</button></div>';
    }

    body += '<div class="fields">';
    if (isT) {
      body += fieldRow('transfer', '从', acct(d.account).name, 'pick-account', 'account');
      body += fieldRow('transfer', '到', acct(d.toAccount).name, 'pick-account', 'toAccount');
    } else {
      body += fieldRow('wallet', '账户', acct(d.account).name, 'pick-account', 'account');
    }
    body += '<div class="field"><span class="fico">' + ICON('calendar', 18) + '</span>' +
      '<span class="fk">日期</span>' +
      '<button class="fv" data-act="pick-date">' + dayLabel(d.date) + ' ' + d.time + '</button></div>';
    body += '<div class="field"><span class="fico">' + ICON('edit', 18) + '</span>' +
      '<span class="fk">备注</span>' +
      '<input class="fv" data-role="note" placeholder="添加备注" value="' + esc(d.note) + '"></div>';
    if (d.id) {
      body += '<div class="duo" style="margin:16px 0 2px">' +
        '<button class="btn btn--ghost" data-act="dup-txn" data-id="' + d.id + '">' + ICON('plus', 16) + '再记一笔</button>' +
        '<button class="btn btn--danger" data-act="del-txn" data-id="' + d.id + '">' + ICON('trash', 16) + '删除</button>' +
      '</div>';
    }
    body += '</div>';

    var foot = '<div class="keypad">' +
      key('1') + key('2') + key('3') + '<button class="key key--fn" data-act="key-back">' + ICON('backspace', 21) + '</button>' +
      key('4') + key('5') + key('6') + key('7') +
      key('8') + key('9') + key('.') + '<button class="key key--ok" data-act="save">' + ICON('check', 24) + '</button>' +
      '<button class="key key--fn" style="grid-column:span 2" data-act="key-clear">清零</button>' +
      key('0') +
    '</div>';

    return '<div class="panel panel--compose">' +
      panelHead(d.id ? '编辑记录' : '记一笔') +
      '<div class="compose-top">' + top + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot">' + foot + '</div></div>';
  }
  function key(k) { return '<button class="key" data-act="key" data-k="' + k + '">' + k + '</button>'; }
  function fieldRow(icon, label, value, act, target) {
    return '<div class="field"><span class="fico">' + ICON(icon, 18) + '</span>' +
      '<span class="fk">' + esc(label) + '</span>' +
      '<button class="fv" data-act="' + act + '" data-target="' + target + '">' + esc(value) + '</button></div>';
  }

  /* ---------- 通用选择器 / 日历 ---------- */
  var pickCtx = null;
  function openPicker(kind, opts) {
    if (UI.panel && UI.panel !== 'picker') UI.stack.push(UI.panel);
    pickCtx = { kind: kind, opts: opts };
    UI.panel = 'picker';
    render();
  }
  function panelPicker() {
    var c = pickCtx;
    if (!c) return panelShell('选择', '');
    if (c.kind === 'account') {
      var body = DB.accounts.map(function (a) {
        var on = UI.draft[c.opts.target] === a.id;
        return '<button class="acct" data-act="set-account" data-target="' + c.opts.target + '" data-id="' + a.id + '">' +
          '<span class="bubble">' + ICON(a.icon, 19) + '</span>' +
          '<span class="am"><span class="an">' + esc(a.name) + '</span>' +
          '<span class="at">' + esc(a.type) + ' · 余额 ' + fmt(accountBalance(a.id)) + '</span></span>' +
          (on ? '<span style="color:var(--accent)">' + ICON('check', 19) + '</span>' : '') + '</button>';
      }).join('');
      return panelShell('选择账户', body || emptyState('wallet', '还没有账户', '先在「账户」里新增一个。'));
    }
    if (c.kind === 'date') {
      return panelShell('选择日期', calendar(c.opts.date, c.opts.cursor));
    }
    if (c.kind === 'ledger') {
      var lb = DB.ledgers.map(function (l) {
        var on = activeLedger() === l.id;
        return '<div class="item"><span class="il"><span class="iname">' + esc(l.name) + '</span>' +
          '<span class="isub">' + ledgerTxnsOf(l.id).length + ' 笔记录</span></span>' +
          (on ? '<span class="ival" style="color:var(--accent)">' + ICON('check', 18) + '</span>' :
                '<button class="iconbtn" data-act="switch-ledger" data-id="' + l.id + '">' + ICON('next', 17) + '</button>') +
          (DB.ledgers.length > 1 ? '<button class="iconbtn" data-act="del-ledger" data-id="' + l.id + '">' + ICON('trash', 17) + '</button>' : '') +
        '</div>';
      }).join('');
      return panelShell('选择账本', lb);
    }
    return panelShell('选择', '');
  }
  function ledgerTxnsOf(id) { return DB.txns.filter(function (t) { return (t.ledger || 'ld1') === id; }); }

  function calendar(sel, cursor) {
    var cur = cursor || mk(sel), p = cur.split('-'), y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1).getDay();        // 0=周日
    var lead = (first + 6) % 7;                        // 从周一开始
    var n = daysInMonth(cur), cells = '';
    var i;
    for (i = 0; i < lead; i++) cells += '<span></span>';
    for (i = 1; i <= n; i++) {
      var ds = y + '-' + pad2(m) + '-' + pad2(i);
      var cls = 'cal-d' + (ds === sel ? ' is-on' : '') + (ds === today() ? ' is-today' : '');
      cells += '<button class="' + cls + '" data-act="pick-cal" data-d="' + ds + '">' + i + '</button>';
    }
    return '<div class="cal">' +
      '<div class="cal-head">' +
        '<button class="iconbtn" data-act="cal-shift" data-n="-1">' + ICON('back', 18) + '</button>' +
        '<b class="cal-title">' + y + '年' + m + '月</b>' +
        '<button class="iconbtn" data-act="cal-shift" data-n="1">' + ICON('next', 18) + '</button>' +
      '</div>' +
      '<div class="cal-dow">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<div class="cal-foot"><button class="btn btn--ghost" data-act="pick-cal" data-d="' + today() + '">回到今天</button></div>' +
    '</div>';
  }

  /* ---------- 搜索 ---------- */
  function searchResultsHtml() {
    var q = (UI.search || '').trim();
    var list = ledgerTxns().filter(function (t) {
      if (!q) return true;
      var c = cat(t.category);
      var hay = [c.name, t.note, acct(t.account).name, fmt(t.amount)].join(' ');
      return hay.toLowerCase().indexOf(q.toLowerCase()) >= 0;
    }).sort(function (a, b) { return (b.date + b.time) < (a.date + a.time) ? -1 : 1; }).slice(0, 200);
    return list.length
      ? '<div>' + list.map(function (t) { return txnRow(t); }).join('') + '</div>'
      : emptyState('search', q ? '没有匹配的记录' : '输入关键词开始搜索',
          q ? '换个说法试试，比如分类名或备注里的词。' : '可以搜备注、分类、账户，也可以直接搜金额。');
  }
  function panelSearch() {
    var q = (UI.search || '').trim();
    var body = '<div class="field" style="border:0;padding:0 0 10px">' +
      '<span class="fico">' + ICON('search', 18) + '</span>' +
      '<input class="fv" data-role="search" data-autofocus placeholder="搜索备注、分类、账户或金额" value="' + esc(q) + '" style="text-align:left"></div>' +
      '<div id="search-results">' + searchResultsHtml() + '</div>';
    return panelShell('搜索', body);
  }

  /* ---------- 分类管理 ---------- */
  function panelCategories() {
    var groups = [['expense', '支出分类'], ['income', '收入分类']];
    var body = groups.map(function (g) {
      var cats = DB.categories.filter(function (c) { return c.kind === g[0] && !c.archived; })
        .sort(function (a, b) { return a.order - b.order; });
      return '<div class="group-title" style="margin-top:6px">' + g[1] + '</div>' +
        cats.map(function (c) {
          return '<div class="item"><span class="fico" style="color:' + c.color + '">' + ICON(c.icon, 19) + '</span>' +
            '<span class="il"><span class="iname">' + esc(c.name) + '</span></span>' +
            '<button class="iconbtn" data-act="cat-edit" data-id="' + c.id + '">' + ICON('edit', 17) + '</button></div>';
        }).join('');
    }).join('');
    return panelShell('分类管理', body,
      '<button class="btn btn--primary btn--block" data-act="cat-new">' + ICON('plus', 17) + '新增分类</button>');
  }
  function panelCategoryEdit() {
    var c = UI.catDraft, isNew = !c.id;
    var icons = ['food', 'transport', 'shopping', 'home', 'fun', 'medical', 'study', 'gift', 'phone', 'utility',
      'pet', 'travel', 'sport', 'beauty', 'digital', 'rent', 'repay', 'salary', 'bonus', 'parttime',
      'invest', 'redpacket', 'reimburse', 'refund', 'other', 'tag', 'wallet', 'budget'];
    var body = '<div class="group-title">名称</div>' +
      '<input class="input" data-role="cat-name" data-autofocus value="' + esc(c.name) + '" placeholder="例如：早餐">' +
      '<div class="group-title" style="margin-top:20px">类型</div>' +
      '<div class="seg-mini">' +
        '<button data-act="cat-kind" data-v="expense" class="' + (c.kind === 'expense' ? 'is-on' : '') + '">支出</button>' +
        '<button data-act="cat-kind" data-v="income" class="' + (c.kind === 'income' ? 'is-on' : '') + '">收入</button>' +
      '</div>' +
      '<div class="group-title" style="margin-top:20px">图标</div>' +
      '<div class="catgrid" style="grid-template-columns:repeat(6,1fr)">' +
        icons.map(function (n) {
          return '<button class="cat' + (c.icon === n ? ' is-on' : '') + '" data-act="cat-icon" data-v="' + n + '" data-kind="' + c.kind + '">' +
            '<span class="bubble" style="width:36px;height:36px">' + ICON(n, 18) + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="group-title" style="margin-top:20px">颜色</div>' +
      '<div class="swatches">' + PALETTE.map(function (p) {
        return '<button class="swatch' + (c.color === p ? ' is-on' : '') + '" data-act="cat-color" data-v="' + p + '" style="background:' + p + '"></button>';
      }).join('') + '</div>' +
      (isNew ? '' : '<div style="margin-top:24px"><button class="btn btn--danger btn--block" data-act="cat-del" data-id="' + c.id + '">' +
        ICON('trash', 17) + '删除分类</button></div>');
    return panelShell(isNew ? '新增分类' : '编辑分类', body,
      '<button class="btn btn--primary btn--block" data-act="cat-save">保存</button>');
  }

  /* ---------- 账本 ---------- */
  function panelLedgers() {
    var body = DB.ledgers.map(function (l) {
      var on = activeLedger() === l.id;
      return '<div class="item"><span class="fico">' + ICON('ledger', 19) + '</span>' +
        '<button class="il" data-act="switch-ledger" data-id="' + l.id + '" style="text-align:left">' +
          '<span class="iname">' + esc(l.name) + '</span>' +
          '<span class="isub">' + ledgerTxnsOf(l.id).length + ' 笔' + (on ? ' · 当前账本' : '') + '</span></button>' +
        (on ? '<span class="ival" style="color:var(--accent)">' + ICON('check', 18) + '</span>' : '') +
        (DB.ledgers.length > 1 ? '<button class="iconbtn" data-act="del-ledger" data-id="' + l.id + '">' + ICON('trash', 17) + '</button>' : '') +
      '</div>';
    }).join('');
    body += '<div style="margin-top:22px"><div class="group-title">新建账本</div>' +
      '<input class="input" data-role="new-ledger" placeholder="例如：旅行账本、装修账本"></div>';
    return panelShell('账本', body,
      '<button class="btn btn--primary btn--block" data-act="ledger-add">' + ICON('plus', 17) + '创建账本</button>');
  }

  /* ---------- 预算 ---------- */
  function panelMonthPick() {
    var y = UI.pickYear || +UI.month.slice(0, 4);
    UI.pickYear = y;
    var nowKey = mk(today());
    var cells = '';
    for (var i = 1; i <= 12; i++) {
      var k = y + '-' + pad2(i);
      var cls = 'mp-cell' + (k === UI.month ? ' is-on' : '') + (k === nowKey && k !== UI.month ? ' is-now' : '');
      cells += '<button class="' + cls + '" data-act="pick-month" data-v="' + k + '">' + pad2(i) + ' 月</button>';
    }
    var body = '<div class="mp-year">' +
      '<button class="iconbtn" data-act="mp-year" data-n="-1">' + ICON('back', 18) + '</button>' +
      '<b>' + y + '</b>' +
      '<button class="iconbtn" data-act="mp-year" data-n="1">' + ICON('next', 18) + '</button>' +
    '</div><div class="mp-grid">' + cells + '</div>' +
    '<div class="mp-quick">' +
      '<button class="btn btn--ghost" data-act="pick-month" data-v="' + nowKey + '" style="flex:1">回到本月</button>' +
      '<button class="btn btn--ghost" data-act="pick-month" data-v="' + shiftMonth(nowKey, -1) + '" style="flex:1">上个月</button>' +
    '</div>';
    return panelShell('选择月份', body);
  }

  /* ---------- 分类下钻 ---------- */
  function panelCatDrill() {
    var c = cat(UI.drillCat);
    var list = monthTxns(UI.month).filter(function (t) { return t.category === UI.drillCat && t.type !== 'transfer'; });
    var sum = list.reduce(function (s, t) { return s + t.amount; }, 0);
    var body = '<div class="drill-head">' +
      '<span class="dk">' + monthLabel(UI.month) + ' · ' + list.length + ' 笔</span>' +
      '<span class="dv">' + esc(DB.settings.currency) + ' ' + fmt(sum) + '</span></div>' +
      (list.length ? '<div>' + list.map(function (t) { return txnRow(t, true); }).join('') + '</div>'
        : emptyState(c.icon, '本月没有' + c.name + '的记录', '换个月份看看，或者记一笔。'));
    return panelShell(c.name, body);
  }

  function panelBudget() {
    var body = '<div class="group-title">月度预算</div>' +
      '<input class="input input--num" data-role="budget" data-autofocus inputmode="decimal" value="' +
        (DB.settings.budget ? (DB.settings.budget / 100).toFixed(2) : '') + '" placeholder="0.00">' +
      '<p style="font-size:12.5px;color:var(--ink-3);margin:10px 0 0;line-height:1.6">' +
      '设置后，首页会按当月支出显示进度。留空或填 0 表示不启用。' +
      '预算只作用于当前账本。</p>';
    return panelShell('月度预算', body,
      '<button class="btn btn--primary btn--block" data-act="budget-save">保存</button>');
  }

  /* ---------- 账户编辑 ---------- */
  function panelAccountEdit() {
    var a = UI.acctDraft, isNew = !a.id;
    var body = '<div class="group-title">名称</div>' +
      '<input class="input" data-role="acct-name" data-autofocus value="' + esc(a.name) + '" placeholder="例如：招商银行">' +
      '<div class="group-title" style="margin-top:20px">类型</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + ACCOUNT_TYPES.map(function (t) {
        var on = a.type === t[0];
        return '<button class="btn" style="height:36px;padding:0 13px;font-size:13.5px;' +
          (on ? 'background:var(--ink);color:var(--bg)' : 'box-shadow:inset 0 0 0 1px var(--line-2);color:var(--ink-2)') +
          '" data-act="acct-type" data-v="' + t[0] + '" data-icon="' + t[1] + '">' +
          ICON(t[1], 15) + t[0] + '</button>';
      }).join('') + '</div>' +
      '<div class="group-title" style="margin-top:20px">初始余额</div>' +
      '<input class="input input--num" data-role="acct-init" inputmode="decimal" value="' +
        (a.initial ? (a.initial / 100).toFixed(2) : '') + '" placeholder="0.00">' +
      '<p style="font-size:12.5px;color:var(--ink-3);margin:10px 0 0;line-height:1.6">' +
      '信用卡欠款请填负数，例如 -3200.00。</p>' +
      (isNew ? '' : '<div style="margin-top:24px"><button class="btn btn--danger btn--block" data-act="acct-del" data-id="' + a.id + '">' +
        ICON('trash', 17) + '删除账户</button></div>');
    return panelShell(isNew ? '新增账户' : '编辑账户', body,
      '<button class="btn btn--primary btn--block" data-act="acct-save">保存</button>');
  }

  /* ---------- 关于 ---------- */
  function panelAbout() {
    var body = '<div class="empty" style="padding-top:12px">' +
      '<div class="empty-mark" style="background:var(--accent);color:var(--on-accent);width:64px;height:64px">' + ledgerMark(34) + '</div>' +
      '<h3 style="margin-top:6px">记账本</h3>' +
      '<p style="max-width:30ch">一笔一划，账目自清。所有数据只保存在这台设备上，不联网、不上传、不含广告与分析代码。</p></div>' +
      '<div class="item"><span class="il"><span class="iname">版本</span></span><span class="ival">' + APP_VERSION + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">记录笔数</span></span><span class="ival">' + DB.txns.length + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">分类 / 账户</span></span><span class="ival">' +
        DB.categories.length + ' / ' + DB.accounts.length + '</span></div>' +
      '<div class="item"><span class="il"><span class="iname">存储方式</span></span><span class="ival">本机</span></div>' +
      '<p style="font-size:12.5px;color:var(--ink-3);line-height:1.7;margin:18px 0 0">' +
      '数据存在这台设备的浏览器里。清理浏览器数据或卸载应用会一并删掉，' +
      '所以建议隔一段时间用上面的「备份为 JSON」留一份。</p>';
    return panelShell('关于', body);
  }

  /* ---------- 自动备份 ----------
     每天第一次数据变更后自动留一份 JSON：
     安卓上写入系统「下载」目录（文件名带日期，一天至多一份）；
     所有平台都在本机存快照环（最近 7 天，超大时跳过以免撑爆配额）。
     iOS / 网页受浏览器限制无法后台静默写文件，快照照留，
     文件请用「立即备份一份」手动落到「文件」App。 */
  var AUTO_KEY = 'mozhang.autosave';
  var autoTimer = 0;
  function scheduleAutoSave() {
    if (!DB || !DB.settings.autoSave) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () { autoSaveIfDue(false); }, 6000);
  }
  function autoSaveIfDue(force) {
    if (!DB) return;
    if (!DB.settings.autoSave && !force) return;
    var d = today();
    /* 今天的文件已经写过：不再重复下载，但本机快照随改动刷新到最新，
       免得当天晚些时候误删，只能恢复到当天第一笔。 */
    if (DB.settings.lastAutoSave === d) { if (dirty) saveSnapshot(); return; }
    /* 网页可能开着多个标签页：本页没改过数据时不回写磁盘，
       防止陈旧标签页在隐藏/关闭时覆盖别的标签页刚记的账。 */
    if (!force && !dirty) return;
    writeAutoBackup();
  }
  function readAutoBackups() {
    try { return JSON.parse(localStorage.getItem(AUTO_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveSnapshot() {
    var json = JSON.stringify(DB), d = today();
    try {
      var arr = readAutoBackups().filter(function (x) { return x.d !== d; });
      if (json.length <= 400000) arr.push({ d: d, j: json });
      while (arr.length > 7) arr.shift();
      localStorage.setItem(AUTO_KEY, JSON.stringify(arr));
    } catch (e) { /* 配额不够就只留文件备份 */ }
  }
  function writeAutoBackup() {
    saveSnapshot();
    var d = today();
    try {
      if (window.Android && window.Android.saveFile) {
        window.Android.saveFile('记账本自动备份-' + d + '.json', 'application/json', JSON.stringify(DB));
      }
    } catch (e) { /* 非安卓环境 */ }
    DB.settings.lastAutoSave = d;
    save();
  }
  function isAppleWeb() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function panelAutoBackup() {
    var s = DB.settings;
    var snaps = readAutoBackups().slice().reverse();   // 新的排前面
    var explain;
    if (window.Android && window.Android.saveFile) {
      explain = '开启后，每天第一次记账或改动数据，会自动把备份写进系统「下载」目录（文件名带日期），同时在应用内保留最近 7 天的快照。';
    } else if (isAppleWeb()) {
      explain = 'iPhone / iPad 上系统不允许网页在后台自动写文件，所以自动备份只在本机留快照（最近 7 天）。想要文件的话，点下面的「立即备份一份」，Safari 会把它存进「文件」App。';
    } else {
      explain = '网页版每天自动在本机留一份快照（最近 7 天）；点「立即备份一份」可把 JSON 文件下载到本地。安卓安装版还会每天自动写进系统「下载」目录。';
    }
    var body = '<div class="item"><span class="il"><span class="iname">自动备份</span>' +
      '<span class="isub">每天第一次改动后自动留一份</span></span>' +
      '<span class="seg-mini"><button data-act="autosave-toggle" data-v="1" class="' + (s.autoSave ? 'is-on' : '') + '">开</button>' +
      '<button data-act="autosave-toggle" data-v="0" class="' + (!s.autoSave ? 'is-on' : '') + '">关</button></span></div>' +
      '<p style="font-size:12.5px;color:var(--ink-3);line-height:1.7;margin:10px 0 0">' + explain +
      '快照只在误删、误清后用来找回数据，不影响当前账目。</p>' +
      '<div class="group-title" style="margin-top:20px">本机快照</div>' +
      (snaps.length ? snaps.map(function (x, i) {
        var n = 0; try { n = (JSON.parse(x.j).txns || []).length; } catch (e) { /* 损坏的跳过计数 */ }
        return '<div class="item"><span class="il"><span class="iname">' + esc(x.d) + '</span>' +
          '<span class="isub">' + n + ' 笔 · 约 ' + Math.ceil(x.j.length / 1024) + ' KB</span></span>' +
          '<button class="btn btn--ghost" style="height:32px;padding:0 12px" data-act="autosave-restore" data-i="' + (snaps.length - 1 - i) + '">恢复</button></div>';
      }).join('') : '<div class="item"><span class="il"><span class="isub">还没有快照，改一笔数据或点「立即备份」就会生成。</span></span></div>');
    return panelShell('自动备份', body,
      '<button class="btn btn--primary btn--block" data-act="autosave-now">' + ICON('download', 17) + '立即备份一份</button>');
  }

  /* ---------- 数据导入导出 ---------- */
  function download(name, mime, text) {
    try {
      if (window.Android && window.Android.saveFile) { window.Android.saveFile(name, mime, text); return true; }
    } catch (e) { /* 非安卓环境 */ }
    try {
      var blob = new Blob(['\ufeff' + text], { type: mime + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
      return true;
    } catch (e) { return false; }
  }
  function exportCSV() {
    var rows = [['日期', '时间', '类型', '分类', '金额', '账户', '转入账户', '备注', '账本']];
    ledgerTxns().slice().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; })
      .forEach(function (t) {
        rows.push([t.date, t.time || '',
          t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账',
          t.type === 'transfer' ? '' : cat(t.category).name,
          (t.amount / 100).toFixed(2),
          acct(t.account).name, t.toAccount ? acct(t.toAccount).name : '',
          t.note || '', ledgerName(t.ledger)]);
      });
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var name = '记账本-' + today() + '.csv';
    download(name, 'text/csv', csv) ? toast('已导出 ' + name) : toast('导出失败');
  }
  function exportJSON() {
    var name = '记账本备份-' + today() + '.json';
    download(name, 'application/json', JSON.stringify(DB, null, 2)) ? toast('已保存 ' + name) : toast('导出失败');
  }
  function importJSON() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.categories) || !Array.isArray(d.txns)) throw new Error('格式不符');
          DB = normalizeDB(d); commit(); applyTheme(); applyFont();
          UI.month = mk(today()); UI.tab = 'home';
          closePanel(); render();
          toast('已恢复 ' + d.txns.length + ' 笔记录');
        } catch (e) { toast('文件无法识别：' + e.message); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }
  function seedDemo() {
    DB.txns = [];
    var cid = {};
    DB.categories.forEach(function (c) { cid[c.kind + ':' + c.name] = c.id; });
    var A = { 现金: 'a1', 微信: 'a2', 支付宝: 'a3', 银行卡: 'a4' };
    var T = today().split('-').map(Number);
    function push(type, catName, amount, account, note, dayOffset) {
      var dt = new Date(T[0], T[1] - 1, T[2] - dayOffset);
      DB.txns.push({
        id: uid(), ledger: 'ld1', type: type,
        amount: Math.round(amount * 100),
        category: cid[type + ':' + catName] || null,
        account: A[account] || 'a1', toAccount: null,
        date: dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()),
        time: pad2(8 + (dayOffset * 3) % 12) + ':' + pad2((dayOffset * 17) % 60),
        note: note, createdAt: Date.now() - dayOffset * 86400000
      });
    }
    var plan = [
      ['expense', '餐饮', 12.5, '微信', '食堂二楼的套餐', 0],
      ['expense', '交通', 2, '支付宝', '公交', 0],
      ['expense', '餐饮', 8, '微信', '早八路上买的包子', 1],
      ['expense', '日用', 23.8, '支付宝', '超市：洗衣液、纸巾', 1],
      ['expense', '学习', 45, '支付宝', '专业课教材（二手）', 2],
      ['expense', '娱乐', 32, '微信', '电影票 · 学生场', 2],
      ['expense', '餐饮', 15, '现金', '和室友吃麻辣烫', 3],
      ['expense', '通讯', 30, '支付宝', '手机话费充值', 4],
      ['expense', '医疗', 46.5, '支付宝', '感冒药', 5],
      ['expense', '购物', 89, '支付宝', '换季的卫衣', 6],
      ['expense', '住宿', 1200, '银行卡', '这学期宿舍费', 7],
      ['expense', '餐饮', 26, '微信', '宿舍夜宵', 9],
      ['expense', '交通', 16.8, '支付宝', '打车回学校', 10],
      ['expense', '娱乐', 25, '微信', '视频会员月卡', 11],
      ['expense', '学习', 18.6, '支付宝', '打印店：论文装订', 13],
      ['expense', '餐饮', 58, '微信', '同学聚餐', 16],
      ['income', '生活费', 1500, '银行卡', '本月生活费', 3],
      ['income', '兼职', 300, '微信', '周末家教', 11],
      ['income', '奖学金', 500, '银行卡', '学业奖学金', 15],
      ['income', '红包', 66, '微信', '室友发的红包', 18]
    ];
    plan.forEach(function (p) { push(p[0], p[1], p[2], p[3], p[4], p[5]); });
    // 前一个月，让趋势图有形状
    var prev = [
      ['expense', '餐饮', 620, '微信', '上个月吃饭汇总', 0],
      ['expense', '住宿', 1200, '银行卡', '宿舍费', 5],
      ['expense', '购物', 240, '支付宝', '买了双鞋', 9],
      ['expense', '交通', 86, '支付宝', '校车与地铁', 12],
      ['income', '生活费', 1500, '银行卡', '上月生活费', 3],
      ['income', '兼职', 450, '微信', '兼职收入', 15]
    ];
    prev.forEach(function (p) { push(p[0], p[1], p[2], p[3], p[4], p[5] + 31); });
    DB.settings.budget = DB.settings.budget || 150000;
    DB.accounts[0].initial = 20000;
    DB.accounts[1].initial = 30000;
    DB.accounts[2].initial = 45000;
    DB.accounts[3].initial = 260000;
    commit();
  }

  /* ---------- 事件 ---------- */
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.hidden = true; }, 240);
    }, 1800);
  }
  function confirmBox(title, text, ok, onOk, danger) {
    openPanel('confirm', { title: title, text: text, ok: ok, onOk: onOk, danger: !!danger });
  }
  function handleClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) {
      var rc = e.target.closest('.row');
      return;
    }
    var act = t.getAttribute('data-act');
    switch (act) {
      case 'tab':
        UI.tab = t.getAttribute('data-tab'); UI.panel = null; UI.stack = [];
        render(); scrollTop(); break;
      case 'month':
        UI.month = shiftMonth(UI.month, +t.getAttribute('data-n'));
        render(); scrollTop(); break;
      case 'stats-kind':
        UI.statsKind = t.getAttribute('data-kind'); render(); break;
      case 'new': openPanel('compose', newDraft()); break;
      case 'edit': {
        var tx = DB.txns.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        if (tx) openPanel('compose', {
          id: tx.id, typeDraft: tx.type, type: tx.type,
          amountStr: (tx.amount / 100).toFixed(2),
          category: tx.category, account: tx.account, toAccount: tx.toAccount || (DB.accounts[1] && DB.accounts[1].id),
          date: tx.date, time: tx.time || '00:00', note: tx.note || ''
        });
        break;
      }
      case 'close':
        /* 半途退出记账面板时问一句，避免白输 */
        if (UI.panel === 'compose' && !UI.draft.id && UI.draft.amountStr) {
          confirmBox('放弃这笔记录？', '已经输入的内容不会保存。', '放弃', function () {
            UI.stack = []; UI.panel = null;
          });
          break;
        }
        closePanel();
        break;
      case 'pick-month':
        UI.month = t.getAttribute('data-v');
        closePanel(); scrollTop(); break;
      case 'mp-year':
        UI.pickYear = (UI.pickYear || +UI.month.slice(0, 4)) + (+t.getAttribute('data-n'));
        renderPanel(); break;
      case 'cat-drill':
        UI.drillCat = t.getAttribute('data-id');
        openPanel('cat-drill'); break;
      case 'dup-txn': {
        var src = DB.txns.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
        if (!src) break;
        UI.stack = [];
        UI.draft = {
          id: null, typeDraft: src.type, type: src.type,
          amountStr: (src.amount / 100).toFixed(2),
          category: src.category, account: src.account,
          toAccount: src.toAccount || (DB.accounts[1] && DB.accounts[1].id),
          date: today(), time: nowTime(), note: src.note || ''
        };
        UI.panel = 'compose';
        render();
        toast('已复制，确认后保存');
        break;
      }
      case 'confirm-ok':
        var fn = UI.confirm && UI.confirm.onOk;
        UI.stack = []; UI.panel = null; UI.confirm = null;
        if (ov) { ov.classList.remove('is-in'); ov.hidden = true; ov.innerHTML = ''; }
        if (fn) fn();
        render();
        break;
      case 'panel': openPanel(t.getAttribute('data-panel')); break;
      case 'kind':
        UI.draft.typeDraft = t.getAttribute('data-kind');
        UI.draft.category = null;
        render(); break;
      case 'pick-cat':
        UI.draft.category = t.getAttribute('data-id'); render(); break;
      case 'key': keyPress(t.getAttribute('data-k')); break;
      case 'key-back': keyBack(); break;
      case 'key-clear': UI.draft.amountStr = ''; refreshAmount(); break;
      case 'pick-account':
        openPicker('account', { target: t.getAttribute('data-target') });
        break;
      case 'set-account':
        UI.draft[t.getAttribute('data-target')] = t.getAttribute('data-id');
        setPanel('compose'); break;
      case 'pick-date':
        openPicker('date', { date: UI.draft.date, cursor: mk(UI.draft.date) });
        break;
      case 'cal-shift':
        var cur = (ov.querySelector('.cal-title') || {}).textContent || '';
        var mm = cur.match(/(\d+)年(\d+)月/);
        var ny = mm ? +mm[1] : +UI.draft.date.slice(0, 4), nm = mm ? +mm[2] : +UI.draft.date.slice(5, 7);
        var nd = new Date(ny, nm - 1 + (+t.getAttribute('data-n')), 1);
        openPicker('date', { date: UI.draft.date, cursor: nd.getFullYear() + '-' + pad2(nd.getMonth() + 1) });
        break;
      case 'pick-cal':
        UI.draft.date = t.getAttribute('data-d');
        setPanel('compose'); break;
      case 'save': saveDraft(); break;
      case 'del-txn':
        var id = t.getAttribute('data-id');
        confirmBox('删除这笔记录？', '删除后无法撤销。', '删除', function () {
          DB.txns = DB.txns.filter(function (x) { return x.id !== id; });
          commit(); closePanel(); toast('已删除');
        }, true);
        break;
      case 'theme':
        DB.settings.theme = t.getAttribute('data-v'); commit(); applyTheme(); render(); break;
      case 'accent':
        DB.settings.accent = t.getAttribute('data-v'); commit(); applyTheme(); render(); break;
      case 'font':
        DB.settings.font = t.getAttribute('data-v'); commit(); applyFont(); render(); break;
      case 'fontscale':
        DB.settings.fontScale = +t.getAttribute('data-v'); commit(); applyFont(); render(); break;
      case 'autosave-toggle':
        DB.settings.autoSave = t.getAttribute('data-v') === '1';
        save(); render();
        toast(DB.settings.autoSave ? '自动备份已开启' : '自动备份已关闭');
        break;
      case 'autosave-now': {
        if (window.Android && window.Android.saveFile) {
          /* 安卓：与自动备份同路——写入「下载」+ 本机快照，原生侧自带提示 */
          writeAutoBackup();
        } else {
          /* 网页 / iOS：点一下就把文件交给你（Safari 会存进「下载」或「文件」） */
          saveSnapshot();
          DB.settings.lastAutoSave = today(); save();
          var ok = download('记账本备份-' + today() + '.json', 'application/json', JSON.stringify(DB, null, 2));
          toast(ok ? '已保存备份文件' : '导出失败');
        }
        renderPanel();
        break;
      }
      case 'autosave-restore': {
        var snap = readAutoBackups()[+t.getAttribute('data-i')];
        if (!snap) break;
        confirmBox('恢复这份快照？', '当前数据会被 ' + snap.d + ' 的快照整体替换。', '恢复', function () {
          try {
            DB = normalizeDB(JSON.parse(snap.j));
            commit(); applyTheme(); applyFont();
            UI.month = mk(today()); UI.tab = 'home';
            closePanel(); render();
            toast('已恢复到 ' + snap.d + ' 的快照');
          } catch (e) { toast('快照已损坏，无法恢复'); }
        }, true);
        break;
      }
      case 'currency':
        DB.settings.currency = t.getAttribute('data-v'); commit(); render(); break;
      case 'ledger-add': {
        var inp = ov.querySelector('[data-role="new-ledger"]');
        var nm2 = (inp && inp.value || '').trim();
        if (!nm2) { toast('请输入账本名称'); break; }
        var nl = { id: 'ld' + uid(), name: nm2 };
        DB.ledgers.push(nl); DB.currentLedger = nl.id; commit(); closePanel(); render(); toast('已创建「' + nm2 + '」');
        break;
      }
      case 'switch-ledger':
        DB.currentLedger = t.getAttribute('data-id'); commit(); closePanel(); render(); break;
      case 'del-ledger': {
        var lid = t.getAttribute('data-id');
        confirmBox('删除账本？', '该账本下的所有记录都会被一并删除，无法撤销。', '删除', function () {
          DB.txns = DB.txns.filter(function (x) { return (x.ledger || 'ld1') !== lid; });
          DB.ledgers = DB.ledgers.filter(function (l) { return l.id !== lid; });
          if (DB.currentLedger === lid) DB.currentLedger = DB.ledgers[0].id;
          commit(); closePanel(); render();
        }, true);
        break;
      }
      case 'budget-save': {
        var bi = ov.querySelector('[data-role="budget"]');
        var v = parseFloat((bi.value || '').replace(/[^0-9.]/g, ''));
        DB.settings.budget = isNaN(v) ? 0 : Math.round(v * 100);
        commit(); closePanel(); toast(DB.settings.budget ? '预算已保存' : '已关闭预算'); break;
      }
      case 'acct-new':
        UI.acctDraft = { id: null, name: '', type: '储蓄卡', icon: 'bank', color: PALETTE[0], initial: 0 };
        openPanel('acct-edit'); break;
      case 'acct-edit': {
        var a = acct(t.getAttribute('data-id'));
        UI.acctDraft = { id: a.id, name: a.name, type: a.type, icon: a.icon, color: a.color, initial: a.initial || 0 };
        openPanel('acct-edit'); break;
      }
      case 'acct-type':
        UI.acctDraft.type = t.getAttribute('data-v'); UI.acctDraft.icon = t.getAttribute('data-icon'); render(); break;
      case 'acct-color': UI.acctDraft.color = t.getAttribute('data-v'); render(); break;
      case 'acct-save': {
        var na = (ov.querySelector('[data-role="acct-name"]').value || '').trim();
        if (!na) { toast('请输入账户名称'); break; }
        var iv = parseFloat((ov.querySelector('[data-role="acct-init"]').value || '').replace(/[^0-9.\-]/g, ''));
        var init = isNaN(iv) ? 0 : Math.round(iv * 100);
        if (UI.acctDraft.id) {
          var ex = DB.accounts.filter(function (x) { return x.id === UI.acctDraft.id; })[0];
          ex.name = na; ex.type = UI.acctDraft.type; ex.icon = UI.acctDraft.icon; ex.color = UI.acctDraft.color; ex.initial = init;
        } else {
          DB.accounts.push({ id: 'a' + uid(), name: na, type: UI.acctDraft.type, icon: UI.acctDraft.icon, color: UI.acctDraft.color, initial: init });
        }
        commit(); closePanel(); toast('已保存'); break;
      }
      case 'acct-del': {
        var aid = t.getAttribute('data-id');
        confirmBox('删除账户？', '使用该账户的记录会保留，但账户名会显示为「未知账户」。', '删除', function () {
          DB.accounts = DB.accounts.filter(function (x) { return x.id !== aid; });
          commit(); closePanel(); render();
        }, true);
        break;
      }
      case 'cat-new':
        UI.catDraft = { id: null, name: '', kind: 'expense', icon: 'other', color: PALETTE[0], order: DB.categories.length };
        openPanel('cat-edit'); break;
      case 'cat-edit': {
        var c = cat(t.getAttribute('data-id'));
        UI.catDraft = { id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color, order: c.order };
        openPanel('cat-edit'); break;
      }
      case 'cat-kind': UI.catDraft.kind = t.getAttribute('data-v'); render(); break;
      case 'cat-icon': UI.catDraft.icon = t.getAttribute('data-v'); render(); break;
      case 'cat-color': UI.catDraft.color = t.getAttribute('data-v'); render(); break;
      case 'cat-save': {
        var cn = (ov.querySelector('[data-role="cat-name"]').value || '').trim();
        if (!cn) { toast('请输入分类名称'); break; }
        if (UI.catDraft.id) {
          var cx = DB.categories.filter(function (x) { return x.id === UI.catDraft.id; })[0];
          cx.name = cn; cx.kind = UI.catDraft.kind; cx.icon = UI.catDraft.icon; cx.color = UI.catDraft.color;
        } else {
          DB.categories.push({ id: 'c' + uid(), name: cn, kind: UI.catDraft.kind, icon: UI.catDraft.icon, color: UI.catDraft.color, order: DB.categories.length });
        }
        commit(); closePanel(); toast('已保存'); break;
      }
      case 'cat-del': {
        var cid2 = t.getAttribute('data-id');
        confirmBox('删除分类？', '已使用该分类的记录会保留，但会显示为「未分类」。', '删除', function () {
          DB.categories = DB.categories.filter(function (x) { return x.id !== cid2; });
          commit(); closePanel(); render();
        }, true);
        break;
      }
      case 'export-csv': exportCSV(); break;
      case 'export-json': exportJSON(); break;
      case 'import': importJSON(); break;
      case 'demo':
        confirmBox('载入示例数据？', '这会清除当前所有记录，并填入一批演示账目。建议先导出备份。', '载入', function () {
          seedDemo(); UI.month = mk(today()); render(); toast('已载入示例数据');
        }, true);
        break;
      case 'clear-txns':
        confirmBox('清空所有流水？', '全部记录将被删除，分类和账户会保留。此操作不可撤销。', '清空', function () {
          DB.txns = []; commit(); render(); toast('已清空');
        }, true);
        break;
    }
  }
  /* 键盘是高频操作：只更新金额区，不整版重渲染，低配机上也跟手 */
  function refreshAmount() {
    var line = document.querySelector('.amount-line');
    if (!line || !UI.draft) { render(); return; }
    var d = UI.draft;
    var span = line.querySelector('.amt-str');
    if (d.amountStr) {
      if (!span) {
        span = document.createElement('span');
        span.className = 'amt-str';
        line.insertBefore(span, line.querySelector('.caret'));
      }
      span.textContent = d.amountStr;
    } else if (span) span.remove();
    var hint = document.querySelector('.amount-hint');
    if (hint) {
      hint.textContent = d.amountStr
        ? (d.typeDraft === 'transfer' ? '账户之间转移，不计入收支'
          : d.typeDraft === 'income' ? '记一笔收入' : '记一笔支出')
        : '输入金额';
    }
  }
  function keyPress(k) {
    var s = UI.draft.amountStr;
    if (k === '.') { if (s.indexOf('.') >= 0) return; if (!s) s = '0'; s += '.'; }
    else {
      if (s.indexOf('.') >= 0 && s.split('.')[1].length >= 2) return;
      if (s.indexOf('.') < 0 && s.split('.')[0].length >= 7) return;
      if (s === '0') s = '';
      s += k;
    }
    UI.draft.amountStr = s;
    refreshAmount();
  }
  function keyBack() {
    UI.draft.amountStr = UI.draft.amountStr.slice(0, -1);
    refreshAmount();
  }
  function saveDraft() {
    var d = UI.draft;
    var v = parseFloat(d.amountStr);
    if (!v || v <= 0) { toast('请输入金额'); return; }
    var cents = Math.round(v * 100);
    if (cents > 99999999999) { toast('金额过大'); return; }
    if (d.typeDraft !== 'transfer' && !d.category) { toast('请选择一个分类'); return; }
    if (d.typeDraft === 'transfer') {
      if (!d.account || !d.toAccount) { toast('请选择转出与转入账户'); return; }
      if (d.account === d.toAccount) { toast('转出与转入不能是同一个账户'); return; }
    }
    var rec = {
      ledger: activeLedger(), type: d.typeDraft, amount: cents,
      category: d.typeDraft === 'transfer' ? null : d.category,
      account: d.account,
      toAccount: d.typeDraft === 'transfer' ? d.toAccount : null,
      date: d.date, time: d.time || nowTime(), note: (d.note || '').trim()
    };
    if (d.id) {
      var old = DB.txns.filter(function (x) { return x.id === d.id; })[0];
      if (old) { for (var k in rec) old[k] = rec[k]; }
    } else {
      rec.id = uid(); rec.createdAt = Date.now(); DB.txns.push(rec);
    }
    commit();
    UI.month = mk(d.date);
    closePanel();
    toast(d.id ? '已更新' : '已记入账簿');
  }

  /* ---------- 输入事件 ---------- */
  function handleInput(e) {
    var t = e.target, role = t.getAttribute && t.getAttribute('data-role');
    if (!role) return;
    if (role === 'note') UI.draft.note = t.value;
    else if (role === 'search') {
      UI.search = t.value;
      /* 只替换结果区，输入框不动，焦点与光标自然保留 */
      var box = document.getElementById('search-results');
      if (box) box.innerHTML = searchResultsHtml();
    }
  }

  /* ---------- 返回键 ---------- */
  window.AppBack = function () {
    if (UI.panel) { closePanel(); return 'true'; }
    if (UI.tab !== 'home') { UI.tab = 'home'; render(); scrollTop(); return 'true'; }
    return 'false';
  };

  /* 供安卓外壳注入系统栏安全区与主题变化 */
  window.setSafeArea = function (top, bottom) {
    var r = document.documentElement.style;
    r.setProperty('--sat', (top || 0) + 'px');
    r.setProperty('--sab', (bottom || 0) + 'px');
  };
  window.__sysTheme = function () { if (DB) applyTheme(); };

  /* ---------- 启动 ---------- */
  function bind() {
    document.addEventListener('click', handleClick, false);
    document.addEventListener('input', handleInput, false);
    document.addEventListener('keydown', function (e) {
      if (UI.panel !== 'compose') return;
      var inField = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (/^[0-9]$/.test(e.key)) { if (!inField) keyPress(e.key); }
      else if (e.key === '.') { if (!inField) keyPress('.'); }
      else if (e.key === 'Backspace' && !inField) { keyBack(); e.preventDefault(); }
      else if (e.key === 'Enter') saveDraft();
      else if (e.key === 'Escape') closePanel();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    }
    var v = document.getElementById('view');
    v.addEventListener('scroll', function () {
      document.getElementById('topbar').classList.toggle('is-stuck', v.scrollTop > 6);
    }, { passive: true });
    /* 多标签页：别的标签页改了数据就刷新本页，避免内存里的旧数据覆盖磁盘。
       正在记账面板里输入时先不打断，只提醒一句。 */
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY) return;
      if (UI.panel === 'compose' && UI.draft && (UI.draft.amountStr || UI.draft.note)) {
        toast('数据已在其他窗口更新，保存这笔后请手动刷新');
        return;
      }
      location.reload();
    });
    /* 切到后台 / 关闭页面前，把当天还没备份的变更落一份 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) autoSaveIfDue(false);
    });
    window.addEventListener('pagehide', function () { autoSaveIfDue(false); });
    // 安卓把状态栏/导航栏高度注入 CSS 变量
    try {
      if (window.Android && window.Android.insets) {
        var ins = JSON.parse(window.Android.insets());
        var r = document.documentElement.style;
        r.setProperty('--sat', ins.top + 'px');
        r.setProperty('--sab', ins.bottom + 'px');
      }
    } catch (e) { /* 浏览器环境 */ }
  }

  var APP_VERSION = '1.2.2';

  function boot() {
    load();
    applyTheme();
    applyFont();
    bind();
    var m = /[?&]month=([\d-]+)/.exec(location.search);
    if (m) UI.month = m[1];
    var demo = /[?&]demo=1/.test(location.search);
    if (demo) { seedDemo(); }
    var tab = /[?&]tab=(\w+)/.exec(location.search);
    if (tab) UI.tab = tab[1];
    render();
    setupWebApp();
  }
  /* 网页版（PWA）的事：注册离线缓存；安卓外壳里则相反，把用不到的引用摘掉。
     外壳用的是虚拟源 app.local，那里没有真实网络，Service Worker 无从谈起。 */
  function setupWebApp() {
    if (location.hostname === 'app.local') {
      ['link[rel="manifest"]', 'link[rel="apple-touch-icon"]'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      return;
    }
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 失败也不影响使用 */ });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 供 Android 侧调用 */
  window.LedgerApp = { open: function () { openPanel('compose', newDraft()); }, toast: toast };
})();
