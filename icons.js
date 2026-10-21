/* 记账本 — 图标库
 * 全部为手绘 24x24 线性图标，统一 1.6 线宽、圆角端点。
 * 无外部依赖，无 emoji。用法：icon('food') / icon('food', 20, 'cls')
 */
(function (global) {
  'use strict';

  // 描边图标（stroke）
  var S = {
    /* —— 分类：支出 —— */
    food: '<path d="M4 11.5h16a8 8 0 0 1-16 0Z"/><path d="M9.5 8.2c0-1.3.9-1.9.9-3.2"/><path d="M13.6 8.2c0-1.3.9-1.9.9-3.2"/>',
    transport: '<path d="M4.6 16v-2.9l1.6-4.2A1.6 1.6 0 0 1 7.7 8h8.6a1.6 1.6 0 0 1 1.5 1l1.6 4.1V16"/><path d="M4.6 16h14.8"/><path d="M7.6 16.4a1.5 1.5 0 1 1 0-.01"/><path d="M16.4 16.4a1.5 1.5 0 1 1 0-.01"/>',
    shopping: '<path d="M6.2 8h11.6l1 11.5H5.2L6.2 8Z"/><path d="M9.2 8V6.6a2.8 2.8 0 0 1 5.6 0V8"/>',
    home: '<path d="M4 11.2 12 4l8 7.2V20H4v-8.8Z"/><path d="M10 20v-5.2h4V20"/>',
    fun: '<path d="M9.5 18V6.4l10-2.1V16"/><path d="M9.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/><path d="M19.5 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>',
    medical: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 8.2v7.6"/><path d="M8.2 12h7.6"/>',
    study: '<path d="M3 9.3 12 5.2l9 4.1-9 4.1-9-4.1Z"/><path d="M7 11.3V16c0 1.5 2.2 2.6 5 2.6s5-1.1 5-2.6v-4.7"/>',
    gift: '<path d="M4.5 10.5h15V20h-15z"/><path d="M3.5 7.5h17v3h-17z"/><path d="M12 7.5V20"/><path d="M12 7.5S11 3.5 8.4 3.5a2 2 0 0 0 0 4"/><path d="M12 7.5s1-4 3.6-4a2 2 0 0 1 0 4"/>',
    phone: '<path d="M7.5 3h9v18h-9z"/><path d="M10.8 18.2h2.4"/>',
    utility: '<path d="M12 3.4s5.6 6.2 5.6 9.6a5.6 5.6 0 1 1-11.2 0C6.4 9.6 12 3.4 12 3.4Z"/>',
    pet: '<path d="M8.3 8.6a1.7 1.7 0 1 1 0-.01"/><path d="M15.7 8.6a1.7 1.7 0 1 1 0-.01"/><path d="M5.4 12.9a1.5 1.5 0 1 1 0-.01"/><path d="M18.6 12.9a1.5 1.5 0 1 1 0-.01"/><path d="M12 13.2c3.1 0 5.1 2 5.1 4.2 0 1.6-1.4 2.4-2.7 1.8a6 6 0 0 0-4.8 0C8.3 19.8 6.9 19 6.9 17.4c0-2.2 2-4.2 5.1-4.2Z"/>',
    travel: '<path d="M4.5 9.2h15V20h-15z"/><path d="M9.2 9.2V7a2 2 0 0 1 2-2h1.6a2 2 0 0 1 2 2v2.2"/><path d="M10 13.6v2.4"/><path d="M14 13.6v2.4"/>',
    sport: '<path d="M6.2 9.2v5.6"/><path d="M17.8 9.2v5.6"/><path d="M3.6 11.2v1.6"/><path d="M20.4 11.2v1.6"/><path d="M6.2 12h11.6"/>',
    beauty: '<path d="M12 3.4 13.9 9 19.5 11 13.9 13 12 18.6 10.1 13 4.5 11 10.1 9 12 3.4Z"/><path d="M18.2 16.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>',
    digital: '<path d="M3.2 5.2h17.6v11.2H3.2z"/><path d="M9.2 20.4h5.6"/><path d="M12 16.4v4"/>',
    drink: '<path d="M7.4 4h9.2l-1.1 16H8.5L7.4 4Z"/><path d="M6.6 8.8h10.8"/>',
    rent: '<path d="M4.6 20.6V4.4h9v16.2"/><path d="M13.6 10.4h5.8v10.2"/><path d="M7.6 8h3"/><path d="M7.6 12h3"/><path d="M7.6 16h3"/>',
    repay: '<path d="M3.2 9.6 12 4.8l8.8 4.8"/><path d="M5.6 9.6v8"/><path d="M9.8 9.6v8"/><path d="M14.2 9.6v8"/><path d="M18.4 9.6v8"/><path d="M3.2 20h17.6"/>',
    other: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M8.6 12h.01"/><path d="M12 12h.01"/><path d="M15.4 12h.01"/>',

    /* —— 分类：收入 —— */
    salary: '<path d="M3 7.2h18v9.6H3z"/><path d="M12 12a2.1 2.1 0 1 0 0-.01"/><path d="M6.2 12h.01"/><path d="M17.8 12h.01"/>',
    bonus: '<path d="M12 4l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16l-4.8 2.6.9-5.3L4.3 9.6l5.3-.8L12 4Z"/>',
    parttime: '<path d="M3 8.2h18V19.4H3z"/><path d="M9 8.2V6.4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.8"/><path d="M3 13.4h18"/>',
    invest: '<path d="M4 18.2 9.2 13l3.4 3.4L20 8.6"/><path d="M20 8.6h-4.2"/><path d="M20 8.6v4.2"/>',
    redpacket: '<path d="M6.2 3h11.6v18l-5.8-3.9L6.2 21V3Z"/><path d="M12 3v6.4"/>',
    reimburse: '<path d="M6.2 3h11.6v18l-2.9-1.9-2.9 1.9-2.9-1.9L6.2 21V3Z"/><path d="M9.2 8h5.6"/><path d="M9.2 12h5.6"/>',
    refund: '<path d="M4.4 12a7.6 7.6 0 1 0 2.9-5.9"/><path d="M4.4 5.2v4.2h4.2"/>',

    /* —— 账户 —— */
    cash: '<path d="M3.2 6.6h17.6v10.8H3.2z"/><path d="M12 12a2 2 0 1 0 0-.01"/><path d="M6.4 12h.01"/><path d="M17.6 12h.01"/>',
    card: '<path d="M3.2 6.2h17.6v11.6H3.2z"/><path d="M3.2 10.2h17.6"/><path d="M6.6 14.2h3.2"/>',
    wallet: '<path d="M3.4 7.4A2 2 0 0 1 5.4 5.4h11.2v2"/><path d="M3.4 7.4v9.2a2 2 0 0 0 2 2h13.2a2 2 0 0 0 2-2v-6a1 1 0 0 0-1-1H5.4a2 2 0 0 1-2-2Z"/><path d="M16.6 12.4h.01"/>',
    bank: '<path d="M3.4 9.6 12 4.8l8.6 4.8"/><path d="M6 9.6v8"/><path d="M10 9.6v8"/><path d="M14 9.6v8"/><path d="M18 9.6v8"/><path d="M3.2 20h17.6"/>',
    credit: '<path d="M3.2 6.2h17.6v11.6H3.2z"/><path d="M3.2 9.6h17.6"/><path d="M6.6 14h4"/>',
    transfer: '<path d="M4 8.6h12.4l-3.2-3.2"/><path d="M20 15.4H7.6l3.2 3.2"/>',

    /* —— 界面 —— */
    list: '<path d="M4 6.4h16"/><path d="M4 12h16"/><path d="M4 17.6h10"/>',
    chart: '<path d="M4 20V9.6"/><path d="M10 20V4.4"/><path d="M16 20v-7.6"/><path d="M22 20H3"/>',
    settings: '<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/><path d="M19.4 14.6a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3.8a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3.8a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    check: '<path d="M5 12.8 9.6 17.4 19 8"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    calendar: '<path d="M4 6.4h16v13.2H4z"/><path d="M4 10.6h16"/><path d="M8.4 3.4v4"/><path d="M15.6 3.4v4"/>',
    search: '<path d="M11 4.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8Z"/><path d="M15.8 15.8 20 20"/>',
    trash: '<path d="M4.6 6.6h14.8"/><path d="M9.4 6.6V5a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.6"/><path d="M6.6 6.6 7.5 20a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l.9-13.4"/><path d="M10.4 10.6v6"/><path d="M13.6 10.6v6"/>',
    edit: '<path d="M4.4 19.6h3.4L19 8.4a1.6 1.6 0 0 0 0-2.3l-1.1-1.1a1.6 1.6 0 0 0-2.3 0L4.4 16.2v3.4Z"/><path d="M14.6 6.8 17.2 9.4"/>',
    sun: '<path d="M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z"/><path d="M12 2.6v2.2"/><path d="M12 19.2v2.2"/><path d="M4.4 12H2.2"/><path d="M21.8 12h-2.2"/><path d="M6.6 6.6 5 5"/><path d="M19 19l-1.6-1.6"/><path d="M6.6 17.4 5 19"/><path d="M19 5l-1.6 1.6"/>',
    moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"/>',
    auto: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 3.4v17.2"/><path d="M12 8.6a3.4 3.4 0 0 1 0 6.8Z"/>',
    download: '<path d="M12 3.6v11"/><path d="M7.4 10.2 12 14.8l4.6-4.6"/><path d="M4.4 19.4h15.2"/>',
    upload: '<path d="M12 20.4v-11"/><path d="M7.4 13.8 12 9.2l4.6 4.6"/><path d="M4.4 4.6h15.2"/>',
    share: '<path d="M12 3.6v11.2"/><path d="M8 7.4 12 3.4l4 4"/><path d="M5.4 13.4v6.2h13.2v-6.2"/>',
    info: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 11v5.4"/><path d="M12 7.6h.01"/>',
    file: '<path d="M6.4 3.4h7.2l4 4v13.2H6.4z"/><path d="M13.6 3.4v4h4"/>',
    target: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"/><path d="M12 11.3a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Z"/>',
    expense: '<path d="M12 4.4v15.2"/><path d="M17 8.4H9.8a2.6 2.6 0 0 0 0 5.2h4.4a2.6 2.6 0 0 1 0 5.2H6.6"/>',
    income: '<path d="M12 19.6V4.4"/><path d="M7 15.6h7.2a2.6 2.6 0 0 0 0-5.2h-4.4a2.6 2.6 0 0 1 0-5.2H17"/>',
    budget: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z"/><path d="M12 12 12 5.6"/><path d="M12 12l4.6 3.4"/>',
    ledger: '<path d="M6 3.4h11.6a1.6 1.6 0 0 1 1.6 1.6v14a1.6 1.6 0 0 1-1.6 1.6H6z"/><path d="M6 3.4A1.6 1.6 0 0 0 4.4 5v14A1.6 1.6 0 0 0 6 20.6"/><path d="M9.2 7.6h6"/><path d="M9.2 12h6"/>',
    tag: '<path d="M4.4 11.2V4.4h6.8l8.4 8.4-6.8 6.8-8.4-8.4Z"/><path d="M8 8h.01"/>',
    lock: '<path d="M6 10.4h12v9.2H6z"/><path d="M8.6 10.4V7.8a3.4 3.4 0 0 1 6.8 0v2.6"/>',
    backspace: '<path d="M8.6 5h10.4a1.6 1.6 0 0 1 1.6 1.6v10.8a1.6 1.6 0 0 1-1.6 1.6H8.6L2.8 12 8.6 5Z"/><path d="M12 9.6l4.8 4.8"/><path d="M16.8 9.6 12 14.4"/>',
    in: '<path d="M12 4.5v11"/><path d="M7.4 11.1 12 15.7l4.6-4.6"/><path d="M4.6 19.5h14.8"/>',
    out: '<path d="M12 19.5v-11"/><path d="M7.4 12.9 12 8.3l4.6 4.6"/><path d="M4.6 4.5h14.8"/>',
    balance: '<path d="M12 4.6v14.8"/><path d="M6.8 8.2h10.4"/><path d="M6.8 8.2 4 14.2a3 3 0 0 0 5.6 0L6.8 8.2Z"/><path d="M17.2 8.2l-2.8 6a3 3 0 0 0 5.6 0l-2.8-6Z"/><path d="M8.4 20.6h7.2"/>',
    more: '<path d="M12 12h.01"/><path d="M12 5.6h.01"/><path d="M12 18.4h.01"/>',
    reset: '<path d="M4.4 12a7.6 7.6 0 1 0 2.4-5.5"/><path d="M4.4 4.6v4.4h4.4"/>'
  };

  // 极少量的实心图标
  var F = {
    dot: '<circle cx="12" cy="12" r="3.4"/>',
    mark: '<path d="M12 2.6 14.6 9l6.8 2.6-6.8 2.6L12 20.8 9.4 14.2 2.6 11.6 9.4 9 12 2.6Z"/>'
  };

  function icon(name, size, cls) {
    var s = size || 20;
    var c = cls ? ' class="' + cls + '"' : '';
    if (F[name]) {
      return '<svg' + c + ' width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + F[name] + '</svg>';
    }
    var body = S[name] || S.other;
    return '<svg' + c + ' width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  global.ICON = icon;
  global.ICON_KEYS = Object.keys(S);
})(typeof window !== 'undefined' ? window : this);
