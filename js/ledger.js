/*
 * Ledger: all milk-account data and calculations for Milk Bill Management.
 * Pure functions on a plain state object, so they can be tested in Node.
 *
 * state = {
 *   meta:   { v, settings, customers: [...] },
 *   months: { '2083-06': { days: { '19': { <customerId>: [litres, rate] } },
 *                           pays: [ { id, cid, amount, date, note, kind } ] } }
 * }
 * Money is calculated in paisa (integers) so totals never drift.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./nepali-calendar.js'));
  else root.Ledger = factory(root.NepaliCalendar);
})(typeof self !== 'undefined' ? self : this, function (Cal) {
  'use strict';

  var VERSION = 1;
  var APP_ID = 'MilkBillManagement';
  var MONTH_KEY_RE = /^\d{4}-\d{2}$/;

  function defaultSettings() {
    return {
      shopName: '',
      shopAddress: '',
      shopPhone: '',
      defaultRate: 150,
      defaultUsual: 1,
      lang: 'en',
      lastBackupAt: ''
    };
  }

  function emptyState() {
    return { meta: { v: VERSION, savedAt: '', settings: defaultSettings(), customers: [] }, months: {} };
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- numbers ----------

  function roundLitre(x) { return Math.round(x * 100) / 100; }
  function toPaisa(rupees) { return Math.round(rupees * 100); }
  function amountPaisa(litres, rate) { return Math.round(litres * rate * 100); }

  function groupIndian(intStr) {
    if (intStr.length <= 3) return intStr;
    var last3 = intStr.slice(-3);
    var rest = intStr.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  // 427500 -> "4,275"   3750 -> "37.50"   12345678 -> "1,23,456.78"
  function formatMoney(paisa) {
    var neg = paisa < 0;
    var p = Math.abs(Math.round(paisa));
    var rupees = Math.floor(p / 100);
    var cents = p % 100;
    var s = groupIndian(String(rupees)) + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '');
    return (neg ? '-' : '') + s;
  }

  // 1 -> "1"   1.5 -> "1.5"   0.25 -> "0.25"
  function formatLitre(l) {
    if (l === null || l === undefined) return '';
    return String(roundLitre(l));
  }

  function parseNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    var s = v.trim().replace(/,/g, '')
      .replace(/[०-९]/g, function (ch) { return String(ch.charCodeAt(0) - 0x0966); })
      .replace(/।/g, '.');
    if (!s || !/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    return parseFloat(s);
  }

  // ---------- customers ----------

  function cleanText(v, max) {
    return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  }

  // Validates customer form input. Returns { ok, value } or { ok:false, field, error }.
  function validateCustomer(input, settings) {
    var name = cleanText(input.name, 60);
    if (!name) return { ok: false, field: 'name', error: 'nameRequired' };
    var rate = parseNumber(input.rate === undefined || input.rate === '' ? String(settings.defaultRate) : input.rate);
    if (!isFinite(rate) || rate <= 0 || rate > 100000) return { ok: false, field: 'rate', error: 'rateInvalid' };
    var usual = parseNumber(input.usual === undefined || input.usual === '' ? '0' : input.usual);
    if (!isFinite(usual) || usual < 0 || usual > 500) return { ok: false, field: 'usual', error: 'usualInvalid' };
    var phone = cleanText(input.phone, 30);
    if (phone && !/^[0-9+\-() ]{5,30}$/.test(phone)) return { ok: false, field: 'phone', error: 'phoneInvalid' };
    return {
      ok: true,
      value: {
        name: name,
        address: typeof input.address === 'string' ? input.address.trim().slice(0, 200) : '',
        phone: phone,
        rate: Math.round(rate * 100) / 100,
        usual: roundLitre(usual)
      }
    };
  }

  function findCustomer(state, id) {
    var list = state.meta.customers;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function nameExists(state, name, exceptId) {
    var n = cleanText(name, 60).toLowerCase();
    return state.meta.customers.some(function (c) { return c.id !== exceptId && c.name.toLowerCase() === n; });
  }

  function addCustomer(state, value) {
    var c = {
      id: uid('c'),
      name: value.name,
      address: value.address || '',
      phone: value.phone || '',
      rate: value.rate,
      usual: value.usual,
      active: true,
      createdAt: new Date().toISOString()
    };
    state.meta.customers.push(c);
    return c;
  }

  function updateCustomer(state, id, value) {
    var c = findCustomer(state, id);
    if (!c) return null;
    c.name = value.name;
    c.address = value.address || '';
    c.phone = value.phone || '';
    c.rate = value.rate;
    c.usual = value.usual;
    return c;
  }

  // Removes the customer and every record of them. Returns the month keys that changed.
  function deleteCustomer(state, id) {
    state.meta.customers = state.meta.customers.filter(function (c) { return c.id !== id; });
    var dirty = [];
    Object.keys(state.months).forEach(function (mk) {
      var month = state.months[mk];
      var changed = false;
      Object.keys(month.days).forEach(function (dd) {
        if (month.days[dd][id]) {
          delete month.days[dd][id];
          changed = true;
          if (!Object.keys(month.days[dd]).length) delete month.days[dd];
        }
      });
      var before = month.pays.length;
      month.pays = month.pays.filter(function (p) { return p.cid !== id; });
      if (month.pays.length !== before) changed = true;
      if (changed) dirty.push(mk);
    });
    return dirty;
  }

  function moveCustomer(state, id, delta) {
    var list = state.meta.customers;
    var i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === id) i = k;
    var j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return false;
    var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    return true;
  }

  function activeCustomers(state) {
    return state.meta.customers.filter(function (c) { return c.active !== false; });
  }

  // ---------- milk entries ----------

  function getMonth(state, mk, create) {
    var m = state.months[mk];
    if (!m && create) m = state.months[mk] = { days: {}, pays: [] };
    return m || null;
  }

  function getEntry(state, y, m, d, cid) {
    var month = state.months[Cal.monthKey(y, m)];
    var day = month && month.days[Cal.pad2(d)];
    var e = day && day[cid];
    return e ? { litres: e[0], rate: e[1] } : null;
  }

  // Saves litres for one customer on one day. Returns the changed month key.
  function setEntry(state, y, m, d, cid, litres, rate) {
    var mk = Cal.monthKey(y, m);
    var month = getMonth(state, mk, true);
    var dd = Cal.pad2(d);
    if (!month.days[dd]) month.days[dd] = {};
    month.days[dd][cid] = [roundLitre(Math.max(0, litres)), rate];
    return mk;
  }

  function clearEntry(state, y, m, d, cid) {
    var mk = Cal.monthKey(y, m);
    var month = state.months[mk];
    var dd = Cal.pad2(d);
    if (month && month.days[dd]) {
      delete month.days[dd][cid];
      if (!Object.keys(month.days[dd]).length) delete month.days[dd];
    }
    return mk;
  }

  // Gives every active customer with no entry for the day their usual milk.
  function fillUsual(state, y, m, d) {
    var count = 0;
    activeCustomers(state).forEach(function (c) {
      if (c.usual > 0 && !getEntry(state, y, m, d, c.id)) {
        setEntry(state, y, m, d, c.id, c.usual, c.rate);
        count++;
      }
    });
    return { count: count, monthKey: Cal.monthKey(y, m) };
  }

  function pendingUsualCount(state, y, m, d) {
    return activeCustomers(state).filter(function (c) {
      return c.usual > 0 && !getEntry(state, y, m, d, c.id);
    }).length;
  }

  function dayStats(state, y, m, d) {
    var month = state.months[Cal.monthKey(y, m)];
    var day = (month && month.days[Cal.pad2(d)]) || {};
    var litres = 0, paisa = 0, entered = 0;
    activeCustomers(state).forEach(function (c) {
      var e = day[c.id];
      if (e) { entered++; litres += e[0]; paisa += amountPaisa(e[0], e[1]); }
    });
    return { entered: entered, total: activeCustomers(state).length, litres: roundLitre(litres), paisa: paisa };
  }

  // Changes the rate on saved entries from a date onward (fromKey 'YYYY-MM-DD'; null = all records).
  function applyRateFrom(state, cid, rate, fromKey) {
    var dirty = [];
    Object.keys(state.months).forEach(function (mk) {
      var month = state.months[mk];
      var changed = false;
      Object.keys(month.days).forEach(function (dd) {
        var e = month.days[dd][cid];
        if (e && (!fromKey || mk + '-' + dd >= fromKey) && e[1] !== rate) {
          e[1] = rate;
          changed = true;
        }
      });
      if (changed) dirty.push(mk);
    });
    return dirty;
  }

  // ---------- payments / advance ----------

  function addPayment(state, cid, mk, amountRupees, dateKey, note, kind) {
    var month = getMonth(state, mk, true);
    var p = {
      id: uid('p'),
      cid: cid,
      amount: Math.round(amountRupees * 100) / 100,
      date: dateKey,
      note: cleanText(note || '', 80),
      kind: kind || 'advance'
    };
    month.pays.push(p);
    return p;
  }

  function deletePayment(state, mk, pid) {
    var month = state.months[mk];
    if (!month) return false;
    var before = month.pays.length;
    month.pays = month.pays.filter(function (p) { return p.id !== pid; });
    return month.pays.length !== before;
  }

  function paymentsFor(state, cid, mk) {
    var month = state.months[mk];
    return month ? month.pays.filter(function (p) { return p.cid === cid; }) : [];
  }

  function allPaymentsFor(state, cid) {
    var out = [];
    Object.keys(state.months).sort().reverse().forEach(function (mk) {
      paymentsFor(state, cid, mk).slice().reverse().forEach(function (p) {
        out.push({ month: mk, payment: p });
      });
    });
    return out;
  }

  // ---------- bills ----------

  function monthMilk(state, cid, mk) {
    var month = state.months[mk];
    var litres = 0, paisa = 0, days = 0;
    if (month) {
      Object.keys(month.days).forEach(function (dd) {
        var e = month.days[dd][cid];
        if (e) {
          litres += e[0];
          paisa += amountPaisa(e[0], e[1]);
          if (e[0] > 0) days++;
        }
      });
    }
    return { litres: roundLitre(litres), paisa: paisa, days: days };
  }

  function sumPays(list) {
    return list.reduce(function (s, p) { return s + toPaisa(p.amount); }, 0);
  }

  // Milk amount minus payments for all months before mk. Positive = old due, negative = advance left.
  function balanceBefore(state, cid, mk) {
    var bal = 0;
    Object.keys(state.months).forEach(function (k) {
      if (k < mk) {
        bal += monthMilk(state, cid, k).paisa;
        bal -= sumPays(paymentsFor(state, cid, k));
      }
    });
    return bal;
  }

  /*
   * The full bill for one customer and one Nepali month.
   * Advance left over from earlier months is always taken off.
   * Old unpaid amounts are added only when opts.includeOldDue is true.
   */
  function monthBill(state, cid, y, m, opts) {
    opts = opts || {};
    var mk = Cal.monthKey(y, m);
    var n = Cal.daysInMonth(y, m);
    var month = state.months[mk];
    var rows = [];
    var litres = 0, paisa = 0, daysWithMilk = 0;
    var rateSet = {};
    for (var d = 1; d <= n; d++) {
      var dd = Cal.pad2(d);
      var e = month && month.days[dd] && month.days[dd][cid];
      if (e) {
        var p = amountPaisa(e[0], e[1]);
        litres += e[0];
        paisa += p;
        if (e[0] > 0) { daysWithMilk++; rateSet[e[1]] = true; }
        rows.push({ day: d, date: Cal.format(y, m, d), litres: e[0], rate: e[1], paisa: p });
      } else {
        rows.push({ day: d, date: Cal.format(y, m, d), litres: null, rate: null, paisa: 0 });
      }
    }
    var pays = paymentsFor(state, cid, mk);
    var paidPaisa = sumPays(pays);
    var prev = balanceBefore(state, cid, mk);
    var oldDue = prev > 0 ? prev : 0;
    var oldAdvance = prev < 0 ? -prev : 0;
    var includeOld = !!opts.includeOldDue && oldDue > 0;
    var due = paisa - paidPaisa - oldAdvance + (includeOld ? oldDue : 0);
    var status;
    if (paisa === 0 && paidPaisa === 0) status = 'none';
    else if (paisa === 0 && paidPaisa > 0) status = 'advance';
    else if (due <= 0) status = 'paid';
    else status = 'due';
    var rates = Object.keys(rateSet).map(Number).sort(function (a, b) { return a - b; });
    return {
      monthKey: mk,
      y: y,
      m: m,
      days: n,
      rows: rows,
      litres: roundLitre(litres),
      paisa: paisa,
      daysWithMilk: daysWithMilk,
      rates: rates,
      payments: pays,
      paidPaisa: paidPaisa,
      oldDuePaisa: oldDue,
      oldAdvancePaisa: oldAdvance,
      includeOldDue: includeOld,
      toPayPaisa: Math.max(0, due),
      advanceLeftPaisa: Math.max(0, -due),
      status: status
    };
  }

  // Month keys (newest first) in which the customer has milk or payments.
  function customerMonths(state, cid) {
    return Object.keys(state.months).filter(function (mk) {
      var milk = monthMilk(state, cid, mk);
      return milk.paisa > 0 || milk.litres > 0 || paymentsFor(state, cid, mk).length > 0;
    }).sort().reverse();
  }

  // Total unpaid across all months (positive) or advance held (negative).
  function totalBalance(state, cid) {
    var bal = 0;
    Object.keys(state.months).forEach(function (k) {
      bal += monthMilk(state, cid, k).paisa;
      bal -= sumPays(paymentsFor(state, cid, k));
    });
    return bal;
  }

  // One line per customer for a month report. Includes stopped customers only if they have records.
  function monthReport(state, y, m) {
    var mk = Cal.monthKey(y, m);
    var rows = [];
    var tot = { litres: 0, paisa: 0, paid: 0, toPay: 0, dueCount: 0 };
    state.meta.customers.forEach(function (c) {
      var b = monthBill(state, c.id, y, m);
      if (c.active === false && b.status === 'none') return;
      rows.push({ customer: c, bill: b });
      tot.litres += b.litres;
      tot.paisa += b.paisa;
      tot.paid += b.paidPaisa;
      tot.toPay += b.toPayPaisa;
      if (b.status === 'due') tot.dueCount++;
    });
    tot.litres = roundLitre(tot.litres);
    return { monthKey: mk, rows: rows, totals: tot };
  }

  // ---------- records, payments and dashboard ----------

  function customerOrder(state) {
    var order = {};
    state.meta.customers.forEach(function (c, i) { order[c.id] = i; });
    return order;
  }

  // Milk entries, newest day first. opts: { monthKey (null = all months), cid }
  function listEntries(state, opts) {
    opts = opts || {};
    var order = customerOrder(state);
    var rows = [];
    Object.keys(state.months).forEach(function (mk) {
      if (opts.monthKey && mk !== opts.monthKey) return;
      var ym = Cal.parseKey(mk);
      var days = state.months[mk].days;
      Object.keys(days).forEach(function (dd) {
        Object.keys(days[dd]).forEach(function (cid) {
          if (opts.cid && cid !== opts.cid) return;
          if (!(cid in order)) return;
          var e = days[dd][cid];
          rows.push({ key: mk + '-' + dd, y: ym.y, m: ym.m, d: +dd, cid: cid, litres: e[0], rate: e[1], paisa: amountPaisa(e[0], e[1]) });
        });
      });
    });
    rows.sort(function (a, b) {
      if (a.key !== b.key) return a.key < b.key ? 1 : -1;
      return order[a.cid] - order[b.cid];
    });
    return rows;
  }

  // Payments, newest first. opts: { monthKey (null = all), cid, kind }
  function listPayments(state, opts) {
    opts = opts || {};
    var rows = [];
    Object.keys(state.months).forEach(function (mk) {
      if (opts.monthKey && mk !== opts.monthKey) return;
      state.months[mk].pays.forEach(function (p, i) {
        if (opts.cid && p.cid !== opts.cid) return;
        if (opts.kind && p.kind !== opts.kind) return;
        rows.push({ month: mk, payment: p, seq: i });
      });
    });
    rows.sort(function (a, b) {
      if (a.payment.date !== b.payment.date) return a.payment.date < b.payment.date ? 1 : -1;
      if (a.month !== b.month) return a.month < b.month ? 1 : -1;
      return b.seq - a.seq;
    });
    return rows;
  }

  function findPayment(state, pid) {
    var keys = Object.keys(state.months);
    for (var i = 0; i < keys.length; i++) {
      var pays = state.months[keys[i]].pays;
      for (var j = 0; j < pays.length; j++) if (pays[j].id === pid) return { month: keys[i], payment: pays[j] };
    }
    return null;
  }

  // Changes a payment; moves it when its month changes. Returns the changed month keys.
  function updatePayment(state, pid, fields) {
    var found = findPayment(state, pid);
    if (!found) return [];
    var p = found.payment;
    if (fields.amount !== undefined) p.amount = Math.round(fields.amount * 100) / 100;
    if (fields.note !== undefined) p.note = cleanText(fields.note, 80);
    if (fields.date) p.date = fields.date;
    if (fields.cid) p.cid = fields.cid;
    if (fields.month && fields.month !== found.month) {
      deletePayment(state, found.month, pid);
      getMonth(state, fields.month, true).pays.push(p);
      return [found.month, fields.month];
    }
    return [found.month];
  }

  // Litres per day across all customers for one month (index 0 = day 1).
  function monthDailyTotals(state, y, m) {
    var n = Cal.daysInMonth(y, m);
    var month = state.months[Cal.monthKey(y, m)];
    var out = [];
    for (var d = 1; d <= n; d++) {
      var day = month && month.days[Cal.pad2(d)];
      var l = 0;
      if (day) Object.keys(day).forEach(function (cid) { l += day[cid][0]; });
      out.push(roundLitre(l));
    }
    return out;
  }

  // Customers who owe money across all months, largest first.
  function pendingBalances(state) {
    return state.meta.customers.map(function (c) {
      return { customer: c, paisa: totalBalance(state, c.id) };
    }).filter(function (r) { return r.paisa > 0; }).sort(function (a, b) { return b.paisa - a.paisa; });
  }

  // ---------- backup ----------

  function exportBackup(state) {
    return {
      app: APP_ID,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      meta: state.meta,
      months: state.months
    };
  }

  // Checks and cleans a backup file. Throws Error('badFile') if it is not a backup of this app
  // (backups made by earlier builds under another name have the same layout and are accepted).
  function parseBackup(obj) {
    if (!obj || typeof obj !== 'object' || typeof obj.app !== 'string' || typeof obj.version !== 'number' ||
      !obj.meta || !Array.isArray(obj.meta.customers) || (obj.months !== undefined && (typeof obj.months !== 'object' || obj.months === null))) {
      throw new Error('badFile');
    }
    var state = emptyState();
    var s = obj.meta.settings || {};
    var def = defaultSettings();
    state.meta.settings = {
      shopName: cleanText(s.shopName, 60) || def.shopName,
      shopAddress: cleanText(s.shopAddress, 120),
      shopPhone: cleanText(s.shopPhone, 40),
      defaultRate: isFinite(s.defaultRate) && s.defaultRate > 0 ? +s.defaultRate : def.defaultRate,
      defaultUsual: isFinite(s.defaultUsual) && s.defaultUsual >= 0 ? +s.defaultUsual : def.defaultUsual,
      lang: s.lang === 'ne' ? 'ne' : 'en',
      lastBackupAt: typeof s.lastBackupAt === 'string' ? s.lastBackupAt : ''
    };
    state.meta.savedAt = typeof obj.meta.savedAt === 'string' ? obj.meta.savedAt : (typeof obj.exportedAt === 'string' ? obj.exportedAt : '');
    var ids = {};
    obj.meta.customers.forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      var name = cleanText(c.name, 60);
      if (!name) return;
      var id = typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(c.id) && !ids[c.id] ? c.id : uid('c');
      ids[id] = true;
      state.meta.customers.push({
        id: id,
        name: name,
        address: typeof c.address === 'string' ? c.address.trim().slice(0, 200) : '',
        phone: cleanText(c.phone, 30),
        rate: isFinite(c.rate) && c.rate > 0 ? Math.round(c.rate * 100) / 100 : state.meta.settings.defaultRate,
        usual: isFinite(c.usual) && c.usual >= 0 ? roundLitre(+c.usual) : 0,
        active: c.active !== false,
        createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString()
      });
    });
    var months = obj.months && typeof obj.months === 'object' ? obj.months : {};
    Object.keys(months).forEach(function (mk) {
      if (!MONTH_KEY_RE.test(mk)) return;
      var ym = Cal.parseKey(mk);
      if (!Cal.isValid(ym.y, ym.m, 1)) return;
      var n = Cal.daysInMonth(ym.y, ym.m);
      var src = months[mk] || {};
      var out = { days: {}, pays: [] };
      var days = src.days && typeof src.days === 'object' ? src.days : {};
      Object.keys(days).forEach(function (dd) {
        var d = +dd;
        if (!(d >= 1 && d <= n) || Cal.pad2(d) !== dd) return;
        var day = days[dd] || {};
        Object.keys(day).forEach(function (cid) {
          var e = day[cid];
          if (!ids[cid] || !Array.isArray(e)) return;
          var l = +e[0], r = +e[1];
          if (!isFinite(l) || l < 0 || l > 500 || !isFinite(r) || r <= 0) return;
          if (!out.days[dd]) out.days[dd] = {};
          out.days[dd][cid] = [roundLitre(l), r];
        });
      });
      (Array.isArray(src.pays) ? src.pays : []).forEach(function (p) {
        if (!p || !ids[p.cid]) return;
        var amt = +p.amount;
        if (!isFinite(amt) || amt <= 0) return;
        out.pays.push({
          id: typeof p.id === 'string' ? p.id : uid('p'),
          cid: p.cid,
          amount: Math.round(amt * 100) / 100,
          date: typeof p.date === 'string' ? p.date : mk + '-01',
          note: cleanText(p.note || '', 80),
          kind: p.kind === 'bill' ? 'bill' : 'advance'
        });
      });
      if (Object.keys(out.days).length || out.pays.length) state.months[mk] = out;
    });
    return state;
  }

  // ---------- spreadsheet export ----------

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // The month as a sheet: one row per day, one column per customer (opens in Excel).
  function monthCsv(state, y, m) {
    var report = monthReport(state, y, m);
    var cols = report.rows.map(function (r) { return r.customer; });
    var lines = [];
    lines.push([(state.meta.settings.shopName || 'Milk Bill Management') + ' - ' + Cal.monthName(m, 'en') + ' ' + y].map(csvCell).join(','));
    lines.push(['Date', 'Day'].concat(cols.map(function (c) { return c.name + ' (L)'; }), ['Day Total (L)']).map(csvCell).join(','));
    var n = Cal.daysInMonth(y, m);
    for (var d = 1; d <= n; d++) {
      var dayTotal = 0;
      var row = [Cal.format(y, m, d), Cal.dayName(Cal.weekday(y, m, d), 'en')];
      cols.forEach(function (c) {
        var e = getEntry(state, y, m, d, c.id);
        row.push(e ? formatLitre(e.litres) : '');
        if (e) dayTotal += e.litres;
      });
      row.push(formatLitre(roundLitre(dayTotal)));
      lines.push(row.map(csvCell).join(','));
    }
    function summary(label, fn) {
      lines.push([label, ''].concat(report.rows.map(fn)).map(csvCell).join(','));
    }
    summary('Total Litre', function (r) { return formatLitre(r.bill.litres); });
    summary('Rate (Rs/L)', function (r) { return r.bill.rates.join(' / ') || r.customer.rate; });
    summary('Milk Amount (Rs)', function (r) { return (r.bill.paisa / 100).toFixed(2); });
    summary('Advance / Paid (Rs)', function (r) { return (r.bill.paidPaisa / 100).toFixed(2); });
    summary('To Pay (Rs)', function (r) { return (r.bill.toPayPaisa / 100).toFixed(2); });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  return {
    VERSION: VERSION,
    APP_ID: APP_ID,
    defaultSettings: defaultSettings,
    emptyState: emptyState,
    uid: uid,
    roundLitre: roundLitre,
    toPaisa: toPaisa,
    amountPaisa: amountPaisa,
    formatMoney: formatMoney,
    formatLitre: formatLitre,
    parseNumber: parseNumber,
    validateCustomer: validateCustomer,
    findCustomer: findCustomer,
    nameExists: nameExists,
    addCustomer: addCustomer,
    updateCustomer: updateCustomer,
    deleteCustomer: deleteCustomer,
    moveCustomer: moveCustomer,
    activeCustomers: activeCustomers,
    getEntry: getEntry,
    setEntry: setEntry,
    clearEntry: clearEntry,
    fillUsual: fillUsual,
    pendingUsualCount: pendingUsualCount,
    dayStats: dayStats,
    applyRateFrom: applyRateFrom,
    addPayment: addPayment,
    deletePayment: deletePayment,
    paymentsFor: paymentsFor,
    allPaymentsFor: allPaymentsFor,
    monthMilk: monthMilk,
    balanceBefore: balanceBefore,
    monthBill: monthBill,
    customerMonths: customerMonths,
    totalBalance: totalBalance,
    monthReport: monthReport,
    listEntries: listEntries,
    listPayments: listPayments,
    findPayment: findPayment,
    updatePayment: updatePayment,
    monthDailyTotals: monthDailyTotals,
    pendingBalances: pendingBalances,
    exportBackup: exportBackup,
    parseBackup: parseBackup,
    monthCsv: monthCsv
  };
});
