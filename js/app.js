/*
 * Milk Bill Management — screens and actions.
 */
(function () {
  'use strict';

  var Cal = window.NepaliCalendar;
  var L = window.Ledger;
  var Store = window.Store;
  var BillImage = window.BillImage;
  var Platform = window.Platform;
  var STRINGS = window.DMS_I18N;

  var APP_VERSION = '1.0.0';
  var DEVELOPER = 'Pawan Paudyal';
  var IS_NATIVE = Platform.isNative;
  var LOGO = (window.DMS_ASSETS && window.DMS_ASSETS.logo) || 'icons/logo.svg';
  var PAGE_SIZE = 50;
  var WEEK_SHORT = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ne: ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि']
  };

  var NAV = [
    { key: 'home', icon: 'home', label: 'navHome' },
    { key: 'milk', icon: 'milk', label: 'navMilk' },
    { key: 'customers', icon: 'users', label: 'navCustomers' },
    { key: 'bills', icon: 'bill', label: 'navBills' },
    { key: 'payments', icon: 'wallet', label: 'navPayments' },
    { key: 'records', icon: 'list', label: 'navRecords' },
    { key: 'reports', icon: 'chart', label: 'navReports' },
    { key: 'settings', icon: 'gear', label: 'navSettings' }
  ];
  var TABS = [
    { key: 'home', icon: 'home', label: 'navHome' },
    { key: 'milk', icon: 'milk', label: 'navMilk' },
    { key: 'customers', icon: 'users', label: 'navCustomers' },
    { key: 'bills', icon: 'bill', label: 'navBills' },
    { key: 'more', icon: 'more', label: 'navMore' }
  ];

  var state = null;
  var lang = 'en';
  var logoImg = new Image();
  logoImg.src = LOGO;
  var wideQuery = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;

  var ui = {
    date: Cal.today(),
    lastToday: '',
    billMonth: null,
    reportMonth: null,
    recMonth: null,
    custMonth: {},
    search: { milk: '', customers: '', bills: '', records: '', payments: '' },
    custFilter: 'active',
    billFilter: 'all',
    payFilter: { month: '', cid: '', kind: '' },
    recFilter: { cid: '' },
    sort: { customers: { key: 'order', dir: 1 }, records: { key: 'date', dir: -1 }, payments: { key: 'date', dir: -1 } },
    page: { records: 1, payments: 1 },
    reorder: false,
    includeOld: {},
    installEvent: null,
    warning: null,
    storageFull: false,
    canShare: false,
    wide: !!(wideQuery && wideQuery.matches),
    bill: { token: 0, url: null, blob: null, name: '' }
  };

  var $view, $toast, $dialogRoot;

  // ---------- helpers ----------

  function t(key, vars) {
    var dict = STRINGS[lang] || STRINGS.en;
    var one = vars && +vars.n === 1 ? key + '_one' : null;
    var s = (one && dict[one]) || dict[key] || (one && STRINGS.en[one]) || STRINGS.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function todayBs() { return Cal.today(); }
  function thisMonth() { var d = Cal.today(); return { y: d.y, m: d.m }; }
  function dkey(d) { return Cal.key(d.y, d.m, d.d); }
  function sameDay(a, b) { return a.y === b.y && a.m === b.m && a.d === b.d; }
  function monthLabel(y, m) { return Cal.monthName(m, lang) + ' ' + y; }
  function monthLabelKey(mk) { var p = Cal.parseKey(mk); return monthLabel(p.y, p.m); }
  function money(paisa) { return t('rs') + ' ' + L.formatMoney(paisa); }
  function rateText(rate) { return money(Math.round(rate * 100)) + '/' + t('L'); }
  function litres(l) { return L.formatLitre(l) + ' ' + t('L'); }
  function fmtDate(key) { var p = Cal.parseKey(key); return Cal.format(p.y, p.m, p.d); }
  function dayName(y, m, d) { return Cal.dayName(Cal.weekday(y, m, d), lang); }
  function niceLitre(v) {
    var whole = Math.floor(v);
    if (v - whole === 0.5) return (whole ? whole : '') + '½';
    return L.formatLitre(v);
  }
  function fileSafe(s) {
    return String(s).replace(/[^\wऀ-ॿ-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
  }
  function isStandalone() {
    try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
    catch (e) { return false; }
  }
  function customerName(cid) { var c = L.findCustomer(state, cid); return c ? c.name : '—'; }

  var ICONS = {
    home: '<path d="M3.5 10.5L12 4l8.5 6.5"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>',
    milk: '<path d="M9 2.5h6v3l2 3V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V8.5l2-3z"/><path d="M7 12.5h10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M17.6 14.9c2 .7 3.4 2.5 3.8 5.1"/>',
    bill: '<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16.5 14.5h1.5"/>',
    list: '<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><path d="M4 6h.5M4 12h.5M4 18h.5"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
    download: '<path d="M12 3.5v11"/><path d="M7 10l5 5 5-5"/><path d="M4.5 19.5h15"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    phone: '<path d="M5 3.5h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.8 6.8l1.4-2.2 4.3 1.7V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.1A1.5 1.5 0 0 1 5 3.5z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
    save: '<path d="M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>',
    upload: '<path d="M12 15V4"/><path d="M7 8.5l5-5 5 5"/><path d="M4.5 19.5h15"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
    sort: '<path d="M8 4v16M4.5 7.5L8 4l3.5 3.5M16 20V4M12.5 16.5L16 20l3.5-3.5"/>',
    folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  // ---------- feedback ----------

  var toastTimer = null;
  function toast(msg, kind) {
    $toast.innerHTML = '<div class="toast' + (kind === 'error' ? ' error' : '') + '">' +
      icon(kind === 'error' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span></div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.innerHTML = ''; }, kind === 'error' ? 5000 : 2600);
  }

  var backupTimer = null;
  var safeTimer = null;
  var backupChain = Promise.resolve(null);
  var changedMonths = {};

  // Every change is saved at once, stamped with the time, then copied to the app's safe
  // storage (1.5 s later) and to the month's folder in the phone's Backups (4 s later).
  function persist(parts) {
    state.meta.savedAt = new Date().toISOString();
    try {
      Store.save(parts.indexOf('meta') < 0 ? parts.concat(['meta']) : parts);
      ui.storageFull = false;
    } catch (e) {
      ui.storageFull = true;
      toast(t('storageFull'), 'error');
      return false;
    }
    parts.forEach(function (p) { if (/^\d{4}-\d{2}$/.test(p)) changedMonths[p] = true; });
    if (IS_NATIVE) {
      clearTimeout(safeTimer);
      safeTimer = setTimeout(runSafeCopy, 1500);
      clearTimeout(backupTimer);
      backupTimer = setTimeout(runAutoBackup, 4000);
    }
    return true;
  }

  function backupJson() { return JSON.stringify(L.exportBackup(state)); }
  function backupName() { return 'MilkBills-backup-' + dkey(todayBs()) + '.json'; }
  // Phone folders and files are named the same in both languages, e.g. "2083-06 Asoj".
  function monthFolder(y, m) { return Cal.monthKey(y, m) + ' ' + Cal.monthName(m, 'en'); }
  function monthTitle(y, m) { return Cal.monthName(m, 'en') + ' ' + y; }
  function monthBackupName(y, m) { return 'Backup - ' + monthTitle(y, m) + '.json'; }
  function monthSheetName(y, m) { return 'Milk sheet - ' + monthTitle(y, m) + '.csv'; }
  // Customers whose names give the same file name (phone storage ignores capital letters)
  // get a number, so one bill never replaces another.
  function billFileName(c, y, m) {
    var key = fileSafe(c.name).toLowerCase();
    var same = state.meta.customers.filter(function (x) { return fileSafe(x.name).toLowerCase() === key; });
    var tag = same.length > 1 ? '-' + (same.map(function (x) { return x.id; }).indexOf(c.id) + 1) : '';
    return fileSafe('Bill-' + c.name + tag + '-' + Cal.monthName(m, 'en') + '-' + y) + '.png';
  }

  function runSafeCopy() {
    clearTimeout(safeTimer);
    if (!IS_NATIVE || !state) return Promise.resolve();
    var json = backupJson();
    return Promise.all([Platform.writeSafeCopy(json), Platform.writeSnapshot(dkey(todayBs()), json)]);
  }

  // Writes one file of a month's backup folder. If the file belongs to an earlier install
  // of the app, it is saved under a new name once and that name is used from then on.
  function writeMonthFile(y, m, filename, text) {
    var key = 'backupFile.' + Cal.monthKey(y, m) + '.' + filename;
    var name = Store.Local.getFlag(key) || filename;
    return Platform.autoBackup(monthFolder(y, m) + '/' + name, text).then(function (r) {
      if (r && r.ok && r.name !== name) Store.Local.setFlag(key, r.name);
      return r;
    });
  }

  // The phone's Backups folder has one folder per month (e.g. "2083-06 Asoj") holding a
  // backup of all records (to restore) and the month's milk sheet (every customer, every day).
  // The backup goes into this month's folder, so each past month keeps its month-end copy.
  // Resolves the backup file's result, or null.
  function runAutoBackup() {
    clearTimeout(backupTimer);
    if (!IS_NATIVE || !state || !state.meta.customers.length) return backupChain;
    var today = todayBs();
    var json = backupJson();
    var months = Object.keys(changedMonths);
    changedMonths = {};
    var current = Cal.monthKey(today.y, today.m);
    if (months.indexOf(current) < 0) months.push(current);
    var sheets = months.map(function (k) {
      var ym = Cal.parseKey(k);
      return { y: ym.y, m: ym.m, csv: L.monthCsv(state, ym.y, ym.m) };
    });
    var retry = function () { months.forEach(function (k) { changedMonths[k] = true; }); };
    backupChain = backupChain.then(function () {
      return writeMonthFile(today.y, today.m, monthBackupName(today.y, today.m), json);
    }).then(function (r) {
      if (!r || !r.ok) {
        Store.Local.setFlag('autoBackupFailed', '1');
        retry();
        return null;
      }
      return sheets.reduce(function (p, s) {
        return p.then(function (ok) {
          return writeMonthFile(s.y, s.m, monthSheetName(s.y, s.m), s.csv).then(function (x) { return ok && !!(x && x.ok); });
        });
      }, Promise.resolve(true)).then(function (sheetsOk) {
        if (!sheetsOk) retry();
        Store.Local.setFlag('autoBackupFailed', sheetsOk ? '' : '1');
        Store.Local.setFlag('autoBackupAt', new Date().toISOString());
        return r;
      });
    }).catch(function () { retry(); return null; });
    return backupChain;
  }

  // Saves everything now (used when the app goes to the background or closes).
  function flushCopies() {
    if (!IS_NATIVE) return Promise.resolve();
    return Promise.all([runSafeCopy(), runAutoBackup()]);
  }

  function countRecords(s) {
    var n = 0;
    Object.keys(s.months || {}).forEach(function (mk) {
      var days = s.months[mk].days || {};
      Object.keys(days).forEach(function (dd) { n += Object.keys(days[dd]).length; });
      n += (s.months[mk].pays || []).length;
    });
    return n;
  }

  // Android: compare the app's records with the safe copy and keep the newer one.
  // Resolves true when the safe copy was used.
  function reconcileWithSafeCopy() {
    if (!IS_NATIVE) return Promise.resolve(false);
    return Platform.readSafeCopy().then(function (txt) {
      if (!txt) return false;
      var safe;
      try { safe = L.parseBackup(JSON.parse(txt)); } catch (e) { return false; }
      var localEmpty = !state.meta.customers.length && !countRecords(state);
      var safeHasData = safe.meta.customers.length > 0 || countRecords(safe) > 0;
      var safeNewer = (safe.meta.savedAt || '') > (state.meta.savedAt || '');
      if (!safeHasData || (!localEmpty && !safeNewer)) return false;
      state = normalizeState(Store.replaceAll(safe));
      return true;
    }).catch(function () { return false; });
  }

  // ---------- navigation ----------

  var Nav = {
    stack: [{ view: 'home', params: {} }],
    useHistory: !IS_NATIVE,
    pendingTab: null,

    init: function () {
      if (Nav.useHistory) {
        try { history.replaceState({ dms: 1 }, ''); } catch (e) { Nav.useHistory = false; }
      }
      window.addEventListener('popstate', Nav.onPop);
    },
    current: function () { return Nav.stack[Nav.stack.length - 1]; },
    pushHist: function () {
      if (!Nav.useHistory) return;
      try { history.pushState({ dms: Date.now() }, ''); } catch (e) { Nav.useHistory = false; }
    },
    push: function (view, params) {
      Nav.stack.push({ view: view, params: params || {} });
      Nav.pushHist();
      render();
      window.scrollTo(0, 0);
    },
    replace: function (view, params) {
      Nav.stack[Nav.stack.length - 1] = { view: view, params: params || {} };
      render();
    },
    tab: function (view) {
      var depth = Nav.stack.length - 1 + (Dialog.isOpen() ? 1 : 0);
      if (Nav.useHistory && depth > 0) {
        Nav.pendingTab = view;
        history.go(-depth);
        return;
      }
      Dialog.closeNow();
      Nav.stack = [{ view: view, params: {} }];
      render();
      window.scrollTo(0, 0);
    },
    back: function () {
      if (Nav.useHistory && (Dialog.isOpen() || Nav.stack.length > 1)) { history.back(); return; }
      Nav.popInternal();
    },
    onPop: function () {
      if (Nav.pendingTab) {
        var v = Nav.pendingTab;
        Nav.pendingTab = null;
        Dialog.closeNow();
        Nav.stack = [{ view: v, params: {} }];
        render();
        window.scrollTo(0, 0);
        return;
      }
      Nav.popInternal();
    },
    popInternal: function () {
      if (Dialog.isOpen()) { Dialog.closeNow(); return; }
      if (Nav.stack.length > 1) { Nav.stack.pop(); render(); }
    }
  };

  // ---------- dialogs ----------

  var Dialog = {
    el: null,
    opts: null,
    waiters: [],
    closing: false,
    fallback: null,

    isOpen: function () { return !!Dialog.el; },

    open: function (html, opts) {
      if (Dialog.el) {
        var prev = Dialog.opts;
        Dialog.opts = opts || {};
        Dialog.el.querySelector('.dialog').innerHTML = html;
        if (prev && prev.onClose) prev.onClose();
        return;
      }
      Dialog.opts = opts || {};
      var back = document.createElement('div');
      back.className = 'dialog-backdrop';
      back.innerHTML = '<div class="dialog" role="dialog" aria-modal="true">' + html + '</div>';
      back.addEventListener('click', function (e) { if (e.target === back) Dialog.close(); });
      $dialogRoot.appendChild(back);
      Dialog.el = back;
      Nav.pushHist();
      var first = back.querySelector('[autofocus]');
      if (first && ui.wide) first.focus();
    },

    close: function () {
      if (!Dialog.el) return Promise.resolve();
      return new Promise(function (resolve) {
        Dialog.waiters.push(resolve);
        if (Dialog.closing) return;
        Dialog.closing = true;
        if (Nav.useHistory) {
          history.back();
          Dialog.fallback = setTimeout(function () { Dialog.closeNow(); }, 1500);
        } else {
          Dialog.closeNow();
        }
      });
    },

    closeNow: function () {
      clearTimeout(Dialog.fallback);
      if (!Dialog.el) return;
      Dialog.el.remove();
      Dialog.el = null;
      Dialog.closing = false;
      var o = Dialog.opts;
      Dialog.opts = null;
      if (o && o.onClose) o.onClose();
      var w = Dialog.waiters;
      Dialog.waiters = [];
      w.forEach(function (f) { f(); });
    }
  };

  function dialogHead(title, sub) {
    return '<div class="dialog-head"><div><h2 class="dialog-title">' + esc(title) + '</h2>' +
      (sub ? '<p class="dialog-sub">' + esc(sub) + '</p>' : '') + '</div>' +
      '<button class="icon-btn" data-act="dialog-close" aria-label="' + esc(t('close')) + '">' + icon('close') + '</button></div>';
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var result = false;
      Dialog.open(
        dialogHead(o.title) +
        (o.text ? '<p class="dialog-text">' + esc(o.text) + '</p>' : '') +
        '<div class="form-actions"><button class="btn btn-secondary btn-lg" data-act="dialog-close">' + esc(o.no || t('cancel')) + '</button>' +
        '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + ' btn-lg" data-act="cf-yes">' + esc(o.yes || t('yes')) + '</button></div>',
        {
          onClose: function () { resolve(result); },
          handlers: { 'cf-yes': function () { result = true; Dialog.close(); } }
        }
      );
    });
  }

  function yearOptions(selected) {
    var now = todayBs();
    var from = Math.max(Cal.FIRST_YEAR, Math.min(selected, now.y - 5));
    var to = Math.min(Cal.LAST_YEAR, Math.max(selected, now.y + 1));
    var h = '';
    for (var y = from; y <= to; y++) h += '<option value="' + y + '"' + (y === selected ? ' selected' : '') + '>' + y + '</option>';
    return h;
  }
  function monthOptions(selected) {
    var h = '';
    for (var m = 1; m <= 12; m++) {
      h += '<option value="' + m + '"' + (m === selected ? ' selected' : '') + '>' + Cal.pad2(m) + ' · ' + esc(Cal.monthName(m, lang)) + '</option>';
    }
    return h;
  }
  function dayOptions(y, m, d) {
    var n = Cal.daysInMonth(y, m);
    var h = '';
    for (var i = 1; i <= n; i++) h += '<option value="' + i + '"' + (i === Math.min(d, n) ? ' selected' : '') + '>' + i + '</option>';
    return h;
  }
  // Year / month / day selects. ids: prefix + Y/M/D
  function datePickerHtml(prefix, cur) {
    return '<div class="picker-row">' +
      '<div class="field"><label for="' + prefix + 'Y">' + esc(t('year')) + '</label><select class="select" id="' + prefix + 'Y">' + yearOptions(cur.y) + '</select></div>' +
      '<div class="field"><label for="' + prefix + 'M">' + esc(t('month')) + '</label><select class="select" id="' + prefix + 'M">' + monthOptions(cur.m) + '</select></div>' +
      '<div class="field"><label for="' + prefix + 'D">' + esc(t('day')) + '</label><select class="select" id="' + prefix + 'D">' + dayOptions(cur.y, cur.m, cur.d) + '</select></div>' +
      '</div>';
  }
  function datePickerChange(prefix, el) {
    if (el.id === prefix + 'Y' || el.id === prefix + 'M') {
      $(prefix + 'D').innerHTML = dayOptions(+$(prefix + 'Y').value, +$(prefix + 'M').value, +$(prefix + 'D').value);
    }
  }
  function datePickerRead(prefix) {
    var y = +$(prefix + 'Y').value, m = +$(prefix + 'M').value, d = +$(prefix + 'D').value;
    return Cal.isValid(y, m, d) ? { y: y, m: m, d: d } : null;
  }

  function pickDate(cur) {
    return new Promise(function (resolve) {
      var result = null;
      Dialog.open(
        dialogHead(t('pickDate')) + datePickerHtml('pk', cur) +
        '<div class="form-actions"><button class="btn btn-secondary btn-lg" data-act="pk-today">' + esc(t('today')) + '</button>' +
        '<button class="btn btn-primary btn-lg" data-act="pk-go">' + esc(t('go')) + '</button></div>',
        {
          onClose: function () { resolve(result); },
          change: function (el) { datePickerChange('pk', el); },
          handlers: {
            'pk-go': function () { result = datePickerRead('pk'); Dialog.close(); },
            'pk-today': function () { result = todayBs(); Dialog.close(); }
          }
        }
      );
    });
  }

  function pickMonth(cur) {
    return new Promise(function (resolve) {
      var result = null;
      function grid(y) {
        var h = '';
        for (var m = 1; m <= 12; m++) {
          h += '<button class="chip-btn" data-act="pm-pick" data-m="' + m + '" aria-pressed="' + (y === cur.y && m === cur.m) + '">' + esc(Cal.monthName(m, lang)) + '</button>';
        }
        return h;
      }
      Dialog.open(
        dialogHead(t('pickMonth')) +
        '<div class="field"><label for="pmY">' + esc(t('year')) + '</label><select class="select" id="pmY">' + yearOptions(cur.y) + '</select></div>' +
        '<div class="month-grid" id="pmGrid">' + grid(cur.y) + '</div>',
        {
          onClose: function () { resolve(result); },
          change: function (el) { if (el.id === 'pmY') $('pmGrid').innerHTML = grid(+el.value); },
          handlers: { 'pm-pick': function (el) { result = { y: +$('pmY').value, m: +el.dataset.m }; Dialog.close(); } }
        }
      );
    });
  }

  // ---------- shared pieces ----------

  function searchBox(key, placeholder) {
    return '<label class="search grow">' + icon('search') +
      '<input class="input" type="search" data-search="' + key + '" placeholder="' + esc(placeholder || t('searchName')) + '" value="' +
      esc(ui.search[key]) + '" autocomplete="off" aria-label="' + esc(placeholder || t('searchName')) + '"></label>';
  }

  function matches(c, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return c.name.toLowerCase().indexOf(q) > -1 || (c.phone || '').indexOf(q) > -1 ||
      (c.address || '').toLowerCase().indexOf(q) > -1;
  }

  function metric(label, value, cls, note) {
    return '<div class="metric' + (cls ? ' ' + cls : '') + '"><div class="metric-label">' + esc(label) + '</div>' +
      '<div class="metric-value">' + esc(value) + '</div>' + (note ? '<div class="metric-note">' + esc(note) + '</div>' : '') + '</div>';
  }

  function badge(status) {
    var label = { paid: t('paid'), due: t('unpaid'), none: t('noMilk'), advance: t('advance'), stopped: t('stopped') }[status] || status;
    return '<span class="badge badge-' + status + '">' + esc(label) + '</span>';
  }

  function monthBar(y, m, act, pickAct) {
    var n = Cal.daysInMonth(y, m);
    return '<div class="monthbar">' +
      '<button class="icon-btn" data-act="' + act + '" data-delta="-1" aria-label="' + esc(t('prevMonth')) + '">' + icon('left') + '</button>' +
      '<button class="month-main" data-act="' + pickAct + '">' + esc(monthLabel(y, m)) +
      '<small>' + Cal.format(y, m, 1) + ' – ' + Cal.format(y, m, n) + ' · ' + esc(t('daysN', { n: n })) + '</small></button>' +
      '<button class="icon-btn" data-act="' + act + '" data-delta="1" aria-label="' + esc(t('nextMonth')) + '">' + icon('right') + '</button>' +
      '</div>';
  }

  function cardHead(title, linkAct, linkLabel) {
    return '<div class="card-head"><h2>' + esc(title) + '</h2>' +
      (linkAct ? '<button class="link" data-act="' + linkAct + '">' + esc(linkLabel) + '</button>' : '') + '</div>';
  }

  function emptyState(iconName, title, text, actions) {
    return '<div class="empty">' + icon(iconName) + '<h2>' + esc(title) + '</h2>' +
      (text ? '<p>' + esc(text) + '</p>' : '') + (actions ? '<div class="row">' + actions + '</div>' : '') + '</div>';
  }

  function noCustomersCard() {
    return '<section class="card">' + emptyState('users', t('noCustomersTitle'), t('noCustomersText'),
      '<button class="btn btn-primary" data-act="new-customer">' + icon('plus') + esc(t('addCustomer')) + '</button>' +
      '<button class="btn btn-secondary" data-act="add-many">' + esc(t('addMany')) + '</button>') +
      '<div class="card-foot stack" style="gap:4px">' +
      (state.meta.settings.shopName ? '' : '<button class="btn btn-ghost btn-block" data-act="go-settings">' + icon('gear') + esc(t('setShopName')) + '</button>') +
      '<button class="btn btn-ghost btn-block" data-act="backup-restore">' + icon('upload') + esc(t('restoreFirst')) + '</button></div>' +
      '</section>';
  }


  function goneHtml() {
    return '<section class="card">' + emptyState('info', t('notFound'), '',
      '<button class="btn btn-secondary" data-act="back">' + icon('left') + esc(t('back')) + '</button>') + '</section>';
  }

  function sortHead(view, key, label, alignRight) {
    var s = ui.sort[view];
    var on = s && s.key === key;
    return '<th' + (alignRight ? ' class="r"' : '') + ' aria-sort="' + (on ? (s.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button class="th-sort" data-act="sort" data-view="' + view + '" data-key="' + key + '">' + esc(label) +
      (on ? icon(s.dir > 0 ? 'up' : 'down') : '') + '</button></th>';
  }

  function pager(view, total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    var p = Math.min(ui.page[view], pages);
    ui.page[view] = p;
    if (pages <= 1) return '';
    return '<div class="pager"><span>' + esc(t('pageOf', { p: p, n: pages })) + '</span><div class="row">' +
      '<button class="btn btn-secondary btn-sm" data-act="page" data-view="' + view + '" data-delta="-1"' + (p <= 1 ? ' disabled' : '') + '>' + icon('left') + esc(t('previous')) + '</button>' +
      '<button class="btn btn-secondary btn-sm" data-act="page" data-view="' + view + '" data-delta="1"' + (p >= pages ? ' disabled' : '') + '>' + esc(t('next')) + icon('right') + '</button>' +
      '</div></div>';
  }
  function pageSlice(view, rows) {
    var p = ui.page[view] || 1;
    return rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  }

  function daysSince(iso) {
    var ms = Date.parse(iso);
    if (!isFinite(ms)) return null;
    return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
  }
  function whenText(iso) {
    var n = daysSince(iso);
    if (n === null) return t('never');
    var bs = Cal.fromAD(new Date(Date.parse(iso)));
    var time = new Date(Date.parse(iso));
    var hm = ('0' + time.getHours()).slice(-2) + ':' + ('0' + time.getMinutes()).slice(-2);
    return Cal.format(bs.y, bs.m, bs.d) + ' ' + hm + ' (' + (n === 0 ? t('todayWord') : t('daysAgo', { n: n })) + ')';
  }

  function alertsHtml() {
    var h = '';
    if (Store.mode === 'memory') h += '<div class="alert alert-danger">' + icon('alert') + '<span>' + esc(t('savedMemory')) + '</span></div>';
    if (ui.storageFull) h += '<div class="alert alert-danger">' + icon('alert') + '<span>' + esc(t('storageFull')) + '</span></div>';
    if (!IS_NATIVE && Store.mode === 'device' && state.meta.customers.length) {
      var since = daysSince(state.meta.settings.lastBackupAt);
      var first = state.meta.customers.reduce(function (min, c) { return c.createdAt < min ? c.createdAt : min; }, '9999');
      var age = daysSince(first);
      if ((since === null && age !== null && age >= 3) || (since !== null && since >= 7)) {
        h += '<button class="alert alert-warning" data-act="go-settings">' + icon('save') + '<span>' +
          esc(since === null ? t('backupReminderNever') : t('backupReminder', { n: since })) + '</span></button>';
      }
    }
    if (!IS_NATIVE && ui.installEvent && !isStandalone()) {
      h += '<button class="alert alert-info" data-act="install">' + icon('download') + '<span>' + esc(t('installBanner')) + '</span></button>';
    }
    return h;
  }

  function balances() {
    var map = {};
    state.meta.customers.forEach(function (c) { map[c.id] = L.totalBalance(state, c.id); });
    return map;
  }

  // ---------- views ----------

  var VIEWS = {};
  var AFTER = {};
  var TITLES = {};
  var ACT = {};
  var FORMS = {};

  // Dashboard

  function chartSvg(series, y, m) {
    var n = series.length;
    var max = Math.max.apply(null, series.concat([0]));
    var top = max > 0 ? Math.ceil(max / 5) * 5 : 5;
    var W = ui.wide ? 720 : 340, H = ui.wide ? 180 : 150, padL = 30, padB = 22, padT = 10, padR = 4;
    var cw = (W - padL - padR) / n;
    var now = todayBs();
    var h = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('chartLabel', { month: monthLabel(y, m) })) + '">';
    [0, 0.5, 1].forEach(function (f) {
      var gy = padT + (H - padT - padB) * (1 - f);
      h += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + L.formatLitre(top * f) + '</text>';
    });
    series.forEach(function (v, i) {
      var bh = top ? (H - padT - padB) * (v / top) : 0;
      var x = padL + i * cw + cw * 0.18;
      var isToday = now.y === y && now.m === m && now.d === i + 1;
      if (v > 0) h += '<rect class="bar' + (isToday ? ' today' : '') + '" x="' + x.toFixed(1) + '" y="' + (H - padB - bh).toFixed(1) + '" width="' + (cw * 0.64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2"><title>' + Cal.format(y, m, i + 1) + ': ' + L.formatLitre(v) + ' L</title></rect>';
      if (i === 0 || (i + 1) % 5 === 0) h += '<text x="' + (padL + i * cw + cw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i + 1) + '</text>';
    });
    return h + '</svg>';
  }

  TITLES.home = function () { var d = todayBs(); return { title: state.meta.settings.shopName || t('appName'), sub: dayName(d.y, d.m, d.d) + ', ' + Cal.format(d.y, d.m, d.d) }; };
  VIEWS.home = function () {
    var h = alertsHtml();
    if (!state.meta.customers.length) return h + noCustomersCard();
    var d = todayBs();
    var day = L.dayStats(state, d.y, d.m, d.d);
    var rep = L.monthReport(state, d.y, d.m);
    var tot = rep.totals;
    var pct = tot.paisa > 0 ? Math.min(100, Math.round(tot.paid / tot.paisa * 100)) : 0;

    h += '<div class="actions-bar">' +
      '<button class="btn btn-primary btn-lg" data-act="go-milk-today">' + icon('milk') + esc(t('enterTodayMilk')) + '</button>' +
      '<button class="btn btn-secondary btn-lg" data-act="new-payment">' + icon('wallet') + esc(t('recordPayment')) + '</button></div>';

    h += '<h2 class="section-title">' + esc(t('today')) + ' · ' + Cal.format(d.y, d.m, d.d) + '</h2>' +
      '<div class="metrics three">' +
      metric(t('milkToday'), litres(day.litres)) +
      metric(t('salesToday'), money(day.paisa)) +
      metric(t('written'), day.entered + '/' + day.total, day.total && day.entered === day.total ? 'is-good' : '') +
      '</div>';

    h += '<h2 class="section-title">' + esc(monthLabel(d.y, d.m)) + '</h2>' +
      '<div class="metrics four">' +
      metric(t('milkThisMonth'), litres(tot.litres)) +
      metric(t('sales'), money(tot.paisa)) +
      metric(t('received'), money(tot.paid), 'is-good') +
      metric(t('pending'), money(tot.toPay), tot.toPay > 0 ? 'is-pending' : '') +
      '</div>' +
      '<div class="stack" style="gap:6px"><div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '<p class="muted" style="font-size:14px">' + esc(t('receivedOf', { a: money(tot.paid), b: money(tot.paisa), p: pct })) + '</p></div>';

    h += '<section class="card">' + cardHead(t('dailyMilkChart', { month: monthLabel(d.y, d.m) }), 'go-records', t('viewRecords')) +
      '<div class="card-body">' + chartSvg(L.monthDailyTotals(state, d.y, d.m), d.y, d.m) + '</div></section>';

    var pend = L.pendingBalances(state).slice(0, 6);
    var pays = L.listPayments(state, {}).slice(0, 6);
    h += '<div class="grid-2">';
    h += '<section class="card">' + cardHead(t('unpaidBalances'), 'go-bills', t('viewBills'));
    if (!pend.length) h += '<p class="list-empty">' + esc(t('noUnpaid')) + '</p>';
    else {
      h += '<ul class="list">' + pend.map(function (r) {
        return '<li><button class="list-row" data-act="open-customer" data-cid="' + r.customer.id + '">' +
          '<span class="primary">' + esc(r.customer.name) + '</span><span class="secondary">' + esc(rateText(r.customer.rate)) + '</span>' +
          '<span class="end"><span class="amount">' + esc(money(r.paisa)) + '</span></span></button></li>';
      }).join('') + '</ul>';
    }
    h += '</section>';
    h += '<section class="card">' + cardHead(t('recentPayments'), 'go-payments', t('viewPayments'));
    if (!pays.length) h += '<p class="list-empty">' + esc(t('noPayments')) + '</p>';
    else {
      h += '<ul class="list">' + pays.map(function (r) {
        var p = r.payment;
        return '<li><div class="list-row"><span class="primary">' + esc(customerName(p.cid)) + '</span>' +
          '<span class="secondary">' + esc(fmtDate(p.date)) + ' · ' + esc(p.kind === 'bill' ? t('kindBill') : t('kindAdvance')) + ' · ' + esc(monthLabelKey(r.month)) + '</span>' +
          '<span class="end"><span class="amount">' + esc(money(L.toPaisa(p.amount))) + '</span></span></div></li>';
      }).join('') + '</ul>';
    }
    h += '</section></div>';
    return h;
  };

  ACT['go-milk-today'] = function () { ui.date = todayBs(); Nav.tab('milk'); };
  ACT['go-records'] = function () { ui.recMonth = thisMonth(); goSection('records'); };
  ACT['go-bills'] = function () { Nav.tab('bills'); };
  ACT['go-payments'] = function () { goSection('payments'); };
  ACT['go-settings'] = function () { goSection('settings'); };

  // Sections that live under "More" on phones.
  function goSection(view) {
    if (ui.wide) Nav.tab(view);
    else if (Nav.stack[0].view === 'more' && Nav.stack.length === 1) Nav.push(view, {});
    else { Nav.tab('more'); setTimeout(function () { Nav.push(view, {}); }, Nav.useHistory ? 60 : 0); }
  }

  // Daily milk

  function milkSummaryHtml() {
    var d = ui.date;
    var s = L.dayStats(state, d.y, d.m, d.d);
    return metric(t('totalMilk'), litres(s.litres)) + metric(t('amount'), money(s.paisa)) +
      metric(t('written'), s.entered + '/' + s.total, s.total && s.entered === s.total ? 'is-good' : '');
  }

  function fillHtml() {
    var d = ui.date;
    var n = L.pendingUsualCount(state, d.y, d.m, d.d);
    var s = L.dayStats(state, d.y, d.m, d.d);
    if (n) return '<button class="btn btn-primary btn-lg btn-block" data-act="fill-usual">' + icon('check') + esc(t('fillUsual', { n: n })) + '</button>';
    if (s.total && s.entered === s.total) return '<div class="alert alert-info">' + icon('check') + '<span>' + esc(t('allWritten', { n: s.total })) + '</span></div>';
    return '';
  }

  function entryRow(c, n) {
    var d = ui.date;
    var e = L.getEntry(state, d.y, d.m, d.d, c.id);
    var cls = !e ? ' is-empty' : (e.litres === 0 ? ' is-zero' : '');
    var qty = !e ? '<b>–</b>' : '<b>' + esc(L.formatLitre(e.litres)) + '</b><i>' + esc(t('L')) + '</i>';
    var meta = !e ? '<span class="not-written">' + esc(t('notWritten')) + '</span>'
      : (e.litres === 0 ? esc(t('noMilk')) : esc(money(L.amountPaisa(e.litres, e.rate))));
    return '<li class="entry' + cls + '">' +
      '<span class="idx">' + n + '</span><div class="name">' + esc(c.name) + '</div>' +
      '<div class="meta">' + meta + '</div>' +
      '<div class="stepper">' +
      '<button class="step" data-act="minus" data-cid="' + c.id + '" aria-label="' + esc(t('less') + ': ' + c.name) + '">' + icon('minus') + '</button>' +
      '<button class="qty" data-act="open-entry" data-cid="' + c.id + '" data-date="' + dkey(d) + '" aria-label="' + esc(c.name + ': ' + (e ? litres(e.litres) : t('notWritten'))) + '">' + qty + '</button>' +
      '<button class="step" data-act="plus" data-cid="' + c.id + '" aria-label="' + esc(t('more') + ': ' + c.name) + '">' + icon('plus') + '</button>' +
      '</div></li>';
  }

  function milkListHtml() {
    var q = ui.search.milk.trim();
    var h = '';
    L.activeCustomers(state).forEach(function (c, i) { if (matches(c, q)) h += entryRow(c, i + 1); });
    return h || '<li class="list-empty">' + esc(t('noMatch')) + '</li>';
  }

  function refreshMilk() {
    if (Nav.current().view !== 'milk' || !$('list')) { render(); return; }
    $('milkSummary').innerHTML = milkSummaryHtml();
    $('fillWrap').innerHTML = fillHtml();
    $('list').innerHTML = milkListHtml();
  }

  TITLES.milk = function () { return { title: t('navMilk'), sub: t('milkSub') }; };
  VIEWS.milk = function () {
    var d = ui.date, now = todayBs();
    var isToday = sameDay(d, now);
    var isFuture = Cal.toDayNumber(d.y, d.m, d.d) > Cal.toDayNumber(now.y, now.m, now.d);
    var h = '<div class="datebar">' +
      '<button class="icon-btn" data-act="day-prev" aria-label="' + esc(t('prevDay')) + '">' + icon('left') + '</button>' +
      '<button class="date-main" data-act="pick-date" aria-label="' + esc(t('pickDate')) + '"><b>' + Cal.format(d.y, d.m, d.d) + '</b>' +
      '<span>' + esc(dayName(d.y, d.m, d.d)) + ' · ' + esc(Cal.monthName(d.m, lang)) + ' ' + d.d +
      (isToday ? ' <span class="badge badge-today">' + esc(t('today')) + '</span>' : '') + '</span></button>' +
      '<button class="icon-btn" data-act="day-next" aria-label="' + esc(t('nextDay')) + '">' + icon('right') + '</button></div>';
    if (!isToday) h += '<button class="btn btn-ghost" data-act="go-today" style="align-self:center">' + icon('calendar') + esc(t('goToday')) + '</button>';
    if (isFuture) h += '<div class="alert alert-warning">' + icon('alert') + '<span>' + esc(t('futureDate')) + '</span></div>';
    if (!state.meta.customers.length) return h + noCustomersCard();
    var active = L.activeCustomers(state);
    h += '<div class="metrics three" id="milkSummary">' + milkSummaryHtml() + '</div>';
    h += '<div id="fillWrap">' + fillHtml() + '</div>';
    if (active.length > 6) h += '<div class="toolbar">' + searchBox('milk') + '</div>';
    h += '<section class="card"><ul class="entry-list" id="list">' + milkListHtml() + '</ul></section>';
    var stopped = state.meta.customers.length - active.length;
    if (stopped) h += '<p class="muted" style="font-size:14px">' + esc(t('stoppedHidden', { n: stopped })) + '</p>';
    return h;
  };

  function stepEntry(cid, delta) {
    var c = L.findCustomer(state, cid);
    if (!c) return;
    var d = ui.date;
    var e = L.getEntry(state, d.y, d.m, d.d, cid);
    var next = e ? L.roundLitre(Math.max(0, Math.min(500, e.litres + delta))) : (delta > 0 ? 0.5 : 0);
    var mk = L.setEntry(state, d.y, d.m, d.d, cid, next, e ? e.rate : c.rate);
    persist([mk]);
    refreshMilk();
  }

  ACT['day-prev'] = function () { ui.date = Cal.addDays(ui.date, -1); render(); };
  ACT['day-next'] = function () { ui.date = Cal.addDays(ui.date, 1); render(); };
  ACT['go-today'] = function () { ui.date = todayBs(); render(); };
  ACT['pick-date'] = function () { pickDate(ui.date).then(function (d) { if (d) { ui.date = d; render(); } }); };
  ACT.plus = function (el) { stepEntry(el.dataset.cid, 0.5); };
  ACT.minus = function (el) { stepEntry(el.dataset.cid, -0.5); };
  ACT['open-entry'] = function (el) { entryDialog(el.dataset.cid, el.dataset.date); };

  ACT['fill-usual'] = function () {
    var d = ui.date;
    var n = L.pendingUsualCount(state, d.y, d.m, d.d);
    if (!n) return;
    confirmDialog({ title: t('fillTitle'), text: t('fillText', { n: n, date: Cal.format(d.y, d.m, d.d) }), yes: t('fillYes') }).then(function (ok) {
      if (!ok) return;
      var r = L.fillUsual(state, d.y, d.m, d.d);
      persist([r.monthKey]);
      refreshMilk();
      toast(t('filled', { n: r.count }));
    });
  };

  function afterEntryChange() {
    if (Nav.current().view === 'milk') refreshMilk(); else render();
  }

  // Quick litre picker for one customer and one day.
  function entryDialog(cid, dateKey) {
    var c = L.findCustomer(state, cid);
    if (!c) return;
    var d = Cal.parseKey(dateKey);
    var e = L.getEntry(state, d.y, d.m, d.d, cid);
    var cur = e ? e.litres : null;
    var rate = e ? e.rate : c.rate;
    var presets = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
    var other = cur !== null && presets.indexOf(cur) < 0 ? L.formatLitre(cur) : '';

    function apply(v) {
      var mk = v === null ? L.clearEntry(state, d.y, d.m, d.d, cid) : L.setEntry(state, d.y, d.m, d.d, cid, v, rate);
      persist([mk]);
      Dialog.close().then(function () {
        afterEntryChange();
        toast(v === null ? t('entryRemoved') : t('entrySaved', { l: litres(v), name: c.name }));
      });
    }

    Dialog.open(
      dialogHead(c.name, Cal.format(d.y, d.m, d.d) + ' · ' + dayName(d.y, d.m, d.d) + ' · ' + rateText(rate)) +
      '<div class="preset-grid">' + presets.map(function (v) {
        var label = v === 0 ? esc(t('noMilk')) : esc(niceLitre(v)) + '<small>' + esc(t('L')) + '</small>';
        return '<button class="preset' + (v === 0 ? ' zero' : '') + '" data-act="entry-set" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + label + '</button>';
      }).join('') + '</div>' +
      '<form class="field" data-form="entry-other" novalidate><label for="otherLitre">' + esc(t('otherAmount')) + '</label>' +
      '<div class="row"><div class="input-unit grow" style="flex:1"><input class="input" id="otherLitre" inputmode="decimal" autocomplete="off" value="' + esc(other) + '" placeholder="0.75"><span class="unit">' + esc(t('L')) + '</span></div>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('save')) + '</button></div>' +
      '<p class="field-error" id="otherErr" hidden></p></form>' +
      (e ? '<button class="btn btn-danger-outline" data-act="entry-clear">' + icon('trash') + esc(t('removeEntry')) + '</button>' : ''),
      {
        handlers: {
          'entry-set': function (el) { apply(+el.dataset.v); },
          'entry-clear': function () { apply(null); }
        },
        forms: {
          'entry-other': function () {
            var v = L.parseNumber($('otherLitre').value);
            if (!isFinite(v) || v < 0 || v > 500) {
              $('otherErr').textContent = t('litreInvalid');
              $('otherErr').hidden = false;
              return;
            }
            apply(L.roundLitre(v));
          }
        }
      }
    );
  }

  // Full milk entry form: any customer, any date, own price.
  function entryFormDialog(pre) {
    pre = pre || {};
    var list = state.meta.customers;
    if (!list.length) { toast(t('noCustomersTitle'), 'error'); return; }
    var cid = pre.cid || (L.activeCustomers(state)[0] || list[0]).id;
    var date = pre.date || todayBs();
    var editing = !!pre.edit;
    var e0 = L.getEntry(state, date.y, date.m, date.d, cid);
    var c0 = L.findCustomer(state, cid);
    var qty0 = e0 ? L.formatLitre(e0.litres) : (c0.usual > 0 ? L.formatLitre(c0.usual) : '');
    var rate0 = e0 ? e0.rate : c0.rate;
    var opts = list.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.name) + (c.active === false ? ' (' + esc(t('stopped')) + ')' : '') + '</option>';
    }).join('');

    function total() {
      var q = L.parseNumber($('efQty').value), r = L.parseNumber($('efRate').value);
      $('efTotal').textContent = isFinite(q) && isFinite(r) && q >= 0 && r > 0 ? money(L.amountPaisa(L.roundLitre(q), r)) : '—';
    }

    Dialog.open(
      dialogHead(editing ? t('editEntry') : t('addEntry')) +
      '<form class="form" data-form="entry-full" novalidate>' +
      '<div class="field"><label for="efCust">' + esc(t('customer')) + '</label><select class="select" id="efCust"' + (editing ? ' disabled' : '') + '>' + opts + '</select></div>' +
      '<div class="field"><span class="label">' + esc(t('date')) + '</span>' + datePickerHtml('ef', date) + '</div>' +
      '<div class="form-grid two">' +
      '<div class="field" id="wrap-efQty"><label for="efQty">' + esc(t('quantity')) + '</label><div class="input-unit"><input class="input" id="efQty" inputmode="decimal" autocomplete="off" value="' + esc(qty0) + '"><span class="unit">' + esc(t('L')) + '</span></div><p class="field-error" id="err-efQty" hidden></p></div>' +
      '<div class="field" id="wrap-efRate"><label for="efRate">' + esc(t('price')) + '</label><div class="input-unit"><input class="input" id="efRate" inputmode="decimal" autocomplete="off" value="' + esc(rate0) + '"><span class="unit">' + esc(t('rs')) + '/' + esc(t('L')) + '</span></div><p class="field-error" id="err-efRate" hidden></p></div>' +
      '</div>' +
      '<div class="calc-line"><span>' + esc(t('total')) + '</span><b id="efTotal">—</b></div>' +
      '<div class="form-actions"><button class="btn btn-secondary btn-lg" type="button" data-act="dialog-close">' + esc(t('cancel')) + '</button>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('saveEntry')) + '</button></div>' +
      '</form>',
      {
        change: function (el) {
          datePickerChange('ef', el);
          if (el.id === 'efCust' || el.id.indexOf('ef') === 0) {
            var c = L.findCustomer(state, $('efCust').value);
            var dd = datePickerRead('ef');
            if (el.id === 'efCust' && c) {
              var ex = dd && L.getEntry(state, dd.y, dd.m, dd.d, c.id);
              $('efRate').value = ex ? ex.rate : c.rate;
              if (!$('efQty').value) $('efQty').value = c.usual > 0 ? L.formatLitre(c.usual) : '';
            }
            total();
          }
        },
        input: function () { total(); },
        forms: {
          'entry-full': function () {
            ['efQty', 'efRate'].forEach(function (id) { $('wrap-' + id).classList.remove('invalid'); $('err-' + id).hidden = true; });
            var c = L.findCustomer(state, $('efCust').value);
            var dd = datePickerRead('ef');
            var q = L.parseNumber($('efQty').value), r = L.parseNumber($('efRate').value);
            var bad = false;
            if (!isFinite(q) || q < 0 || q > 500) { $('wrap-efQty').classList.add('invalid'); $('err-efQty').textContent = t('litreInvalid'); $('err-efQty').hidden = false; bad = true; }
            if (!isFinite(r) || r <= 0 || r > 100000) { $('wrap-efRate').classList.add('invalid'); $('err-efRate').textContent = t('rateInvalid'); $('err-efRate').hidden = false; bad = true; }
            if (bad || !c || !dd) return;
            var existing = L.getEntry(state, dd.y, dd.m, dd.d, c.id);
            var moving = editing && (dd.y !== date.y || dd.m !== date.m || dd.d !== date.d);
            var ask = existing && (!editing || moving)
              ? confirmDialog({ title: t('replaceTitle'), text: t('replaceText', { name: c.name, date: Cal.format(dd.y, dd.m, dd.d), l: litres(existing.litres) }), yes: t('replaceYes') })
              : Dialog.close().then(function () { return true; });
            ask.then(function (ok) {
              if (!ok) return;
              var parts = [];
              if (moving) parts.push(L.clearEntry(state, date.y, date.m, date.d, c.id));
              parts.push(L.setEntry(state, dd.y, dd.m, dd.d, c.id, L.roundLitre(q), Math.round(r * 100) / 100));
              persist(parts);
              toast(t('entrySaved', { l: litres(L.roundLitre(q)), name: c.name }));
              render();
            });
          }
        }
      }
    );
    total();
  }

  // Customers

  TITLES.customers = function () { return { title: t('navCustomers'), sub: t('customersCount', { n: state.meta.customers.length }) }; };
  VIEWS.customers = function () {
    var list = state.meta.customers;
    if (!list.length) return noCustomersCard();
    var active = L.activeCustomers(state).length;
    var stopped = list.length - active;
    var h = '<div class="toolbar">' + (ui.reorder ? '' : searchBox('customers', t('searchCustomers'))) +
      '<button class="btn btn-primary" data-act="new-customer">' + icon('plus') + esc(t('addCustomer')) + '</button></div>';
    h += '<div class="row-between" style="flex-wrap:wrap">' +
      (ui.reorder ? '<span class="muted">' + esc(t('reorderHelp')) + '</span>' :
        '<div class="seg" role="group" aria-label="' + esc(t('show')) + '">' +
        [['active', t('activeN', { n: active })], ['stopped', t('stoppedN', { n: stopped })], ['all', t('allN', { n: list.length })]].map(function (f) {
          return '<button data-act="cust-filter" data-v="' + f[0] + '" aria-pressed="' + (ui.custFilter === f[0]) + '">' + esc(f[1]) + '</button>';
        }).join('') + '</div>') +
      '<div class="row"><button class="link" data-act="toggle-reorder">' + esc(ui.reorder ? t('done') : t('changeOrder')) + '</button>' +
      (ui.reorder ? '' : '<button class="link" data-act="add-many">' + esc(t('addMany')) + '</button>') + '</div></div>';
    h += '<section class="card" id="listWrap">' + customersListHtml() + '</section>';
    return h;
  };

  function customerRows() {
    var q = ui.reorder ? '' : ui.search.customers.trim();
    var bal = balances();
    var rows = state.meta.customers.map(function (c, i) { return { c: c, i: i, bal: bal[c.id] }; }).filter(function (r) {
      if (!ui.reorder) {
        if (ui.custFilter === 'active' && r.c.active === false) return false;
        if (ui.custFilter === 'stopped' && r.c.active !== false) return false;
      }
      return matches(r.c, q);
    });
    var s = ui.sort.customers;
    if (!ui.reorder && s.key !== 'order') {
      rows.sort(function (a, b) {
        var v = s.key === 'name' ? a.c.name.localeCompare(b.c.name) : s.key === 'rate' ? a.c.rate - b.c.rate : a.bal - b.bal;
        return v * s.dir || a.i - b.i;
      });
    }
    return rows;
  }

  function customersListHtml() {
    var rows = customerRows();
    if (!rows.length) return '<p class="list-empty">' + esc(t('noMatch')) + '</p>';
    var n = state.meta.customers.length;
    if (ui.reorder) {
      return '<ul class="list">' + rows.map(function (r) {
        return '<li><div class="list-row" style="grid-template-columns:minmax(0,1fr) auto auto"><span class="primary"><span class="idx">' + (r.i + 1) + '</span>' + esc(r.c.name) + '</span>' +
          '<button class="icon-btn" data-act="move" data-cid="' + r.c.id + '" data-dir="-1" aria-label="' + esc(t('moveUp')) + '"' + (r.i === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
          '<button class="icon-btn" data-act="move" data-cid="' + r.c.id + '" data-dir="1" aria-label="' + esc(t('moveDown')) + '"' + (r.i === n - 1 ? ' disabled' : '') + '>' + icon('down') + '</button></div></li>';
      }).join('') + '</ul>';
    }
    if (ui.wide) {
      return '<div class="table-wrap"><table class="table"><thead><tr>' +
        sortHead('customers', 'order', '#') + sortHead('customers', 'name', t('name')) + '<th>' + esc(t('phoneShort')) + '</th><th>' + esc(t('addressShort')) + '</th>' +
        sortHead('customers', 'rate', t('price'), true) + '<th class="r">' + esc(t('usualShortHead')) + '</th>' + sortHead('customers', 'bal', t('unpaid'), true) + '<th>' + esc(t('status')) + '</th>' +
        '</tr></thead><tbody>' + rows.map(function (r) {
          var c = r.c;
          return '<tr class="clickable" data-act="open-customer" data-cid="' + c.id + '"><td class="faint">' + (r.i + 1) + '</td><td class="strong">' + esc(c.name) + '</td>' +
            '<td class="nowrap">' + esc(c.phone || '—') + '</td><td>' + esc(c.address || '—') + '</td><td class="r">' + esc(rateText(c.rate)) + '</td>' +
            '<td class="r">' + esc(litres(c.usual)) + '</td><td class="r">' + (r.bal > 0 ? esc(money(r.bal)) : r.bal < 0 ? '<span class="muted">' + esc(t('advance')) + ' ' + esc(money(-r.bal)) + '</span>' : '—') + '</td>' +
            '<td>' + (c.active === false ? badge('stopped') : '<span class="muted">' + esc(t('active')) + '</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return '<ul class="list">' + rows.map(function (r) {
      var c = r.c;
      var meta = [rateText(c.rate), c.usual > 0 ? t('usualShort', { l: L.formatLitre(c.usual) }) : '', c.phone].filter(Boolean).join(' · ');
      return '<li><button class="list-row" data-act="open-customer" data-cid="' + c.id + '">' +
        '<span class="primary"><span class="idx">' + (r.i + 1) + '</span>' + esc(c.name) + '</span>' +
        '<span class="secondary">' + esc(meta) + '</span>' +
        '<span class="end">' + (c.active === false ? badge('stopped') : '') +
        (r.bal > 0 ? '<span class="amount">' + esc(money(r.bal)) + '</span><span class="faint" style="font-size:12px">' + esc(t('unpaid')) + '</span>' : '') +
        '</span></button></li>';
    }).join('') + '</ul>';
  }

  ACT['new-customer'] = function () { Nav.push('customerForm', {}); };
  ACT['open-customer'] = function (el) { Nav.push('customer', { id: el.dataset.cid }); };
  ACT['toggle-reorder'] = function () { ui.reorder = !ui.reorder; render(); };
  ACT['cust-filter'] = function (el) { ui.custFilter = el.dataset.v; render(); };
  ACT.move = function (el) {
    if (L.moveCustomer(state, el.dataset.cid, +el.dataset.dir)) {
      persist(['meta']);
      $('listWrap').innerHTML = customersListHtml();
    }
  };
  ACT.sort = function (el) {
    var s = ui.sort[el.dataset.view];
    if (s.key === el.dataset.key) s.dir = -s.dir;
    else { s.key = el.dataset.key; s.dir = el.dataset.key === 'date' || el.dataset.key === 'bal' || el.dataset.key === 'amount' ? -1 : 1; }
    render();
  };
  ACT.page = function (el) {
    ui.page[el.dataset.view] = Math.max(1, (ui.page[el.dataset.view] || 1) + (+el.dataset.delta));
    render();
    window.scrollTo(0, 0);
  };

  ACT['add-many'] = function () {
    var s = state.meta.settings;
    Dialog.open(
      dialogHead(t('manyTitle'), t('manyHelp')) +
      '<form class="form" data-form="many" novalidate>' +
      '<div class="field"><label for="manyNames">' + esc(t('names')) + '</label><textarea class="textarea" id="manyNames" rows="7" placeholder="' + esc(t('manyPh')) + '"></textarea></div>' +
      '<div class="form-grid two">' +
      '<div class="field"><label for="manyRate">' + esc(t('price')) + '</label><div class="input-unit"><input class="input" id="manyRate" inputmode="decimal" value="' + esc(s.defaultRate) + '"><span class="unit">' + esc(t('rs')) + '/' + esc(t('L')) + '</span></div></div>' +
      '<div class="field"><label for="manyUsual">' + esc(t('usual')) + '</label><div class="input-unit"><input class="input" id="manyUsual" inputmode="decimal" value="' + esc(L.formatLitre(s.defaultUsual)) + '"><span class="unit">' + esc(t('L')) + '</span></div></div>' +
      '</div><p class="field-error" id="manyErr" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-secondary btn-lg" type="button" data-act="dialog-close">' + esc(t('cancel')) + '</button>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('manyAdd')) + '</button></div></form>',
      {
        forms: {
          many: function () {
            var err = $('manyErr');
            var names = $('manyNames').value.split(/\r?\n/).map(function (n) { return n.trim(); }).filter(Boolean);
            if (!names.length) { err.textContent = t('manyEmpty'); err.hidden = false; return; }
            var rate = $('manyRate').value, usual = $('manyUsual').value;
            var check = L.validateCustomer({ name: names[0], rate: rate, usual: usual }, s);
            if (!check.ok) { err.textContent = t(check.error); err.hidden = false; return; }
            var added = 0;
            names.forEach(function (n) {
              var r = L.validateCustomer({ name: n, rate: rate, usual: usual }, s);
              if (r.ok) { L.addCustomer(state, r.value); added++; }
            });
            persist(['meta']);
            Dialog.close().then(function () { toast(t('manyAdded', { n: added })); render(); });
          }
        }
      }
    );
  };

  // Customer form

  function field(id, label, inner, opt, hint) {
    return '<div class="field" id="wrap-' + id + '"><label for="' + id + '">' + esc(label) +
      (opt ? ' <span class="optional">(' + esc(t('optional')) + ')</span>' : '') + '</label>' + inner +
      (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') + '<p class="field-error" id="err-' + id + '" hidden></p></div>';
  }

  function syncUsualChips() {
    var input = $('f-usual');
    if (!input) return;
    var v = L.parseNumber(input.value);
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="usual-chip"]'), function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.v === v));
    });
  }

  TITLES.customerForm = function (p) { return { title: p.id ? t('editCustomer') : t('newCustomer'), sub: '' }; };
  VIEWS.customerForm = function (p) {
    var c = p.id ? L.findCustomer(state, p.id) : null;
    if (p.id && !c) return goneHtml();
    var s = state.meta.settings;
    var v = c || { name: '', phone: '', address: '', rate: s.defaultRate, usual: s.defaultUsual };
    var chips = [0.5, 1, 1.5, 2].map(function (x) {
      return '<button type="button" class="chip-btn" data-act="usual-chip" data-v="' + x + '" aria-pressed="' + (x === v.usual) + '">' + esc(niceLitre(x)) + ' ' + esc(t('L')) + '</button>';
    }).join('');
    return '<section class="card"><form class="card-body form" data-form="customer" data-cid="' + (c ? c.id : '') + '" novalidate>' +
      field('f-name', t('name'), '<input class="input" id="f-name" autocomplete="off" autocapitalize="words" maxlength="60" value="' + esc(v.name) + '" autofocus>') +
      '<div class="form-grid two">' +
      field('f-phone', t('phone'), '<input class="input" id="f-phone" type="tel" inputmode="tel" autocomplete="off" maxlength="30" value="' + esc(v.phone) + '">', true) +
      field('f-rate', t('price'), '<div class="input-unit"><input class="input" id="f-rate" inputmode="decimal" autocomplete="off" value="' + esc(v.rate) + '"><span class="unit">' + esc(t('rs')) + '/' + esc(t('L')) + '</span></div>') +
      '</div>' +
      field('f-address', t('address'), '<textarea class="textarea" id="f-address" maxlength="200" placeholder="' + esc(t('addressPh')) + '">' + esc(v.address) + '</textarea>', true) +
      field('f-usual', t('usual'), '<div class="chips">' + chips + '</div>' +
        '<div class="input-unit"><input class="input" id="f-usual" inputmode="decimal" autocomplete="off" value="' + esc(L.formatLitre(v.usual)) + '"><span class="unit">' + esc(t('L')) + '</span></div>', false, t('usualHelp')) +
      '<div class="form-actions"><button class="btn btn-secondary btn-lg" type="button" data-act="back">' + esc(t('cancel')) + '</button>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(c ? t('saveChanges') : t('addCustomer')) + '</button></div>' +
      '</form></section>';
  };

  ACT['usual-chip'] = function (el) { $('f-usual').value = el.dataset.v; syncUsualChips(); };

  function showFieldError(id, msg) {
    var wrap = $('wrap-' + id), err = $('err-' + id);
    if (wrap) wrap.classList.add('invalid');
    if (err) { err.textContent = msg; err.hidden = false; }
    var input = $(id);
    if (input) { input.focus(); if (input.scrollIntoView) input.scrollIntoView({ block: 'center' }); }
  }
  function clearFieldErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('.field'), function (f) { f.classList.remove('invalid'); });
    Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (e) { e.hidden = true; });
  }

  function hasEntries(cid) {
    return Object.keys(state.months).some(function (mk) {
      var days = state.months[mk].days;
      return Object.keys(days).some(function (dd) { return !!days[dd][cid]; });
    });
  }

  function askRateScope(rate) {
    return new Promise(function (resolve) {
      var result = 'new';
      var now = todayBs();
      function opt(scope, label, sub) {
        return '<button class="menu-row" style="border:1px solid var(--border);border-radius:8px" data-act="rate-scope" data-scope="' + scope + '"><span class="txt"><b>' + esc(label) + '</b>' +
          (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span>' + icon('right', 'chev') + '</button>';
      }
      Dialog.open(
        dialogHead(t('rateChangeTitle', { rate: L.formatMoney(Math.round(rate * 100)) }), t('rateChangeText')) +
        '<div class="stack" style="gap:8px">' +
        opt(dkey(now), t('rateFromToday'), Cal.format(now.y, now.m, now.d)) +
        opt(Cal.key(now.y, now.m, 1), t('rateFromMonth'), Cal.format(now.y, now.m, 1)) +
        opt('all', t('rateAll'), '') +
        opt('new', t('rateOnlyNew'), '') + '</div>',
        {
          onClose: function () { resolve(result); },
          handlers: { 'rate-scope': function (el) { result = el.dataset.scope; Dialog.close(); } }
        }
      );
    });
  }

  FORMS.customer = function (form) {
    clearFieldErrors(form);
    var input = { name: $('f-name').value, phone: $('f-phone').value, address: $('f-address').value, rate: $('f-rate').value, usual: $('f-usual').value };
    var res = L.validateCustomer(input, state.meta.settings);
    if (!res.ok) { showFieldError('f-' + res.field, t(res.error)); return; }
    var id = form.dataset.cid || null;
    var ask = L.nameExists(state, res.value.name, id)
      ? confirmDialog({ title: t('duplicateTitle', { name: res.value.name }), text: t('duplicateText'), yes: t('saveAnyway') })
      : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      if (!id) {
        var added = L.addCustomer(state, res.value);
        persist(['meta']);
        toast(t('customerAdded', { name: added.name }));
        Nav.back();
        return;
      }
      var existing = L.findCustomer(state, id);
      if (!existing) return;
      var oldRate = existing.rate;
      L.updateCustomer(state, id, res.value);
      if (oldRate !== res.value.rate && hasEntries(id)) {
        askRateScope(res.value.rate).then(function (scope) {
          var dirty = scope && scope !== 'new' ? L.applyRateFrom(state, id, res.value.rate, scope === 'all' ? null : scope) : [];
          persist(['meta'].concat(dirty));
          toast(t('saved'));
          Nav.back();
        });
        return;
      }
      persist(['meta']);
      toast(t('saved'));
      Nav.back();
    });
  };

  // Customer page

  function calendarHtml(c, ym) {
    var n = Cal.daysInMonth(ym.y, ym.m);
    var start = Cal.weekday(ym.y, ym.m, 1);
    var now = todayBs();
    var h = '<div class="cal">';
    WEEK_SHORT[lang].forEach(function (w) { h += '<span class="wd">' + esc(w) + '</span>'; });
    for (var i = 0; i < start; i++) h += '<span class="cal-blank"></span>';
    for (var d = 1; d <= n; d++) {
      var e = L.getEntry(state, ym.y, ym.m, d, c.id);
      var cls = e ? (e.litres > 0 ? 'has' : 'zero') : 'none';
      if (ym.y === now.y && ym.m === now.m && d === now.d) cls += ' today';
      h += '<button class="cal-cell ' + cls + '" data-act="open-entry" data-cid="' + c.id + '" data-date="' + Cal.key(ym.y, ym.m, d) + '" aria-label="' +
        Cal.format(ym.y, ym.m, d) + ': ' + (e ? esc(litres(e.litres)) : esc(t('notWritten'))) + '">' +
        '<span class="dn">' + d + '</span><span class="lv">' + (e ? esc(L.formatLitre(e.litres)) : '·') + '</span></button>';
    }
    return h + '</div>';
  }

  TITLES.customer = function (p) {
    var c = L.findCustomer(state, p.id);
    return { title: c ? c.name : '', sub: t('customer'), actions: c ? '<button class="icon-btn" data-act="edit-customer" data-cid="' + c.id + '" aria-label="' + esc(t('editCustomer')) + '">' + icon('edit') + '</button>' : '' };
  };
  VIEWS.customer = function (p) {
    var c = L.findCustomer(state, p.id);
    if (!c) return goneHtml();
    var stopped = c.active === false;
    var ym = ui.custMonth[c.id] || thisMonth();
    var bal = L.totalBalance(state, c.id);
    var h = '<section class="card"><div class="card-body">' +
      '<div class="row-between"><h2 style="font-size:20px;overflow-wrap:anywhere">' + esc(c.name) + '</h2>' + (stopped ? badge('stopped') : '') + '</div>' +
      '<div class="info-grid">' +
      '<div><div class="k">' + esc(t('phoneShort')) + '</div><div class="v">' + (c.phone ? '<a href="tel:' + esc(c.phone.replace(/[^0-9+]/g, '')) + '" class="link" style="font-size:16px">' + esc(c.phone) + '</a>' : '—') + '</div></div>' +
      '<div><div class="k">' + esc(t('price')) + '</div><div class="v">' + esc(rateText(c.rate)) + '</div></div>' +
      '<div><div class="k">' + esc(t('usualShortHead')) + '</div><div class="v">' + esc(litres(c.usual)) + '</div></div>' +
      '<div><div class="k">' + esc(bal < 0 ? t('advanceHeld') : t('unpaid')) + '</div><div class="v" style="color:' + (bal > 0 ? 'var(--warning)' : 'var(--primary)') + '">' + esc(money(Math.abs(bal))) + '</div></div>' +
      (c.address ? '<div style="grid-column:1/-1"><div class="k">' + esc(t('addressShort')) + '</div><div class="v" style="font-weight:400">' + esc(c.address) + '</div></div>' : '') +
      '</div>' +
      '<div class="actions-bar two">' +
      '<button class="btn btn-primary" data-act="cust-bill" data-cid="' + c.id + '">' + icon('bill') + esc(t('makeBill')) + '</button>' +
      '<button class="btn btn-secondary" data-act="new-payment" data-cid="' + c.id + '">' + icon('wallet') + esc(t('recordPayment')) + '</button>' +
      '</div></div></section>';
    if (stopped) h += '<div class="alert alert-warning">' + icon('pause') + '<span>' + esc(t('stoppedNote')) + '</span></div>';

    var milk = L.monthMilk(state, c.id, Cal.monthKey(ym.y, ym.m));
    h += '<section class="card">' + cardHead(t('milkCalendar')) + '<div class="card-body">' + monthBar(ym.y, ym.m, 'cust-month', 'cust-month-pick') +
      calendarHtml(c, ym) +
      '<p class="muted" style="font-size:14px">' + esc(t('calTotals', { l: litres(milk.litres), a: money(milk.paisa), n: milk.days })) + ' · ' + esc(t('calHelp')) + '</p>' +
      '</div></section>';

    var months = L.customerMonths(state, c.id);
    h += '<section class="card">' + cardHead(t('monthByMonth'));
    if (!months.length) h += '<p class="list-empty">' + esc(t('noRecords')) + '</p>';
    else if (ui.wide) {
      h += '<div class="table-wrap"><table class="table"><thead><tr><th>' + esc(t('month')) + '</th><th class="r">' + esc(t('milk')) + '</th><th class="r">' + esc(t('amount')) + '</th><th class="r">' + esc(t('paidCol')) + '</th><th class="r">' + esc(t('toPay')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        months.map(function (mk) {
          var q = Cal.parseKey(mk);
          var b = L.monthBill(state, c.id, q.y, q.m);
          return '<tr class="clickable" data-act="open-bill" data-cid="' + c.id + '" data-mk="' + mk + '"><td class="strong">' + esc(monthLabel(q.y, q.m)) + '</td><td class="r">' + esc(litres(b.litres)) + '</td>' +
            '<td class="r">' + esc(money(b.paisa)) + '</td><td class="r">' + esc(money(b.paidPaisa)) + '</td><td class="r">' + esc(money(b.toPayPaisa)) + '</td><td>' + badge(b.status) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      h += '<ul class="list">' + months.map(function (mk) {
        var q = Cal.parseKey(mk);
        var b = L.monthBill(state, c.id, q.y, q.m);
        return '<li><button class="list-row" data-act="open-bill" data-cid="' + c.id + '" data-mk="' + mk + '"><span class="primary">' + esc(monthLabel(q.y, q.m)) + '</span>' +
          '<span class="secondary">' + esc(litres(b.litres)) + ' · ' + esc(money(b.paisa)) + '</span>' +
          '<span class="end">' + badge(b.status) + (b.toPayPaisa > 0 ? '<span class="amount">' + esc(money(b.toPayPaisa)) + '</span>' : '') + '</span></button></li>';
      }).join('') + '</ul>';
    }
    h += '</section>';

    var pays = L.listPayments(state, { cid: c.id });
    h += '<section class="card">' + cardHead(t('payments')) + paymentsTable(pays, true) + '</section>';

    h += '<section class="card">' + cardHead(t('customerActions')) + '<div class="card-body"><div class="toolbar">' +
      '<button class="btn btn-secondary" data-act="toggle-active" data-cid="' + c.id + '">' + (stopped ? icon('play') + esc(t('startMilk')) : icon('pause') + esc(t('stopMilk'))) + '</button>' +
      '<button class="btn btn-danger-outline" data-act="delete-customer" data-cid="' + c.id + '">' + icon('trash') + esc(t('deleteCustomer')) + '</button>' +
      '</div><p class="muted" style="font-size:14px">' + esc(t('stopHelp')) + '</p></div></section>';
    return h;
  };

  ACT['cust-month'] = function (el) {
    var id = Nav.current().params.id;
    var ym = ui.custMonth[id] || thisMonth();
    ui.custMonth[id] = Cal.addMonths(ym.y, ym.m, +el.dataset.delta);
    render();
  };
  ACT['cust-month-pick'] = function () {
    var id = Nav.current().params.id;
    pickMonth(ui.custMonth[id] || thisMonth()).then(function (ym) { if (ym) { ui.custMonth[id] = ym; render(); } });
  };
  ACT['cust-bill'] = function (el) {
    var ym = ui.custMonth[el.dataset.cid] || thisMonth();
    Nav.push('bill', { id: el.dataset.cid, mk: Cal.monthKey(ym.y, ym.m) });
  };
  ACT['open-bill'] = function (el) { Nav.push('bill', { id: el.dataset.cid, mk: el.dataset.mk }); };
  ACT['edit-customer'] = function (el) { Nav.push('customerForm', { id: el.dataset.cid }); };
  ACT['toggle-active'] = function (el) {
    var c = L.findCustomer(state, el.dataset.cid);
    if (!c) return;
    c.active = c.active === false;
    persist(['meta']);
    toast(c.active ? t('startedNote', { name: c.name }) : t('stoppedToast', { name: c.name }));
    render();
  };
  ACT['delete-customer'] = function (el) {
    var c = L.findCustomer(state, el.dataset.cid);
    if (!c) return;
    confirmDialog({ title: t('deleteTitle', { name: c.name }), text: t('deleteText', { name: c.name }), yes: t('deleteYes'), danger: true }).then(function (ok) {
      if (!ok) return;
      var dirty = L.deleteCustomer(state, c.id);
      persist(['meta'].concat(dirty));
      toast(t('deleted', { name: c.name }));
      Nav.back();
    });
  };

  // Payments

  function paymentsTable(rows, forCustomer) {
    if (!rows.length) return '<p class="list-empty">' + esc(t('noPayments')) + '</p>';
    if (ui.wide) {
      return '<div class="table-wrap"><table class="table"><thead><tr>' +
        (forCustomer ? '<th>' + esc(t('date')) + '</th>' : sortHead('payments', 'date', t('date'))) +
        (forCustomer ? '' : '<th>' + esc(t('customer')) + '</th>') +
        '<th>' + esc(t('forMonth')) + '</th><th>' + esc(t('type')) + '</th><th>' + esc(t('note')) + '</th>' +
        (forCustomer ? '<th class="r">' + esc(t('amount')) + '</th>' : sortHead('payments', 'amount', t('amount'), true)) + '<th class="r"><span class="sr-only">' + esc(t('actions')) + '</span></th>' +
        '</tr></thead><tbody>' + rows.map(function (r) {
          var p = r.payment;
          return '<tr><td class="nowrap">' + esc(fmtDate(p.date)) + '</td>' + (forCustomer ? '' : '<td class="strong">' + esc(customerName(p.cid)) + '</td>') +
            '<td class="nowrap">' + esc(monthLabelKey(r.month)) + '</td><td>' + esc(p.kind === 'bill' ? t('kindBill') : t('kindAdvance')) + '</td><td>' + esc(p.note || '—') + '</td>' +
            '<td class="r strong">' + esc(money(L.toPaisa(p.amount))) + '</td>' +
            '<td><div class="row-actions"><button class="icon-btn" data-act="edit-payment" data-pid="' + esc(p.id) + '" aria-label="' + esc(t('edit')) + '">' + icon('edit') + '</button>' +
            '<button class="icon-btn danger" data-act="del-payment" data-pid="' + esc(p.id) + '" aria-label="' + esc(t('delete')) + '">' + icon('trash') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return '<ul class="list">' + rows.map(function (r) {
      var p = r.payment;
      return '<li><button class="list-row" data-act="edit-payment" data-pid="' + esc(p.id) + '">' +
        '<span class="primary">' + esc(forCustomer ? (p.kind === 'bill' ? t('kindBill') : t('kindAdvance')) : customerName(p.cid)) + '</span>' +
        '<span class="secondary">' + esc(fmtDate(p.date)) + ' · ' + esc(t('forMonth')) + ': ' + esc(monthLabelKey(r.month)) +
        (forCustomer ? '' : ' · ' + esc(p.kind === 'bill' ? t('kindBill') : t('kindAdvance'))) + (p.note ? ' · ' + esc(p.note) : '') + '</span>' +
        '<span class="end"><span class="amount">' + esc(money(L.toPaisa(p.amount))) + '</span></span></button></li>';
    }).join('') + '</ul>';
  }

  function paymentRows() {
    var f = ui.payFilter;
    var rows = L.listPayments(state, { monthKey: f.month || null, cid: f.cid || null, kind: f.kind || null });
    var q = ui.search.payments.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return customerName(r.payment.cid).toLowerCase().indexOf(q) > -1 || (r.payment.note || '').toLowerCase().indexOf(q) > -1; });
    var s = ui.sort.payments;
    if (s.key === 'amount') rows.sort(function (a, b) { return (a.payment.amount - b.payment.amount) * s.dir; });
    else if (s.dir > 0) rows.reverse();
    return rows;
  }

  function monthsWithData() {
    var keys = Object.keys(state.months);
    var cur = thisMonth();
    var ck = Cal.monthKey(cur.y, cur.m);
    if (keys.indexOf(ck) < 0) keys.push(ck);
    return keys.sort().reverse();
  }

  TITLES.payments = function () { return { title: t('navPayments'), sub: t('paymentsSub') }; };
  VIEWS.payments = function () {
    var f = ui.payFilter;
    var rows = paymentRows();
    var total = rows.reduce(function (s, r) { return s + L.toPaisa(r.payment.amount); }, 0);
    var h = '<div class="toolbar">' + searchBox('payments', t('searchPayments')) +
      '<button class="btn btn-primary" data-act="new-payment">' + icon('plus') + esc(t('recordPayment')) + '</button></div>';
    h += '<div class="form-grid two" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      '<div class="field"><label for="pfMonth">' + esc(t('forMonth')) + '</label><select class="select" id="pfMonth" data-filter="payments"><option value="">' + esc(t('allMonths')) + '</option>' +
      monthsWithData().map(function (mk) { return '<option value="' + mk + '"' + (f.month === mk ? ' selected' : '') + '>' + esc(monthLabelKey(mk)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pfCust">' + esc(t('customer')) + '</label><select class="select" id="pfCust" data-filter="payments"><option value="">' + esc(t('allCustomers')) + '</option>' +
      state.meta.customers.map(function (c) { return '<option value="' + c.id + '"' + (f.cid === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pfKind">' + esc(t('type')) + '</label><select class="select" id="pfKind" data-filter="payments"><option value="">' + esc(t('allTypes')) + '</option>' +
      '<option value="advance"' + (f.kind === 'advance' ? ' selected' : '') + '>' + esc(t('kindAdvance')) + '</option><option value="bill"' + (f.kind === 'bill' ? ' selected' : '') + '>' + esc(t('kindBill')) + '</option></select></div>' +
      '</div>';
    var filtered = f.month || f.cid || f.kind || ui.search.payments;
    h += '<div class="row-between"><span class="muted" style="font-size:14px">' + esc(t('paymentsCount', { n: rows.length, a: money(total) })) + '</span>' +
      (filtered ? '<button class="link" data-act="clear-pay-filters">' + esc(t('clearFilters')) + '</button>' : '') + '</div>';
    h += '<section class="card">' + paymentsTable(pageSlice('payments', rows), false) + pager('payments', rows.length) + '</section>';
    return h;
  };

  ACT['clear-pay-filters'] = function () { ui.payFilter = { month: '', cid: '', kind: '' }; ui.search.payments = ''; ui.page.payments = 1; render(); };
  ACT['new-payment'] = function (el) {
    var ym = el.dataset.mk ? Cal.parseKey(el.dataset.mk) : thisMonth();
    paymentDialog({ cid: el.dataset.cid || '', month: Cal.monthKey(ym.y, ym.m) });
  };
  ACT['edit-payment'] = function (el) {
    var found = L.findPayment(state, el.dataset.pid);
    if (found) paymentDialog({ pid: found.payment.id });
  };
  ACT['del-payment'] = function (el) { deletePayment(el.dataset.pid); };

  function deletePayment(pid) {
    var found = L.findPayment(state, pid);
    if (!found) return;
    confirmDialog({
      title: t('deletePaymentTitle', { amt: money(L.toPaisa(found.payment.amount)) }),
      text: t('deletePaymentText', { name: customerName(found.payment.cid) }),
      yes: t('deleteYes'),
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      L.deletePayment(state, found.month, pid);
      persist([found.month]);
      toast(t('paymentDeleted'));
      render();
    });
  }

  // Record or edit a payment / advance.
  function paymentDialog(o) {
    var found = o.pid ? L.findPayment(state, o.pid) : null;
    var p = found ? found.payment : null;
    var list = state.meta.customers;
    if (!list.length) { toast(t('noCustomersTitle'), 'error'); return; }
    var cid = p ? p.cid : (o.cid || '');
    var sel = Cal.parseKey(found ? found.month : o.month);
    var kind = p ? p.kind : 'advance';
    var opts = '<option value="">' + esc(t('chooseCustomer')) + '</option>' + list.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    function dueHint() {
      var c = $('payCust').value;
      var box = $('payDue');
      if (!c) { box.innerHTML = ''; return; }
      var b = L.monthBill(state, c, sel.y, sel.m);
      box.innerHTML = b.toPayPaisa > 0
        ? '<div class="calc-line"><span>' + esc(t('dueFor', { month: monthLabel(sel.y, sel.m) })) + '</span><span class="row"><b>' + esc(money(b.toPayPaisa)) + '</b>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="pay-use-due" data-v="' + (b.toPayPaisa / 100) + '">' + esc(t('useAmount')) + '</button></span></div>'
        : '<p class="hint">' + esc(t('nothingDue', { month: monthLabel(sel.y, sel.m) })) + '</p>';
    }

    Dialog.open(
      dialogHead(p ? t('editPayment') : t('recordPayment')) +
      '<form class="form" data-form="payment" novalidate>' +
      '<div class="field" id="wrap-payCust"><label for="payCust">' + esc(t('customer')) + '</label><select class="select" id="payCust">' + opts + '</select><p class="field-error" id="err-payCust" hidden></p></div>' +
      '<div class="field"><span class="label">' + esc(t('forMonth')) + '</span><div class="monthbar">' +
      '<button type="button" class="icon-btn" data-act="pay-month" data-delta="-1" aria-label="' + esc(t('prevMonth')) + '">' + icon('left') + '</button>' +
      '<div class="month-main" id="payMonth">' + esc(monthLabel(sel.y, sel.m)) + '</div>' +
      '<button type="button" class="icon-btn" data-act="pay-month" data-delta="1" aria-label="' + esc(t('nextMonth')) + '">' + icon('right') + '</button></div></div>' +
      '<div id="payDue"></div>' +
      '<div class="field" id="wrap-payAmt"><label for="payAmt">' + esc(t('amountReceived')) + '</label><div class="input-unit prefix"><span class="unit">' + esc(t('rs')) + '</span>' +
      '<input class="input" id="payAmt" inputmode="decimal" autocomplete="off" value="' + (p ? esc(p.amount) : '') + '"></div><p class="field-error" id="err-payAmt" hidden></p></div>' +
      '<div class="field"><span class="label">' + esc(t('type')) + '</span><div class="seg" role="group">' +
      '<button type="button" data-act="pay-kind" data-v="advance" aria-pressed="' + (kind === 'advance') + '">' + esc(t('kindAdvance')) + '</button>' +
      '<button type="button" data-act="pay-kind" data-v="bill" aria-pressed="' + (kind === 'bill') + '">' + esc(t('kindBill')) + '</button></div></div>' +
      '<div class="field"><label for="payNote">' + esc(t('note')) + ' <span class="optional">(' + esc(t('optional')) + ')</span></label><input class="input" id="payNote" maxlength="80" autocomplete="off" value="' + (p ? esc(p.note) : '') + '"></div>' +
      (p ? '<p class="hint">' + esc(t('recordedOn', { date: fmtDate(p.date) })) + '</p>' : '') +
      '<div class="form-actions">' +
      (p ? '<button class="btn btn-danger-outline btn-lg" type="button" data-act="pay-delete">' + icon('trash') + esc(t('delete')) + '</button>' : '') +
      '<button class="btn btn-secondary btn-lg" type="button" data-act="dialog-close">' + esc(t('cancel')) + '</button>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(t('savePayment')) + '</button></div></form>',
      {
        change: function (el) { if (el.id === 'payCust') dueHint(); },
        handlers: {
          'pay-month': function (el) {
            var n = Cal.addMonths(sel.y, sel.m, +el.dataset.delta);
            sel = { y: n.y, m: n.m, d: 1 };
            $('payMonth').textContent = monthLabel(sel.y, sel.m);
            dueHint();
          },
          'pay-kind': function (el) {
            kind = el.dataset.v;
            Array.prototype.forEach.call(Dialog.el.querySelectorAll('[data-act="pay-kind"]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === kind)); });
          },
          'pay-use-due': function (el) { $('payAmt').value = el.dataset.v; },
          'pay-delete': function () { Dialog.close().then(function () { deletePayment(p.id); }); }
        },
        forms: {
          payment: function (form) {
            clearFieldErrors(form);
            var c = $('payCust').value;
            var v = L.parseNumber($('payAmt').value);
            var bad = false;
            if (!c) { $('wrap-payCust').classList.add('invalid'); $('err-payCust').textContent = t('chooseCustomerErr'); $('err-payCust').hidden = false; bad = true; }
            if (!isFinite(v) || v <= 0 || v > 10000000) { $('wrap-payAmt').classList.add('invalid'); $('err-payAmt').textContent = t('amountInvalid'); $('err-payAmt').hidden = false; bad = true; }
            if (bad) return;
            var mk = Cal.monthKey(sel.y, sel.m);
            var parts;
            if (p) parts = L.updatePayment(state, p.id, { month: mk, amount: v, note: $('payNote').value, cid: c, kind: kind });
            else { L.addPayment(state, c, mk, v, dkey(todayBs()), $('payNote').value, kind); parts = [mk]; }
            if (p) p.kind = kind;
            persist(parts);
            Dialog.close().then(function () {
              toast(t('paymentSaved', { amt: money(L.toPaisa(v)), name: customerName(c) }));
              render();
            });
          }
        }
      }
    );
    dueHint();
  }

  // Bills

  TITLES.bills = function () { return { title: t('navBills'), sub: monthLabel(ui.billMonth.y, ui.billMonth.m) }; };
  VIEWS.bills = function () {
    var bm = ui.billMonth;
    var h = monthBar(bm.y, bm.m, 'bills-month', 'bills-month-pick');
    if (!state.meta.customers.length) return h + noCustomersCard();
    var rep = L.monthReport(state, bm.y, bm.m);
    var tot = rep.totals;
    h += '<div class="metrics three">' + metric(t('sales'), money(tot.paisa), '', litres(tot.litres)) +
      metric(t('received'), money(tot.paid), 'is-good') +
      metric(t('pending'), money(tot.toPay), tot.toPay > 0 ? 'is-pending' : '', t('unpaidCount', { n: tot.dueCount })) + '</div>';
    var counts = { all: rep.rows.length, due: 0, paid: 0, none: 0 };
    rep.rows.forEach(function (r) { var st = r.bill.status === 'advance' ? 'paid' : r.bill.status; if (counts[st] !== undefined) counts[st]++; });
    var billable = rep.rows.length - counts.none;
    if (IS_NATIVE && billable) {
      h += '<div class="stack-tight"><button class="btn btn-secondary btn-lg btn-block" data-act="bills-save-all"' + (ui.savingBills ? ' disabled' : '') + '>' +
        icon('download') + esc(t('saveAllBills', { n: billable, month: monthLabel(bm.y, bm.m) })) + '</button>' +
        '<p class="hint">' + icon('folder') + ' ' + esc(t('savesTo', { folder: Platform.folder + '/' + Platform.folders.bills + '/' + monthFolder(bm.y, bm.m) })) + '</p></div>';
    }
    h += '<div class="toolbar">' + searchBox('bills') + '</div>' +
      '<div class="seg" role="group" aria-label="' + esc(t('show')) + '">' +
      [['all', t('allN', { n: counts.all })], ['due', t('unpaidN', { n: counts.due })], ['paid', t('paidN', { n: counts.paid })], ['none', t('noMilkN', { n: counts.none })]].map(function (f) {
        return '<button data-act="bill-filter" data-v="' + f[0] + '" aria-pressed="' + (ui.billFilter === f[0]) + '">' + esc(f[1]) + '</button>';
      }).join('') + '</div>';
    h += '<section class="card" id="listWrap">' + billsListHtml(rep) + '</section>';
    return h;
  };

  function billsListHtml(rep) {
    var q = ui.search.bills.trim();
    var rows = rep.rows.filter(function (r) {
      var st = r.bill.status === 'advance' ? 'paid' : r.bill.status;
      return (ui.billFilter === 'all' || st === ui.billFilter) && matches(r.customer, q);
    });
    if (!rows.length) return '<p class="list-empty">' + esc(t('noMatch')) + '</p>';
    if (ui.wide) {
      return '<div class="table-wrap"><table class="table"><thead><tr><th>' + esc(t('customer')) + '</th><th class="r">' + esc(t('milk')) + '</th><th class="r">' + esc(t('amount')) + '</th>' +
        '<th class="r">' + esc(t('paidCol')) + '</th><th class="r">' + esc(t('toPay')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var b = r.bill;
          return '<tr class="clickable" data-act="open-bill" data-cid="' + r.customer.id + '" data-mk="' + rep.monthKey + '"><td class="strong">' + esc(r.customer.name) + '</td>' +
            '<td class="r">' + esc(litres(b.litres)) + '</td><td class="r">' + esc(money(b.paisa)) + '</td><td class="r">' + esc(money(b.paidPaisa)) + '</td>' +
            '<td class="r strong">' + esc(money(b.toPayPaisa)) + '</td><td>' + badge(b.status) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td>' + esc(t('total')) + '</td><td class="r">' + esc(litres(sum(rows, 'litres'))) + '</td><td class="r">' + esc(money(sum(rows, 'paisa'))) + '</td>' +
        '<td class="r">' + esc(money(sum(rows, 'paidPaisa'))) + '</td><td class="r">' + esc(money(sum(rows, 'toPayPaisa'))) + '</td><td></td></tr></tfoot></table></div>';
    }
    return '<ul class="list">' + rows.map(function (r) {
      var b = r.bill;
      return '<li><button class="list-row" data-act="open-bill" data-cid="' + r.customer.id + '" data-mk="' + rep.monthKey + '">' +
        '<span class="primary">' + esc(r.customer.name) + '</span><span class="secondary">' + esc(litres(b.litres)) + ' · ' + esc(money(b.paisa)) + '</span>' +
        '<span class="end">' + badge(b.status) + (b.toPayPaisa > 0 ? '<span class="amount">' + esc(money(b.toPayPaisa)) + '</span>' : '') + '</span></button></li>';
    }).join('') + '</ul>';
  }
  function sum(rows, key) {
    var s = rows.reduce(function (a, r) { return a + r.bill[key]; }, 0);
    return key === 'litres' ? L.roundLitre(s) : s;
  }

  ACT['bills-month'] = function (el) { ui.billMonth = Cal.addMonths(ui.billMonth.y, ui.billMonth.m, +el.dataset.delta); render(); };
  ACT['bills-month-pick'] = function () { pickMonth(ui.billMonth).then(function (ym) { if (ym) { ui.billMonth = ym; render(); } }); };
  ACT['bill-filter'] = function (el) { ui.billFilter = el.dataset.v; render(); };

  // Saves every customer's bill for the month, one picture each, in Bills/<month folder>.
  ACT['bills-save-all'] = function () {
    if (ui.savingBills) return;
    var bm = ui.billMonth;
    var mk = Cal.monthKey(bm.y, bm.m);
    var rows = L.monthReport(state, bm.y, bm.m).rows.filter(function (r) { return r.bill.status !== 'none'; });
    if (!rows.length) return;
    var folder = monthFolder(bm.y, bm.m);
    var done = 0, where = '', today = todayBs();
    ui.savingBills = true;
    render();
    toast(t('savingBills', { i: 0, n: rows.length }));
    imageReady(logoImg).then(function () {
      return rows.reduce(function (p, r) {
        return p.then(function () {
          var bill = L.monthBill(state, r.customer.id, bm.y, bm.m, { includeOldDue: !!ui.includeOld[r.customer.id + '|' + mk] });
          return BillImage.toBlob(BillImage.drawBill(bill, r.customer, state.meta.settings, logoImg, today)).then(function (blob) {
            return Platform.saveFile('bills', folder + '/' + billFileName(r.customer, bm.y, bm.m), blob, 'image/png');
          }).then(function (res) {
            if (res.ok) { done++; where = res.where || where; }
          }, function () {}).then(function () {
            toast(t('savingBills', { i: done, n: rows.length }));
          });
        });
      }, Promise.resolve());
    }).then(function () {
      ui.savingBills = false;
      render();
      if (done === rows.length) toast(t('billsSavedAll', { n: done, folder: where }));
      else toast(t('billsSavedSome', { done: done, n: rows.length }), 'error');
    });
  };

  // One customer's bill

  function billFor(p) {
    var c = L.findCustomer(state, p.id);
    if (!c) return null;
    var ym = Cal.parseKey(p.mk);
    var key = c.id + '|' + p.mk;
    return { c: c, ym: ym, key: key, b: L.monthBill(state, c.id, ym.y, ym.m, { includeOldDue: !!ui.includeOld[key] }) };
  }

  TITLES.bill = function (p) { var c = L.findCustomer(state, p.id); var ym = Cal.parseKey(p.mk); return { title: c ? c.name : '', sub: t('billFor', { month: monthLabel(ym.y, ym.m) }) }; };
  VIEWS.bill = function (p) {
    var x = billFor(p);
    if (!x) return goneHtml();
    var b = x.b;
    var rates = b.rates.length ? b.rates : [x.c.rate];
    var h = monthBar(x.ym.y, x.ym.m, 'bill-month', 'bill-month-pick');
    h += '<div class="grid-2" style="align-items:start"><div class="stack">';
    h += '<section class="card">' + cardHead(t('summary')) + '<div class="card-body"><dl class="kv">' +
      '<div><dt>' + esc(t('totalMilk')) + '</dt><dd>' + esc(litres(b.litres)) + ' · ' + esc(t('daysN', { n: b.daysWithMilk })) + '</dd></div>' +
      '<div><dt>' + esc(t('price')) + '</dt><dd>' + esc(rates.map(function (r) { return rateText(r); }).join(' / ')) + '</dd></div>' +
      '<div><dt>' + esc(t('milkAmount')) + '</dt><dd>' + esc(money(b.paisa)) + '</dd></div>' +
      (b.oldAdvancePaisa > 0 ? '<div><dt>' + esc(t('advanceEarlier')) + '</dt><dd>− ' + esc(money(b.oldAdvancePaisa)) + '</dd></div>' : '') +
      (b.paidPaisa > 0 ? '<div><dt>' + esc(t('paidThisMonth')) + '</dt><dd>− ' + esc(money(b.paidPaisa)) + '</dd></div>' : '') +
      (b.includeOldDue ? '<div><dt>' + esc(t('oldUnpaid')) + '</dt><dd>+ ' + esc(money(b.oldDuePaisa)) + '</dd></div>' : '') +
      '<div class="total' + (b.toPayPaisa > 0 ? ' due' : '') + '"><dt>' + esc(t('amountToPay')) + '</dt><dd>' + esc(money(b.toPayPaisa)) + '</dd></div>' +
      '</dl>' +
      '<div class="row-between"><span class="muted" style="font-size:14px">' + esc(t('status')) + '</span>' + badge(b.status) + '</div>' +
      (b.advanceLeftPaisa > 0 ? '<div class="alert alert-info">' + icon('info') + '<span>' + esc(t('advanceLeft', { amt: money(b.advanceLeftPaisa) })) + '</span></div>' : '') +
      (b.oldDuePaisa > 0 ? '<label class="check-line"><input type="checkbox" id="incOld" data-key="' + esc(x.key) + '"' + (b.includeOldDue ? ' checked' : '') + '><span>' + esc(t('includeOld', { amt: money(b.oldDuePaisa) })) + '</span></label>' : '') +
      '</div></section>';
    var payBtns = [];
    var billPays = b.payments.filter(function (q) { return q.kind === 'bill'; });
    if (b.toPayPaisa > 0) payBtns.push('<button class="btn btn-primary btn-lg" data-act="mark-paid">' + icon('check') + esc(t('markPaid')) + '</button>');
    else if (billPays.length) payBtns.push('<button class="btn btn-secondary btn-lg" data-act="undo-paid">' + esc(t('undoPaid')) + '</button>');
    payBtns.push('<button class="btn btn-secondary btn-lg" data-act="new-payment" data-cid="' + x.c.id + '" data-mk="' + p.mk + '">' + icon('wallet') + esc(t('recordPayment')) + '</button>');
    h += '<section class="card">' + cardHead(t('billActions')) + '<div class="card-body">' +
      '<div class="toolbar"><button class="btn btn-primary btn-lg" data-act="bill-save" id="dlBtn" disabled>' + icon('download') + esc(IS_NATIVE ? t('saveBillPhone') : t('saveBill')) + '</button>' +
      (ui.canShare ? '<button class="btn btn-secondary btn-lg" data-act="bill-share" id="shBtn" disabled>' + icon('share') + esc(t('shareBill')) + '</button>' : '') + '</div>' +
      (IS_NATIVE ? '<p class="hint">' + icon('folder') + ' ' + esc(t('savesTo', { folder: Platform.folder + '/' + Platform.folders.bills + '/' + monthFolder(x.ym.y, x.ym.m) })) + '</p>' : '') +
      '<div class="toolbar">' + payBtns.join('') + '</div></div></section>';
    h += '</div><section class="card">' + cardHead(t('billPreview')) + '<div class="card-body"><div class="bill-preview" id="billPreview">' + esc(t('makingBill')) + '</div></div></section></div>';
    return h;
  };

  function imageReady(img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) { img.onload = img.onerror = function () { resolve(); }; setTimeout(resolve, 3000); });
  }

  AFTER.bill = function (p) {
    var token = ++ui.bill.token;
    ui.bill.blob = null;
    imageReady(logoImg).then(function () {
      if (token !== ui.bill.token) return null;
      var x = billFor(p);
      if (!x) return null;
      var canvas = BillImage.drawBill(x.b, x.c, state.meta.settings, logoImg, todayBs());
      ui.bill.name = billFileName(x.c, x.ym.y, x.ym.m);
      ui.bill.folder = monthFolder(x.ym.y, x.ym.m);
      return BillImage.toBlob(canvas);
    }).then(function (blob) {
      if (!blob || token !== ui.bill.token) return;
      if (ui.bill.url) URL.revokeObjectURL(ui.bill.url);
      ui.bill.url = URL.createObjectURL(blob);
      ui.bill.blob = blob;
      var box = $('billPreview');
      if (!box) return;
      box.innerHTML = '<img alt="' + esc(t('billPreview')) + '" src="' + ui.bill.url + '">';
      if ($('dlBtn')) $('dlBtn').disabled = false;
      if ($('shBtn')) $('shBtn').disabled = false;
    }).catch(function () {
      var box = $('billPreview');
      if (box && token === ui.bill.token) box.textContent = t('saveFailed');
    });
  };

  function reportSave(res, okMsg) {
    if (res.ok) toast(res.where ? t('savedTo', { name: res.name, folder: res.where }) : okMsg);
    else toast(res.error === 'permission' ? t('permissionNeeded') : t('saveFailed'), 'error');
    return res.ok;
  }

  ACT['bill-month'] = function (el) {
    var p = Nav.current().params;
    var ym = Cal.parseKey(p.mk);
    var n = Cal.addMonths(ym.y, ym.m, +el.dataset.delta);
    Nav.replace('bill', { id: p.id, mk: Cal.monthKey(n.y, n.m) });
  };
  ACT['bill-month-pick'] = function () {
    var p = Nav.current().params;
    pickMonth(Cal.parseKey(p.mk)).then(function (ym) { if (ym) Nav.replace('bill', { id: p.id, mk: Cal.monthKey(ym.y, ym.m) }); });
  };
  ACT['bill-save'] = function () {
    if (!ui.bill.blob) return;
    Platform.saveFile('bills', ui.bill.folder + '/' + ui.bill.name, ui.bill.blob, 'image/png').then(function (r) { reportSave(r, t('billSaved')); });
  };
  ACT['bill-share'] = function () {
    if (!ui.bill.blob) return;
    Platform.shareFile(ui.bill.name, ui.bill.blob, 'image/png', ui.bill.name).catch(function () { toast(t('shareFail'), 'error'); });
  };
  ACT['mark-paid'] = function () {
    var p = Nav.current().params;
    var x = billFor(p);
    if (!x || x.b.toPayPaisa <= 0) return;
    confirmDialog({ title: t('markPaidTitle', { amt: money(x.b.toPayPaisa), name: x.c.name }), text: t('markPaidText'), yes: t('markPaidYes') }).then(function (ok) {
      if (!ok) return;
      L.addPayment(state, x.c.id, p.mk, x.b.toPayPaisa / 100, dkey(todayBs()), '', 'bill');
      persist([p.mk]);
      toast(t('paidDone'));
      render();
    });
  };
  ACT['undo-paid'] = function () {
    var p = Nav.current().params;
    var x = billFor(p);
    if (!x) return;
    var billPays = x.b.payments.filter(function (q) { return q.kind === 'bill'; });
    var last = billPays[billPays.length - 1];
    if (!last) return;
    confirmDialog({ title: t('undoPaidTitle'), text: t('undoPaidText', { amt: money(L.toPaisa(last.amount)) }), yes: t('undoPaid'), danger: true }).then(function (ok) {
      if (!ok) return;
      L.deletePayment(state, p.mk, last.id);
      persist([p.mk]);
      toast(t('undone'));
      render();
    });
  };

  // Records (milk entries log)

  function recordRows() {
    var rm = ui.recMonth;
    var rows = L.listEntries(state, { monthKey: Cal.monthKey(rm.y, rm.m), cid: ui.recFilter.cid || null });
    var q = ui.search.records.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return customerName(r.cid).toLowerCase().indexOf(q) > -1; });
    var s = ui.sort.records;
    if (s.key === 'amount') rows.sort(function (a, b) { return (a.paisa - b.paisa) * s.dir; });
    else if (s.key === 'litres') rows.sort(function (a, b) { return (a.litres - b.litres) * s.dir; });
    else if (s.dir > 0) rows.reverse();
    return rows;
  }

  TITLES.records = function () { return { title: t('navRecords'), sub: t('recordsSub') }; };
  VIEWS.records = function () {
    var rm = ui.recMonth;
    var rows = recordRows();
    var totL = L.roundLitre(rows.reduce(function (s, r) { return s + r.litres; }, 0));
    var totP = rows.reduce(function (s, r) { return s + r.paisa; }, 0);
    var h = monthBar(rm.y, rm.m, 'rec-month', 'rec-month-pick');
    h += '<div class="toolbar">' + searchBox('records') +
      '<select class="select" id="rfCust" data-filter="records" style="flex:1 1 160px;min-width:0" aria-label="' + esc(t('customer')) + '"><option value="">' + esc(t('allCustomers')) + '</option>' +
      state.meta.customers.map(function (c) { return '<option value="' + c.id + '"' + (ui.recFilter.cid === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-primary" data-act="new-entry">' + icon('plus') + esc(t('addEntry')) + '</button></div>';
    h += '<div class="row-between"><span class="muted" style="font-size:14px">' + esc(t('entriesCount', { n: rows.length, l: litres(totL), a: money(totP) })) + '</span>' +
      (ui.recFilter.cid || ui.search.records ? '<button class="link" data-act="clear-rec-filters">' + esc(t('clearFilters')) + '</button>' : '') + '</div>';
    var page = pageSlice('records', rows);
    h += '<section class="card">';
    if (!rows.length) h += emptyState('list', t('noEntries'), t('noEntriesText', { month: monthLabel(rm.y, rm.m) }));
    else if (ui.wide) {
      h += '<div class="table-wrap"><table class="table"><thead><tr>' + sortHead('records', 'date', t('date')) + '<th>' + esc(t('day')) + '</th><th>' + esc(t('customer')) + '</th>' +
        sortHead('records', 'litres', t('milk'), true) + '<th class="r">' + esc(t('price')) + '</th>' + sortHead('records', 'amount', t('amount'), true) +
        '<th class="r"><span class="sr-only">' + esc(t('actions')) + '</span></th></tr></thead><tbody>' +
        page.map(function (r) {
          return '<tr><td class="nowrap">' + Cal.format(r.y, r.m, r.d) + '</td><td class="muted">' + esc(WEEK_SHORT[lang][Cal.weekday(r.y, r.m, r.d)]) + '</td>' +
            '<td class="strong">' + esc(customerName(r.cid)) + '</td><td class="r">' + esc(litres(r.litres)) + '</td><td class="r">' + esc(rateText(r.rate)) + '</td>' +
            '<td class="r strong">' + esc(money(r.paisa)) + '</td><td><div class="row-actions">' +
            '<button class="icon-btn" data-act="edit-entry" data-cid="' + r.cid + '" data-date="' + r.key + '" aria-label="' + esc(t('edit')) + '">' + icon('edit') + '</button>' +
            '<button class="icon-btn danger" data-act="del-entry" data-cid="' + r.cid + '" data-date="' + r.key + '" aria-label="' + esc(t('delete')) + '">' + icon('trash') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      h += '<ul class="list">' + page.map(function (r) {
        return '<li><button class="list-row" data-act="edit-entry" data-cid="' + r.cid + '" data-date="' + r.key + '">' +
          '<span class="primary">' + esc(customerName(r.cid)) + '</span>' +
          '<span class="secondary">' + Cal.format(r.y, r.m, r.d) + ' · ' + esc(WEEK_SHORT[lang][Cal.weekday(r.y, r.m, r.d)]) + ' · ' + esc(rateText(r.rate)) + '</span>' +
          '<span class="end"><span class="amount">' + esc(litres(r.litres)) + '</span><span class="faint" style="font-size:13px">' + esc(money(r.paisa)) + '</span></span></button></li>';
      }).join('') + '</ul>';
    }
    h += pager('records', rows.length) + '</section>';
    return h;
  };

  ACT['rec-month'] = function (el) { ui.recMonth = Cal.addMonths(ui.recMonth.y, ui.recMonth.m, +el.dataset.delta); ui.page.records = 1; render(); };
  ACT['rec-month-pick'] = function () { pickMonth(ui.recMonth).then(function (ym) { if (ym) { ui.recMonth = ym; ui.page.records = 1; render(); } }); };
  ACT['clear-rec-filters'] = function () { ui.recFilter.cid = ''; ui.search.records = ''; ui.page.records = 1; render(); };
  ACT['new-entry'] = function () { entryFormDialog({ cid: ui.recFilter.cid || null }); };
  ACT['edit-entry'] = function (el) {
    var d = Cal.parseKey(el.dataset.date);
    entryFormDialog({ cid: el.dataset.cid, date: d, edit: true });
  };
  ACT['del-entry'] = function (el) {
    var d = Cal.parseKey(el.dataset.date);
    var c = L.findCustomer(state, el.dataset.cid);
    var e = c && L.getEntry(state, d.y, d.m, d.d, c.id);
    if (!e) return;
    confirmDialog({ title: t('deleteEntryTitle'), text: t('deleteEntryText', { name: c.name, date: Cal.format(d.y, d.m, d.d), l: litres(e.litres) }), yes: t('deleteYes'), danger: true }).then(function (ok) {
      if (!ok) return;
      persist([L.clearEntry(state, d.y, d.m, d.d, c.id)]);
      toast(t('entryRemoved'));
      render();
    });
  };

  // Reports

  TITLES.reports = function () { return { title: t('navReports'), sub: monthLabel(ui.reportMonth.y, ui.reportMonth.m) }; };
  VIEWS.reports = function () {
    var rm = ui.reportMonth;
    var rep = L.monthReport(state, rm.y, rm.m);
    var tot = rep.totals;
    var h = monthBar(rm.y, rm.m, 'report-month', 'report-month-pick');
    h += '<div class="metrics four">' + metric(t('milk'), litres(tot.litres)) + metric(t('sales'), money(tot.paisa)) +
      metric(t('received'), money(tot.paid), 'is-good') + metric(t('pending'), money(tot.toPay), tot.toPay > 0 ? 'is-pending' : '') + '</div>';
    h += '<div class="toolbar"><button class="btn btn-primary" data-act="report-image">' + icon('download') + esc(t('saveReportImage')) + '</button>' +
      '<button class="btn btn-secondary" data-act="report-csv">' + icon('list') + esc(t('saveExcel')) + '</button></div>';
    if (IS_NATIVE) h += '<p class="hint muted" style="font-size:13px">' + esc(t('savesTo', { folder: Platform.folder + '/Reports' })) + '</p>';
    h += '<section class="card">' + cardHead(t('byCustomer'));
    if (!rep.rows.length) h += '<p class="list-empty">' + esc(t('noRecords')) + '</p>';
    else if (ui.wide) {
      h += '<div class="table-wrap"><table class="table"><thead><tr><th>' + esc(t('customer')) + '</th><th class="r">' + esc(t('days')) + '</th><th class="r">' + esc(t('milk')) + '</th><th class="r">' + esc(t('amount')) + '</th><th class="r">' + esc(t('paidCol')) + '</th><th class="r">' + esc(t('toPay')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        rep.rows.map(function (r) {
          var b = r.bill;
          return '<tr class="clickable" data-act="open-bill" data-cid="' + r.customer.id + '" data-mk="' + rep.monthKey + '"><td class="strong">' + esc(r.customer.name) + '</td><td class="r">' + b.daysWithMilk + '</td>' +
            '<td class="r">' + esc(litres(b.litres)) + '</td><td class="r">' + esc(money(b.paisa)) + '</td><td class="r">' + esc(money(b.paidPaisa)) + '</td><td class="r strong">' + esc(money(b.toPayPaisa)) + '</td><td>' + badge(b.status) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td>' + esc(t('total')) + '</td><td></td><td class="r">' + esc(litres(tot.litres)) + '</td><td class="r">' + esc(money(tot.paisa)) + '</td><td class="r">' + esc(money(tot.paid)) + '</td><td class="r">' + esc(money(tot.toPay)) + '</td><td></td></tr></tfoot></table></div>';
    } else {
      h += '<ul class="list">' + rep.rows.map(function (r) {
        var b = r.bill;
        return '<li><button class="list-row" data-act="open-bill" data-cid="' + r.customer.id + '" data-mk="' + rep.monthKey + '"><span class="primary">' + esc(r.customer.name) + '</span>' +
          '<span class="secondary">' + esc(litres(b.litres)) + ' · ' + esc(money(b.paisa)) + ' · ' + esc(t('paidCol')) + ' ' + esc(money(b.paidPaisa)) + '</span>' +
          '<span class="end">' + badge(b.status) + (b.toPayPaisa > 0 ? '<span class="amount">' + esc(money(b.toPayPaisa)) + '</span>' : '') + '</span></button></li>';
      }).join('') + '</ul>';
    }
    return h + '</section>';
  };

  ACT['report-month'] = function (el) { ui.reportMonth = Cal.addMonths(ui.reportMonth.y, ui.reportMonth.m, +el.dataset.delta); render(); };
  ACT['report-month-pick'] = function () { pickMonth(ui.reportMonth).then(function (ym) { if (ym) { ui.reportMonth = ym; render(); } }); };
  ACT['report-image'] = function () {
    var rm = ui.reportMonth;
    imageReady(logoImg).then(function () {
      return BillImage.toBlob(BillImage.drawReport(L.monthReport(state, rm.y, rm.m), rm.y, rm.m, state.meta.settings, logoImg, todayBs()));
    }).then(function (blob) {
      return Platform.saveFile('reports', 'Report-' + Cal.monthName(rm.m, 'en') + '-' + rm.y + '.png', blob, 'image/png');
    }).then(function (r) { reportSave(r, t('saved')); }, function () { toast(t('saveFailed'), 'error'); });
  };
  ACT['report-csv'] = function () {
    var rm = ui.reportMonth;
    Platform.saveFile('reports', 'Milk-sheet-' + Cal.monthName(rm.m, 'en') + '-' + rm.y + '.csv', L.monthCsv(state, rm.y, rm.m), 'text/csv')
      .then(function (r) { reportSave(r, t('saved')); });
  };

  // More (phones)

  TITLES.more = function () { return { title: t('navMore'), sub: '' }; };
  VIEWS.more = function () {
    var rows = [
      ['payments', 'wallet', t('navPayments'), t('paymentsSub')],
      ['records', 'list', t('navRecords'), t('recordsSub')],
      ['reports', 'chart', t('navReports'), t('reportsSub')],
      ['settings', 'gear', t('navSettings'), t('settingsSub')]
    ];
    return alertsHtml() + '<section class="card"><ul class="list">' + rows.map(function (r) {
      return '<li><button class="menu-row" data-act="open-section" data-v="' + r[0] + '">' + icon(r[1]) +
        '<span class="txt"><b>' + esc(r[2]) + '</b><span>' + esc(r[3]) + '</span></span>' + icon('right', 'chev') + '</button></li>';
    }).join('') + '</ul></section>' + backupStatusCard();
  };
  ACT['open-section'] = function (el) { Nav.push(el.dataset.v, {}); };

  // Settings

  // inSettings: Settings shows every folder in its own card below, so the path is left out here.
  function backupStatusCard(inSettings) {
    var s = state.meta.settings;
    var auto = Store.Local.getFlag('autoBackupAt');
    var h = '<section class="card">' + cardHead(t('backup')) + '<div class="card-body">';
    if (IS_NATIVE) {
      h += '<div class="alert alert-info">' + icon('folder') + '<span>' + esc(t('protectionNote')) + '</span></div>' +
        (Store.Local.getFlag('autoBackupFailed') === '1' ? '<div class="alert alert-danger">' + icon('alert') + '<span>' + esc(t('autoBackupFailed')) + '</span></div>' : '') +
        '<dl class="kv"><div><dt>' + esc(t('lastSaved')) + '</dt><dd>' + esc(whenText(state.meta.savedAt)) + '</dd></div>' +
        '<div><dt>' + esc(t('lastAutoBackup')) + '</dt><dd>' + esc(whenText(auto)) + '</dd></div></dl>' +
        (inSettings ? '' : pathBlock(t('pathBackups'), Platform.folders.backups));
    } else {
      h += '<p class="muted" style="font-size:14px">' + esc(t('backupHelp')) + '</p><dl class="kv"><div><dt>' + esc(t('lastBackupManual')) + '</dt><dd>' + esc(whenText(s.lastBackupAt)) + '</dd></div></dl>';
    }
    h += '<div class="toolbar"><button class="btn btn-primary" data-act="backup-save">' + icon('save') + esc(t('saveBackup')) + '</button>' +
      (ui.canShare ? '<button class="btn btn-secondary" data-act="backup-share">' + icon('share') + esc(t('shareBackup')) + '</button>' : '') +
      (IS_NATIVE ? '<button class="btn btn-secondary" data-act="backup-copies">' + icon('calendar') + esc(t('earlierCopies')) + '</button>' : '') +
      '<button class="btn btn-secondary" data-act="backup-restore">' + icon('upload') + esc(t('restore')) + '</button></div></div></section>';
    return h;
  }

  // A folder on the phone written the way the Files app shows it.
  function pathBlock(label, sub) {
    return '<div class="path"><span class="path-label">' + esc(label) + '</span>' +
      '<span class="path-value">' + ['Internal storage', 'Documents', Platform.folderName, sub].map(esc).join(' <span aria-hidden="true">›</span> ') + '</span></div>';
  }

  // Settings (phone app): where every file is, so the shop can find and copy them.
  function filesCard() {
    var today = todayBs();
    var folder = monthFolder(today.y, today.m);
    return '<section class="card">' + cardHead(t('whereFiles')) + '<div class="card-body">' +
      pathBlock(t('pathBackups'), Platform.folders.backups) +
      pathBlock(t('pathBills'), Platform.folders.bills) +
      pathBlock(t('pathReports'), Platform.folders.reports) +
      '<div class="alert alert-info">' + icon('search') + '<span>' + esc(t('searchTip')) + '</span></div>' +
      '<p class="hint">' + esc(t('monthFolderNote', { folder: folder })) + '</p>' +
      '<p class="file-group">' + esc(t('pathBackups')) + ' › ' + esc(folder) + '</p>' +
      '<ul class="file-notes">' +
      '<li><b>' + esc(monthBackupName(today.y, today.m)) + '</b><span>' + esc(t('backupFileNote')) + '</span></li>' +
      '<li><b>' + esc(monthSheetName(today.y, today.m)) + '</b><span>' + esc(t('sheetFileNote')) + '</span></li>' +
      '</ul>' +
      '<p class="file-group">' + esc(t('pathBills')) + ' › ' + esc(folder) + '</p>' +
      '<ul class="file-notes"><li><span>' + esc(t('billsFolderNote')) + '</span></li></ul></div></section>';
  }

  // Android: pick one of the earlier copies kept on the phone.
  ACT['backup-copies'] = function () {
    Dialog.open(dialogHead(t('earlierCopies'), t('earlierCopiesHelp')) + '<div id="copiesList" class="list-empty">' + esc(t('loadingCopies')) + '</div>', {
      handlers: {
        'copy-pick': function (el) {
          var entry = ui.copies && ui.copies[+el.dataset.i];
          if (!entry) return;
          Platform.readCopy(entry).then(function (txt) {
            Dialog.close().then(function () { restoreFromText(txt); });
          }, function () { toast(t('saveFailed'), 'error'); });
        }
      }
    });
    Platform.listCopies().then(function (copies) {
      ui.copies = copies;
      var box = $('copiesList');
      if (!box) return;
      if (!copies.length) { box.textContent = t('noCopies'); return; }
      box.className = '';
      box.innerHTML = '<ul class="list" style="border:1px solid var(--border);border-radius:8px">' + copies.map(function (c, i) {
        var when = c.mtime ? new Date(c.mtime) : null;
        var bs = when ? Cal.fromAD(when) : null;
        var label = bs ? Cal.format(bs.y, bs.m, bs.d) + ' ' + ('0' + when.getHours()).slice(-2) + ':' + ('0' + when.getMinutes()).slice(-2) : c.name;
        return '<li><button class="list-row" data-act="copy-pick" data-i="' + i + '"><span class="primary">' + esc(label) + '</span>' +
          '<span class="secondary">' + esc(c.source === 'app' ? t('copyApp') : t('copyFolder')) + ' · ' + esc(Math.max(1, Math.round(c.size / 1024))) + ' KB</span>' +
          '<span class="end">' + icon('right', 'chev') + '</span></button></li>';
      }).join('') + '</ul>';
    });
  };

  TITLES.settings = function () { return { title: t('navSettings'), sub: t('settingsSub') }; };
  VIEWS.settings = function () {
    var s = state.meta.settings;
    var h = '<section class="card">' + cardHead(t('shop')) + '<form class="card-body form" data-form="settings" novalidate>' +
      '<div class="form-grid two">' +
      field('s-name', t('shopName'), '<input class="input" id="s-name" maxlength="60" placeholder="' + esc(t('shopNamePh')) + '" value="' + esc(s.shopName) + '">') +
      field('s-phone', t('shopPhone'), '<input class="input" id="s-phone" type="tel" inputmode="tel" maxlength="40" value="' + esc(s.shopPhone) + '">', true) +
      '</div>' +
      field('s-address', t('shopAddress'), '<input class="input" id="s-address" maxlength="120" value="' + esc(s.shopAddress) + '">', true, t('shopAddressHint')) +
      '<div class="form-grid two">' +
      field('s-rate', t('defaultRate'), '<div class="input-unit"><input class="input" id="s-rate" inputmode="decimal" value="' + esc(s.defaultRate) + '"><span class="unit">' + esc(t('rs')) + '/' + esc(t('L')) + '</span></div>') +
      field('s-usual', t('defaultUsual'), '<div class="input-unit"><input class="input" id="s-usual" inputmode="decimal" value="' + esc(L.formatLitre(s.defaultUsual)) + '"><span class="unit">' + esc(t('L')) + '</span></div>') +
      '</div>' +
      '<div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">' + esc(t('saveChanges')) + '</button></div>' +
      '</form></section>';

    h += '<section class="card">' + cardHead(t('language')) + '<div class="card-body"><div class="seg" role="group">' +
      '<button data-act="set-lang" data-lang="en" aria-pressed="' + (lang === 'en') + '">English</button>' +
      '<button data-act="set-lang" data-lang="ne" aria-pressed="' + (lang === 'ne') + '">नेपाली</button></div>' +
      '<p class="hint">' + esc(t('billsEnglish')) + '</p></div></section>';

    h += backupStatusCard(true);
    if (IS_NATIVE) h += filesCard();

    h += '<section class="card">' + cardHead(t('aboutApp')) + '<div class="card-body">' +
      '<div class="about-logo"><img src="' + esc(LOGO) + '" alt="" width="72" height="72"><b>' + esc(t('appName')) + '</b></div><dl class="kv kv-wide">' +
      '<div><dt>' + esc(t('version')) + '</dt><dd>' + APP_VERSION + '</dd></div>' +
      '<div><dt>' + esc(t('developedBy')) + '</dt><dd>' + esc(DEVELOPER) + '</dd></div></dl></div></section>';

    if (!IS_NATIVE) {
      h += '<section class="card">' + cardHead(t('install')) + '<div class="card-body">' +
        (isStandalone() ? '<p class="muted">' + esc(t('installed')) + '</p>'
          : ui.installEvent ? '<button class="btn btn-primary" data-act="install">' + icon('download') + esc(t('installBtn')) + '</button>'
            : '<p class="muted" style="font-size:14px">' + esc(t('installHelp')) + '</p>') + '</div></section>';
    }
    return h;
  };

  FORMS.settings = function (form) {
    clearFieldErrors(form);
    var rate = L.parseNumber($('s-rate').value);
    var usual = L.parseNumber($('s-usual').value);
    if (!isFinite(rate) || rate <= 0 || rate > 100000) { showFieldError('s-rate', t('rateInvalid')); return; }
    if (!isFinite(usual) || usual < 0 || usual > 500) { showFieldError('s-usual', t('usualInvalid')); return; }
    var s = state.meta.settings;
    s.shopName = $('s-name').value.replace(/\s+/g, ' ').trim().slice(0, 60);
    s.shopAddress = $('s-address').value.replace(/\s+/g, ' ').trim().slice(0, 120);
    s.shopPhone = $('s-phone').value.replace(/\s+/g, ' ').trim().slice(0, 40);
    s.defaultRate = Math.round(rate * 100) / 100;
    s.defaultUsual = L.roundLitre(usual);
    persist(['meta']);
    toast(t('settingsSaved'));
    render();
  };

  ACT['set-lang'] = function (el) {
    lang = el.dataset.lang === 'ne' ? 'ne' : 'en';
    state.meta.settings.lang = lang;
    document.documentElement.lang = lang;
    persist(['meta']);
    render();
  };
  ACT.install = function () {
    var ev = ui.installEvent;
    if (!ev) return;
    ev.prompt();
    ev.userChoice.then(function () { ui.installEvent = null; render(); }, function () {});
  };

  function markBackedUp() {
    state.meta.settings.lastBackupAt = new Date().toISOString();
    persist(['meta']);
    render();
  }
  ACT['backup-save'] = function () {
    if (IS_NATIVE) {
      // On the phone this writes the month's folder in Backups straight away.
      runAutoBackup().then(function (r) {
        if (reportSave(r || { ok: false, error: 'failed' }, t('backupSaved'))) markBackedUp();
      });
      return;
    }
    Platform.saveFile('backups', backupName(), backupJson(), 'application/json').then(function (r) {
      if (reportSave(r, t('backupSaved'))) markBackedUp();
    });
  };
  ACT['backup-share'] = function () {
    var today = todayBs();
    var name = IS_NATIVE ? monthBackupName(today.y, today.m) : backupName();
    Platform.shareFile(name, backupJson(), 'application/json', name).then(function (ok) { if (ok) markBackedUp(); }, function () { toast(t('shareFail'), 'error'); });
  };
  ACT['backup-restore'] = function () {
    var input = $('restoreInput');
    input.value = '';
    input.click();
  };

  function readFileText(file) {
    if (file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  function handleRestoreFile(file) {
    if (!file) return;
    readFileText(file).then(restoreFromText, function () { toast(t('badFile'), 'error'); });
  }

  // Shows what a backup holds, asks, keeps a copy of the current records, then replaces them.
  function restoreFromText(txt) {
    var parsed;
    try { parsed = L.parseBackup(JSON.parse(txt)); } catch (e) { toast(t('badFile'), 'error'); return; }
    var saved = parsed.meta.savedAt ? whenText(parsed.meta.savedAt) : '';
    confirmDialog({
      title: t('restoreTitle'),
      text: t('restoreText', { c: parsed.meta.customers.length, m: Object.keys(parsed.months).length }) +
        (saved ? ' ' + t('restoreSavedAt', { when: saved }) : '') + (IS_NATIVE ? ' ' + t('restoreKeepsCopy') : ''),
      yes: t('restoreYes'),
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var now = new Date();
      var before = IS_NATIVE && state.meta.customers.length
        ? Platform.writeSnapshot(dkey(todayBs()) + '-before-restore-' + ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2), backupJson())
        : Promise.resolve();
      before.then(function () {
        try { state = normalizeState(Store.replaceAll(parsed)); } catch (e) { toast(t('storageFull'), 'error'); return; }
        lang = state.meta.settings.lang === 'ne' ? 'ne' : 'en';
        document.documentElement.lang = lang;
        ui.includeOld = {};
        ui.custMonth = {};
        persist(['meta']);
        if (IS_NATIVE) flushCopies();
        toast(t('restored'));
        Nav.tab('home');
      });
    });
  }

  // ---------- frame ----------

  function activeNavKey() {
    for (var i = Nav.stack.length - 1; i >= 0; i--) {
      var v = Nav.stack[i].view;
      if (NAV.some(function (n) { return n.key === v; })) return v;
    }
    return Nav.stack[0].view;
  }

  function renderChrome(top, view) {
    var deep = Nav.stack.length > 1;
    var info = TITLES[view] ? TITLES[view](top.params || {}) : { title: t('appName'), sub: '' };
    $('backBtn').hidden = !deep;
    $('backBtn').setAttribute('aria-label', t('back'));
    $('brandMark').hidden = deep;
    $('pageTitle').textContent = info.title;
    $('pageSub').textContent = info.sub || '';
    $('pageSub').hidden = !info.sub;
    $('topActions').innerHTML = info.actions || '';
    document.title = info.title === t('appName') ? info.title : info.title + ' · ' + t('appName');
    var navKey = activeNavKey();
    $('sideNav').innerHTML = NAV.map(function (n, i) {
      return (i === 4 ? '<div class="nav-sep"></div>' : '') +
        '<button class="nav-item" data-tab="' + n.key + '"' + (n.key === navKey ? ' aria-current="page"' : '') + '>' + icon(n.icon) + '<span>' + esc(t(n.label)) + '</span></button>';
    }).join('');
    var root = Nav.stack[0].view;
    var tabKey = TABS.some(function (x) { return x.key === root; }) ? root : 'more';
    $('tabbar').innerHTML = TABS.map(function (n) {
      return '<button class="tab" data-tab="' + n.key + '"' + (n.key === tabKey ? ' aria-current="page"' : '') + '>' + icon(n.icon) + '<span>' + esc(t(n.label)) + '</span></button>';
    }).join('');
    var d = todayBs();
    $('sideFoot').textContent = t('today') + ': ' + Cal.format(d.y, d.m, d.d) + ' · v' + APP_VERSION;
    $('brandSub').textContent = t('brandSub');
  }

  function errorHtml() {
    return '<section class="card">' + emptyState('alert', t('errorTitle'), t('errorText')) + '</section>';
  }

  function isWide() { return !!(wideQuery && wideQuery.matches) || window.innerWidth >= 900; }

  function render() {
    if (!state) return;
    ui.wide = isWide();
    var top = Nav.current();
    var view = VIEWS[top.view] ? top.view : 'home';
    var html;
    try { html = VIEWS[view](top.params || {}); } catch (e) { if (window.console) console.error(e); html = errorHtml(); }
    $view.innerHTML = html;
    renderChrome(top, view);
    if (AFTER[view]) { try { AFTER[view](top.params || {}); } catch (e) { if (window.console) console.error(e); } }
  }

  ACT.back = function () { Nav.back(); };
  ACT['dialog-close'] = function () { Dialog.close(); };

  function onClick(e) {
    var tabEl = e.target.closest('[data-tab]');
    if (tabEl) { Nav.tab(tabEl.dataset.tab); return; }
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.dataset.act;
    try {
      var h = Dialog.el && Dialog.el.contains(el) && Dialog.opts && Dialog.opts.handlers && Dialog.opts.handlers[act];
      if (h) { h(el, e); return; }
      if (ACT[act]) ACT[act](el, e);
    } catch (err) {
      if (window.console) console.error(err);
      toast(t('errorTitle'), 'error');
    }
  }

  function onSubmit(e) {
    var form = e.target;
    e.preventDefault();
    var name = form.dataset && form.dataset.form;
    if (!name) return;
    try {
      var h = Dialog.el && Dialog.el.contains(form) && Dialog.opts && Dialog.opts.forms && Dialog.opts.forms[name];
      if (h) { h(form); return; }
      if (FORMS[name]) FORMS[name](form);
    } catch (err) {
      if (window.console) console.error(err);
      toast(t('errorTitle'), 'error');
    }
  }

  function onInput(e) {
    var el = e.target;
    if (Dialog.el && Dialog.el.contains(el) && Dialog.opts && Dialog.opts.input) { Dialog.opts.input(el); return; }
    var key = el.dataset && el.dataset.search;
    if (key) {
      ui.search[key] = el.value;
      if (key === 'milk' && $('list')) { $('list').innerHTML = milkListHtml(); return; }
      if (key === 'customers' && $('listWrap')) { $('listWrap').innerHTML = customersListHtml(); return; }
      if (key === 'bills' && $('listWrap')) { $('listWrap').innerHTML = billsListHtml(L.monthReport(state, ui.billMonth.y, ui.billMonth.m)); return; }
      if (key === 'records' || key === 'payments') {
        ui.page[key] = 1;
        clearTimeout(onInput.timer);
        onInput.timer = setTimeout(function () {
          render();
          var box = document.querySelector('[data-search="' + key + '"]');
          if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        }, 250);
      }
      return;
    }
    if (el.id === 'f-usual') syncUsualChips();
  }

  function onChange(e) {
    var el = e.target;
    if (Dialog.el && Dialog.el.contains(el) && Dialog.opts && Dialog.opts.change) { Dialog.opts.change(el); return; }
    if (el.id === 'incOld') { ui.includeOld[el.dataset.key] = el.checked; render(); return; }
    if (el.id === 'restoreInput') { handleRestoreFile(el.files && el.files[0]); return; }
    if (el.dataset && el.dataset.filter === 'payments') {
      ui.payFilter = { month: $('pfMonth').value, cid: $('pfCust').value, kind: $('pfKind').value };
      ui.page.payments = 1;
      render();
      return;
    }
    if (el.dataset && el.dataset.filter === 'records') {
      ui.recFilter.cid = el.value;
      ui.page.records = 1;
      render();
    }
  }

  function normalizeState(s) {
    var def = L.defaultSettings();
    s.meta = s.meta && typeof s.meta === 'object' ? s.meta : {};
    var cur = s.meta.settings && typeof s.meta.settings === 'object' ? s.meta.settings : {};
    Object.keys(def).forEach(function (k) { if (cur[k] === undefined || cur[k] === null) cur[k] = def[k]; });
    s.meta.settings = cur;
    s.meta.v = s.meta.v || L.VERSION;
    s.meta.customers = Array.isArray(s.meta.customers) ? s.meta.customers.filter(function (c) {
      return c && typeof c.id === 'string' && typeof c.name === 'string';
    }) : [];
    s.meta.customers.forEach(function (c) {
      if (!isFinite(c.rate) || c.rate <= 0) c.rate = cur.defaultRate;
      if (!isFinite(c.usual) || c.usual < 0) c.usual = 0;
      c.address = c.address || '';
      c.phone = c.phone || '';
      c.createdAt = c.createdAt || new Date().toISOString();
    });
    s.months = s.months && typeof s.months === 'object' ? s.months : {};
    Object.keys(s.months).forEach(function (mk) {
      var m = s.months[mk];
      if (!m || typeof m !== 'object') { delete s.months[mk]; return; }
      if (!m.days || typeof m.days !== 'object') m.days = {};
      if (!Array.isArray(m.pays)) m.pays = [];
    });
    return s;
  }

  function onVisible() {
    if (!state) return;
    var nowKey = dkey(todayBs());
    if (nowKey !== ui.lastToday) {
      if (dkey(ui.date) === ui.lastToday) ui.date = todayBs();
      ui.lastToday = nowKey;
      if (!Dialog.isOpen()) render();
    }
  }

  function registerServiceWorker() {
    if (IS_NATIVE || !('serviceWorker' in navigator)) return;
    var h = location.hostname;
    if (location.protocol !== 'https:' && h !== 'localhost' && h !== '127.0.0.1') return;
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // The opening screen (the shop logo) stays until the first page is ready, and at least
  // a moment so it does not just flash. In the phone app, Android's own opening screen shows
  // the logo instead and waits for DMS_READY, so the page's copy is simply removed.
  function hideOpening() {
    var el = $('boot');
    if (IS_NATIVE) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      window.DMS_READY = true;
      return;
    }
    if (!el) return;
    var shown = window.performance && performance.now ? performance.now() : 700;
    setTimeout(function () {
      el.classList.add('done');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, Math.max(0, 700 - shown));
  }

  // While the phone keyboard is open, hide the bottom tabs and keep the box being typed in visible.
  function watchKeyboard() {
    var root = document.documentElement, tallest = 0, width = 0;
    var typing = function () {
      var el = document.activeElement;
      return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|file|submit)$/.test(el.type)));
    };
    var check = function () {
      var h = window.innerHeight, w = window.innerWidth;
      if (w !== width) { width = w; tallest = h; }
      tallest = Math.max(tallest, h);
      var open = typing() && h < tallest * 0.8;
      if (open === root.classList.contains('kbd-open')) return;
      root.classList.toggle('kbd-open', open);
      if (open) setTimeout(function () {
        var el = document.activeElement;
        if (el && el.scrollIntoView && typing()) el.scrollIntoView({ block: 'center' });
      }, 60);
    };
    window.addEventListener('resize', check);
    document.addEventListener('focusin', function () { setTimeout(check, 300); });
    document.addEventListener('focusout', function () { setTimeout(check, 100); });
    check();
  }

  function boot() {
    $view = $('view');
    $toast = $('toastRoot');
    $dialogRoot = $('dialogRoot');
    ui.canShare = Platform.canShare();
    $('brandMark').src = LOGO;

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && Dialog.isOpen()) Dialog.close(); });
    // Keep the screen at a fixed size (iPhone Safari ignores the page setting for pinch zoom).
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') onVisible();
      else if (IS_NATIVE) flushCopies();
    });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ui.installEvent = e; if (state && !Dialog.isOpen()) render(); });
    window.addEventListener('appinstalled', function () { ui.installEvent = null; });
    var onWide = function () { if (state && !Dialog.isOpen() && isWide() !== ui.wide) render(); };
    if (wideQuery && wideQuery.addEventListener) wideQuery.addEventListener('change', onWide);
    window.addEventListener('resize', function () { clearTimeout(onWide.timer); onWide.timer = setTimeout(onWide, 150); });
    watchKeyboard();

    if (IS_NATIVE) {
      Platform.onBackButton(function () {
        if (Dialog.isOpen()) { Dialog.close(); return; }
        if (Nav.stack.length > 1) { Nav.back(); return; }
        if (Nav.stack[0].view !== 'home') { Nav.tab('home'); return; }
        flushCopies().then(function () { Platform.exitApp(); });
      });
      Platform.onResume(onVisible);
    }

    Store.init(L.emptyState).then(function (res) {
      state = normalizeState(res.state);
      lang = state.meta.settings.lang === 'ne' ? 'ne' : 'en';
      document.documentElement.lang = lang;
      ui.billMonth = thisMonth();
      ui.reportMonth = thisMonth();
      ui.recMonth = thisMonth();
      ui.date = todayBs();
      ui.lastToday = dkey(ui.date);
      // First start with month folders: give every month that has records its milk sheet.
      if (IS_NATIVE && !Store.Local.getFlag('monthFolders.v1')) {
        Object.keys(state.months || {}).forEach(function (k) { changedMonths[k] = true; });
        Store.Local.setFlag('monthFolders.v1', '1');
      }
      return reconcileWithSafeCopy();
    }).then(function (usedSafeCopy) {
      lang = state.meta.settings.lang === 'ne' ? 'ne' : 'en';
      document.documentElement.lang = lang;
      Nav.init();
      render();
      hideOpening();
      if (usedSafeCopy) toast(t('safeRestored'));
      if (IS_NATIVE) setTimeout(flushCopies, 3000);
    }).catch(function () {
      $view.innerHTML = errorHtml();
      hideOpening();
    });

    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
