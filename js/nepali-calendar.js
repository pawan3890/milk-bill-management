/*
 * Nepali (Bikram Sambat) calendar for Milk Bill Management.
 * Month lengths for BS 2000-2099. Years up to 2083 agree across all major calendar libraries;
 * 2083-2086 were checked month by month against Hamro Patro (hamropatro.com), and
 * 2084-2090 use the bikram-sambat library, which matches Hamro Patro. 2091-2099 are projections.
 * BS 2000/01/01 = AD 1943-04-14 (Wednesday).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NepaliCalendar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIRST_YEAR = 2000;
  var DATA = [
    [30,32,31,32,31,30,30,30,29,30,29,31], // 2000
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2001
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2002
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2003
    [30,32,31,32,31,30,30,30,29,30,29,31], // 2004
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2005
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2006
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2007
    [31,31,31,32,31,31,29,30,30,29,29,31], // 2008
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2009
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2010
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2011
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2012
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2013
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2014
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2015
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2016
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2017
    [31,32,31,32,31,30,30,29,30,29,30,30], // 2018
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2019
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2020
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2021
    [31,32,31,32,31,30,30,30,29,29,30,30], // 2022
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2023
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2024
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2025
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2026
    [30,32,31,32,31,30,30,30,29,30,29,31], // 2027
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2028
    [31,31,32,31,32,30,30,29,30,29,30,30], // 2029
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2030
    [30,32,31,32,31,30,30,30,29,30,29,31], // 2031
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2032
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2033
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2034
    [30,32,31,32,31,31,29,30,30,29,29,31], // 2035
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2036
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2037
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2038
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2039
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2040
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2041
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2042
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2043
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2044
    [31,32,31,32,31,30,30,29,30,29,30,30], // 2045
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2046
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2047
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2048
    [31,32,31,32,31,30,30,30,29,29,30,30], // 2049
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2050
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2051
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2052
    [31,32,31,32,31,30,30,30,29,29,30,30], // 2053
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2054
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2055
    [31,31,32,31,32,30,30,29,30,29,30,30], // 2056
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2057
    [30,32,31,32,31,30,30,30,29,30,29,31], // 2058
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2059
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2060
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2061
    [30,32,31,32,31,31,29,30,29,30,29,31], // 2062
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2063
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2064
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2065
    [31,31,31,32,31,31,29,30,30,29,29,31], // 2066
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2067
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2068
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2069
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2070
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2071
    [31,32,31,32,31,30,30,29,30,29,30,30], // 2072
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2073
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2074
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2075
    [31,32,31,32,31,30,30,30,29,29,30,30], // 2076
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2077
    [31,31,31,32,31,31,30,29,30,29,30,30], // 2078
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2079
    [31,32,31,32,31,30,30,30,29,29,30,30], // 2080
    [31,32,31,32,31,30,30,30,29,30,29,31], // 2081
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2082
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2083
    [31,31,32,31,31,30,30,30,29,30,30,30], // 2084
    [31,32,31,32,30,31,30,30,29,30,30,30], // 2085
    [30,32,31,32,31,30,30,30,29,30,30,30], // 2086
    [31,31,32,31,31,31,30,30,29,30,30,30], // 2087
    [30,31,32,32,30,31,30,30,29,30,30,30], // 2088
    [30,32,31,32,31,30,30,30,29,30,30,30], // 2089
    [30,32,31,32,31,30,30,30,29,30,30,30], // 2090
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2091
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2092
    [31,31,31,32,31,31,29,30,30,29,29,31], // 2093
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2094
    [31,31,32,32,31,30,30,29,30,29,30,30], // 2095
    [31,32,31,32,31,30,30,30,29,29,30,31], // 2096
    [31,31,31,32,31,31,29,30,30,29,30,30], // 2097
    [31,31,32,31,31,31,30,29,30,29,30,30], // 2098
    [31,31,32,32,31,30,30,29,30,29,30,30] // 2099
  ];
  var LAST_YEAR = FIRST_YEAR + DATA.length - 1;
  var EPOCH_UTC = Date.UTC(1943, 3, 14);
  var EPOCH_WEEKDAY = 3; // Wednesday
  var MS_DAY = 86400000;

  var MONTHS_EN = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
  var MONTHS_NE = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
  var DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_NE = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];

  // Day number (days since BS 2000/01/01) of the first day of each year.
  var YEAR_START = [0];
  for (var i = 0; i < DATA.length; i++) {
    var sum = 0;
    for (var j = 0; j < 12; j++) sum += DATA[i][j];
    YEAR_START.push(YEAR_START[i] + sum);
  }
  var MAX_DAY = YEAR_START[DATA.length] - 1;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function isValidYear(y) { return y >= FIRST_YEAR && y <= LAST_YEAR; }

  function daysInMonth(y, m) {
    if (!isValidYear(y) || m < 1 || m > 12) throw new RangeError('Date out of range: ' + y + '/' + m);
    return DATA[y - FIRST_YEAR][m - 1];
  }

  function isValid(y, m, d) {
    return isValidYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= DATA[y - FIRST_YEAR][m - 1];
  }

  function toDayNumber(y, m, d) {
    if (!isValid(y, m, d)) throw new RangeError('Invalid BS date: ' + y + '/' + m + '/' + d);
    var n = YEAR_START[y - FIRST_YEAR];
    for (var k = 0; k < m - 1; k++) n += DATA[y - FIRST_YEAR][k];
    return n + d - 1;
  }

  function fromDayNumber(n) {
    if (n < 0) n = 0;
    if (n > MAX_DAY) n = MAX_DAY;
    var lo = 0, hi = DATA.length - 1;
    while (lo < hi) { // last year whose start <= n
      var mid = (lo + hi + 1) >> 1;
      if (YEAR_START[mid] <= n) lo = mid; else hi = mid - 1;
    }
    var rest = n - YEAR_START[lo];
    var m = 0;
    while (rest >= DATA[lo][m]) { rest -= DATA[lo][m]; m++; }
    return { y: FIRST_YEAR + lo, m: m + 1, d: rest + 1 };
  }

  // AD (local calendar date of a JS Date) -> BS {y, m, d}. Clamped to the supported range.
  function fromAD(date) {
    var utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return fromDayNumber(Math.round((utc - EPOCH_UTC) / MS_DAY));
  }

  // BS -> AD as a local-midnight JS Date.
  function toAD(y, m, d) {
    var t = new Date(EPOCH_UTC + toDayNumber(y, m, d) * MS_DAY);
    return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }

  function weekday(y, m, d) { return (toDayNumber(y, m, d) + EPOCH_WEEKDAY) % 7; }

  function today() { return fromAD(new Date()); }

  // "2083-06-19" — used as a storage key; sorts correctly as a string.
  function key(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function monthKey(y, m) { return y + '-' + pad2(m); }
  // "2083/06/19" — what people see.
  function format(y, m, d) { return y + '/' + pad2(m) + '/' + pad2(d); }

  function parseKey(k) {
    var p = String(k).split('-');
    return { y: +p[0], m: +p[1], d: p.length > 2 ? +p[2] : 1 };
  }

  function addDays(bs, n) { return fromDayNumber(toDayNumber(bs.y, bs.m, bs.d) + n); }

  function addMonths(y, m, delta) {
    var idx = y * 12 + (m - 1) + delta;
    var ny = Math.floor(idx / 12), nm = idx - ny * 12 + 1;
    if (ny < FIRST_YEAR) { ny = FIRST_YEAR; nm = 1; }
    if (ny > LAST_YEAR) { ny = LAST_YEAR; nm = 12; }
    return { y: ny, m: nm };
  }

  function monthName(m, lang) { return (lang === 'ne' ? MONTHS_NE : MONTHS_EN)[m - 1]; }
  function dayName(w, lang) { return (lang === 'ne' ? DAYS_NE : DAYS_EN)[w]; }

  return {
    FIRST_YEAR: FIRST_YEAR,
    LAST_YEAR: LAST_YEAR,
    MONTHS_EN: MONTHS_EN,
    MONTHS_NE: MONTHS_NE,
    DAYS_EN: DAYS_EN,
    DAYS_NE: DAYS_NE,
    pad2: pad2,
    isValid: isValid,
    daysInMonth: daysInMonth,
    toDayNumber: toDayNumber,
    fromDayNumber: fromDayNumber,
    fromAD: fromAD,
    toAD: toAD,
    weekday: weekday,
    today: today,
    key: key,
    monthKey: monthKey,
    format: format,
    parseKey: parseKey,
    addDays: addDays,
    addMonths: addMonths,
    monthName: monthName,
    dayName: dayName
  };
});
