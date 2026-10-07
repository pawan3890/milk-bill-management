// Run with:  node tests/run-tests.js
'use strict';
var assert = require('assert');
var Cal = require('../js/nepali-calendar.js');
var L = require('../js/ledger.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}

console.log('Nepali calendar');

test('known new-year dates', function () {
  [[2080, '2023-04-14'], [2081, '2024-04-13'], [2082, '2025-04-14'], [2083, '2026-04-14']].forEach(function (c) {
    var p = c[1].split('-');
    var bs = Cal.fromAD(new Date(+p[0], +p[1] - 1, +p[2]));
    assert.deepStrictEqual(bs, { y: c[0], m: 1, d: 1 });
  });
});

// First day of every month as printed on Hamro Patro (hamropatro.com), checked 2026-10-05.
var HAMRO_PATRO = {
  2083: ['2026-04-14', '2026-05-15', '2026-06-15', '2026-07-17', '2026-08-17', '2026-09-17', '2026-10-18', '2026-11-17', '2026-12-16', '2027-01-15', '2027-02-13', '2027-03-15'],
  2084: ['2027-04-14', '2027-05-15', '2027-06-15', '2027-07-17', '2027-08-17', '2027-09-17', '2027-10-17', '2027-11-16', '2027-12-16', '2028-01-14', '2028-02-13', '2028-03-14'],
  2085: ['2028-04-13', '2028-05-14', '2028-06-15', '2028-07-16', '2028-08-17', '2028-09-16', '2028-10-17', '2028-11-16', '2028-12-16', '2029-01-14', '2029-02-13', '2029-03-15'],
  2086: ['2029-04-14', '2029-05-14', null, null, null, '2029-09-17', null, null, null, '2030-01-14', null, null],
  2087: ['2030-04-14']
};

test('every month start matches Hamro Patro (2083-2087)', function () {
  Object.keys(HAMRO_PATRO).forEach(function (y) {
    HAMRO_PATRO[y].forEach(function (iso, i) {
      if (!iso) return;
      var p = iso.split('-');
      var bs = Cal.fromAD(new Date(+p[0], +p[1] - 1, +p[2]));
      assert.deepStrictEqual(bs, { y: +y, m: i + 1, d: 1 }, iso + ' should be ' + y + '/' + (i + 1) + '/1');
    });
  });
});

test('2083 Asoj 1 = 2026-09-17, Kartik 1 = 2026-10-18', function () {
  assert.deepStrictEqual(Cal.fromAD(new Date(2026, 8, 17)), { y: 2083, m: 6, d: 1 });
  assert.deepStrictEqual(Cal.fromAD(new Date(2026, 9, 18)), { y: 2083, m: 7, d: 1 });
  assert.strictEqual(Cal.daysInMonth(2083, 6), 31);
});

test('2026-10-05 is 2083/06/19 Monday', function () {
  var bs = Cal.fromAD(new Date(2026, 9, 5));
  assert.strictEqual(Cal.format(bs.y, bs.m, bs.d), '2083/06/19');
  assert.strictEqual(Cal.dayName(Cal.weekday(bs.y, bs.m, bs.d), 'en'), 'Monday');
});

test('every day round-trips 2000-2099', function () {
  for (var y = 2000; y <= 2099; y++) {
    for (var m = 1; m <= 12; m++) {
      var n = Cal.daysInMonth(y, m);
      assert.ok(n >= 29 && n <= 32, 'month length ' + y + '/' + m);
      for (var d = 1; d <= n; d++) {
        var ad = Cal.toAD(y, m, d);
        assert.deepStrictEqual(Cal.fromAD(ad), { y: y, m: m, d: d });
        assert.strictEqual(Cal.weekday(y, m, d), ad.getDay());
      }
    }
  }
});

test('addMonths wraps years', function () {
  assert.deepStrictEqual(Cal.addMonths(2083, 12, 1), { y: 2084, m: 1 });
  assert.deepStrictEqual(Cal.addMonths(2083, 1, -1), { y: 2082, m: 12 });
  assert.deepStrictEqual(Cal.addDays({ y: 2083, m: 6, d: 31 }, 1), { y: 2083, m: 7, d: 1 });
});

console.log('Ledger');

function makeState() {
  var s = L.emptyState();
  var a = L.addCustomer(s, L.validateCustomer({ name: 'Ram Kumar', rate: '150', usual: '1' }, s.meta.settings).value);
  var b = L.addCustomer(s, L.validateCustomer({ name: 'Sita Devi', rate: '180', usual: '0.5' }, s.meta.settings).value);
  return { s: s, a: a, b: b };
}

test('money and litre formatting', function () {
  assert.strictEqual(L.formatMoney(427500), '4,275');
  assert.strictEqual(L.formatMoney(3750), '37.50');
  assert.strictEqual(L.formatMoney(12345678), '1,23,456.78');
  assert.strictEqual(L.formatMoney(0), '0');
  assert.strictEqual(L.formatLitre(1), '1');
  assert.strictEqual(L.formatLitre(1.5), '1.5');
  assert.strictEqual(L.formatLitre(0.25), '0.25');
  assert.strictEqual(L.formatLitre(0.1 + 0.2), '0.3');
});

test('customer validation', function () {
  var st = L.defaultSettings();
  assert.strictEqual(L.validateCustomer({ name: '  ' }, st).error, 'nameRequired');
  assert.strictEqual(L.validateCustomer({ name: 'A', rate: '-5' }, st).error, 'rateInvalid');
  assert.strictEqual(L.validateCustomer({ name: 'A', rate: 'abc' }, st).error, 'rateInvalid');
  assert.strictEqual(L.validateCustomer({ name: 'A', usual: 'x' }, st).error, 'usualInvalid');
  assert.strictEqual(L.validateCustomer({ name: 'A', phone: 'call me' }, st).error, 'phoneInvalid');
  var ok = L.validateCustomer({ name: ' Ram  Bahadur ', phone: '98-41234567', address: 'Ward 4' }, st);
  assert.ok(ok.ok);
  assert.strictEqual(ok.value.name, 'Ram Bahadur');
  assert.strictEqual(ok.value.rate, 150);
});

test('fill usual and day stats', function () {
  var t = makeState();
  assert.strictEqual(L.pendingUsualCount(t.s, 2083, 6, 19), 2);
  var r = L.fillUsual(t.s, 2083, 6, 19);
  assert.strictEqual(r.count, 2);
  assert.strictEqual(L.pendingUsualCount(t.s, 2083, 6, 19), 0);
  var st = L.dayStats(t.s, 2083, 6, 19);
  assert.strictEqual(st.litres, 1.5);
  assert.strictEqual(st.paisa, 15000 + 9000);
  assert.strictEqual(L.fillUsual(t.s, 2083, 6, 19).count, 0, 'never overwrites');
});

test('month bill covers every day of the Nepali month', function () {
  var t = makeState();
  for (var d = 1; d <= 31; d++) L.setEntry(t.s, 2083, 6, d, t.a.id, d % 2 ? 1 : 0.5, 150);
  var b = L.monthBill(t.s, t.a.id, 2083, 6);
  assert.strictEqual(b.rows.length, 31);
  assert.strictEqual(b.rows[0].date, '2083/06/01');
  assert.strictEqual(b.litres, 16 * 1 + 15 * 0.5);
  assert.strictEqual(b.paisa, Math.round(23.5 * 150 * 100));
  assert.strictEqual(b.status, 'due');
  assert.strictEqual(b.toPayPaisa, 352500);
  var k = L.monthBill(t.s, t.a.id, 2083, 7);
  assert.strictEqual(k.rows.length, Cal.daysInMonth(2083, 7));
  assert.strictEqual(k.status, 'none');
});

test('advance is taken off, leftover carries to next month', function () {
  var t = makeState();
  L.addPayment(t.s, t.a.id, '2083-06', 1000, '2083-06-01', '', 'advance');
  for (var d = 1; d <= 4; d++) L.setEntry(t.s, 2083, 6, d, t.a.id, 1, 150);
  var b = L.monthBill(t.s, t.a.id, 2083, 6);
  assert.strictEqual(b.paisa, 60000);
  assert.strictEqual(b.toPayPaisa, 0);
  assert.strictEqual(b.advanceLeftPaisa, 40000);
  assert.strictEqual(b.status, 'paid');
  for (d = 1; d <= 4; d++) L.setEntry(t.s, 2083, 7, d, t.a.id, 1, 150);
  var k = L.monthBill(t.s, t.a.id, 2083, 7);
  assert.strictEqual(k.oldAdvancePaisa, 40000);
  assert.strictEqual(k.toPayPaisa, 20000);
});

test('mark paid clears the month; old due only when asked', function () {
  var t = makeState();
  for (var d = 1; d <= 10; d++) L.setEntry(t.s, 2083, 6, d, t.a.id, 1, 150);
  for (d = 1; d <= 10; d++) L.setEntry(t.s, 2083, 7, d, t.a.id, 1, 150);
  var k = L.monthBill(t.s, t.a.id, 2083, 7);
  assert.strictEqual(k.oldDuePaisa, 150000);
  assert.strictEqual(k.toPayPaisa, 150000, 'old due not added by default');
  var k2 = L.monthBill(t.s, t.a.id, 2083, 7, { includeOldDue: true });
  assert.strictEqual(k2.toPayPaisa, 300000);
  var a = L.monthBill(t.s, t.a.id, 2083, 6);
  L.addPayment(t.s, t.a.id, '2083-06', a.toPayPaisa / 100, '2083-07-02', 'Bill paid', 'bill');
  assert.strictEqual(L.monthBill(t.s, t.a.id, 2083, 6).status, 'paid');
  assert.strictEqual(L.monthBill(t.s, t.a.id, 2083, 7).oldDuePaisa, 0);
  assert.strictEqual(L.totalBalance(t.s, t.a.id), 150000);
});

test('rate change keeps or updates old records as chosen', function () {
  var t = makeState();
  for (var d = 1; d <= 10; d++) L.setEntry(t.s, 2083, 6, d, t.a.id, 1, 150);
  var dirty = L.applyRateFrom(t.s, t.a.id, 160, '2083-06-06');
  assert.deepStrictEqual(dirty, ['2083-06']);
  var b = L.monthBill(t.s, t.a.id, 2083, 6);
  assert.deepStrictEqual(b.rates, [150, 160]);
  assert.strictEqual(b.paisa, 5 * 15000 + 5 * 16000);
  L.applyRateFrom(t.s, t.a.id, 170, null);
  assert.strictEqual(L.monthBill(t.s, t.a.id, 2083, 6).paisa, 10 * 17000);
});

test('fractional litres stay exact in paisa', function () {
  var t = makeState();
  L.setEntry(t.s, 2083, 6, 1, t.a.id, 0.25, 150);
  L.setEntry(t.s, 2083, 6, 2, t.a.id, 0.75, 150);
  L.setEntry(t.s, 2083, 6, 3, t.a.id, 0.1, 155);
  var b = L.monthBill(t.s, t.a.id, 2083, 6);
  assert.strictEqual(b.litres, 1.1);
  assert.strictEqual(b.paisa, 3750 + 11250 + 1550);
});

test('delete customer removes their records only', function () {
  var t = makeState();
  L.setEntry(t.s, 2083, 6, 1, t.a.id, 1, 150);
  L.setEntry(t.s, 2083, 6, 1, t.b.id, 1, 180);
  L.addPayment(t.s, t.a.id, '2083-06', 100, '2083-06-01', '', 'advance');
  var dirty = L.deleteCustomer(t.s, t.a.id);
  assert.deepStrictEqual(dirty, ['2083-06']);
  assert.strictEqual(t.s.meta.customers.length, 1);
  assert.strictEqual(L.getEntry(t.s, 2083, 6, 1, t.b.id).litres, 1);
  assert.strictEqual(t.s.months['2083-06'].pays.length, 0);
});

test('backup round trip and bad files', function () {
  var t = makeState();
  L.setEntry(t.s, 2083, 6, 1, t.a.id, 1.5, 150);
  L.addPayment(t.s, t.b.id, '2083-06', 500, '2083-06-03', 'cash', 'advance');
  var json = JSON.parse(JSON.stringify(L.exportBackup(t.s)));
  var back = L.parseBackup(json);
  assert.deepStrictEqual(back.meta.customers, t.s.meta.customers);
  assert.deepStrictEqual(back.months, t.s.months);
  assert.throws(function () { L.parseBackup({ hello: 1 }); }, /badFile/);
  assert.throws(function () { L.parseBackup(null); }, /badFile/);
  json.months['2083-06'].days['40'] = { x: [1, 1] };
  json.months['2083-06'].days['02'] = { unknown: [1, 150] };
  json.months['9999-99'] = { days: {} };
  var cleaned = L.parseBackup(json);
  assert.ok(!cleaned.months['2083-06'].days['40']);
  assert.ok(!cleaned.months['2083-06'].days['02']);
  assert.ok(!cleaned.months['9999-99']);
});

test('records, payments and dashboard helpers', function () {
  var t = makeState();
  L.setEntry(t.s, 2083, 6, 1, t.a.id, 1, 150);
  L.setEntry(t.s, 2083, 6, 2, t.a.id, 2, 150);
  L.setEntry(t.s, 2083, 6, 2, t.b.id, 0.5, 180);
  L.setEntry(t.s, 2083, 7, 1, t.b.id, 1, 180);
  var june = L.listEntries(t.s, { monthKey: '2083-06' });
  assert.deepStrictEqual(june.map(function (r) { return r.key + ':' + r.cid; }),
    ['2083-06-02:' + t.a.id, '2083-06-02:' + t.b.id, '2083-06-01:' + t.a.id]);
  assert.strictEqual(L.listEntries(t.s, {}).length, 4);
  assert.strictEqual(L.listEntries(t.s, { cid: t.b.id }).length, 2);
  var p1 = L.addPayment(t.s, t.a.id, '2083-06', 100, '2083-06-03', 'x', 'advance');
  L.addPayment(t.s, t.b.id, '2083-07', 50, '2083-07-02', '', 'bill');
  var pays = L.listPayments(t.s, {});
  assert.strictEqual(pays[0].payment.date, '2083-07-02');
  assert.strictEqual(L.listPayments(t.s, { kind: 'advance' }).length, 1);
  var dirty = L.updatePayment(t.s, p1.id, { month: '2083-07', amount: 120 });
  assert.deepStrictEqual(dirty, ['2083-06', '2083-07']);
  assert.strictEqual(L.findPayment(t.s, p1.id).month, '2083-07');
  assert.strictEqual(L.findPayment(t.s, p1.id).payment.amount, 120);
  var daily = L.monthDailyTotals(t.s, 2083, 6);
  assert.strictEqual(daily.length, 31);
  assert.strictEqual(daily[1], 2.5);
  var pend = L.pendingBalances(t.s);
  assert.strictEqual(pend[0].customer.id, t.a.id);
  assert.strictEqual(pend[0].paisa, 45000 - 12000);
});

test('month csv has a row per day', function () {
  var t = makeState();
  L.setEntry(t.s, 2083, 6, 1, t.a.id, 1, 150);
  var csv = L.monthCsv(t.s, 2083, 6);
  var lines = csv.trim().split('\r\n');
  assert.strictEqual(lines.length, 2 + 31 + 5);
  assert.ok(lines[1].indexOf('Ram Kumar (L)') > -1);
  assert.ok(lines[2].indexOf('2083/06/01') === 0);
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ', SOME FAILED' : ''));
