/*
 * Draws bills and month reports as PNG images (English), ready to save or send.
 * Plain invoice layout: shop header, a ruled table and a clear amount to pay.
 */
(function (root) {
  'use strict';

  var L = root.Ledger;
  var Cal = root.NepaliCalendar;

  var W = 1080;
  var M = 64;
  var C = {
    blue: '#2170CC',
    ink: '#1B2330',
    muted: '#536070',
    faint: '#98A2B0',
    rule: '#E0E5EC',
    head: '#EDF2F8',
    white: '#FFFFFF',
    amber: '#9A5B05'
  };
  var FONT = 'Roboto, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Helvetica Neue", Arial, sans-serif';

  function font(weight, size) { return weight + ' ' + size + 'px ' + FONT; }

  function fit(ctx, s, maxW) {
    s = String(s);
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function fitFont(ctx, s, weight, size, minSize, maxW) {
    ctx.font = font(weight, size);
    while (size > minSize && ctx.measureText(s).width > maxW) { size -= 2; ctx.font = font(weight, size); }
  }

  function wrap(ctx, s, maxW, maxLines) {
    var words = String(s).split(/\s+/).filter(Boolean);
    var lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + '…', maxW); }
    return lines.map(function (l) { return fit(ctx, l, maxW); });
  }

  function text(ctx, s, x, y, o) {
    ctx.font = o.font;
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(o.max ? fit(ctx, s, o.max) : s, x, y);
  }

  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function rs(paisa) { return 'Rs. ' + L.formatMoney(paisa); }

  function canvasOf(h) {
    var c = document.createElement('canvas');
    c.width = W;
    c.height = Math.ceil(h);
    var ctx = c.getContext('2d');
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, W, c.height);
    return c;
  }

  // Shop header with the document title on the right. Returns the y below the blue rule.
  function header(ctx, settings, logo, title, subtitle) {
    var ls = 84;
    if (logo && logo.complete && logo.naturalWidth) ctx.drawImage(logo, M, 52, ls, ls);
    var tx = M + ls + 24;
    ctx.font = font(700, 26);
    var titleW = Math.max(ctx.measureText(title).width, (ctx.font = font(700, 34), ctx.measureText(subtitle).width));
    var maxName = W - M - tx - titleW - 40;
    var name = settings.shopName || 'Milk Bill Management';
    fitFont(ctx, name, 700, 42, 28, maxName);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, name, maxName), tx, 98);
    var contact = [settings.shopAddress, settings.shopPhone ? 'Phone ' + settings.shopPhone : ''].filter(Boolean).join('  ·  ');
    if (contact) text(ctx, contact, tx, 134, { font: font(400, 24), color: C.muted, max: maxName });
    text(ctx, title, W - M, 88, { font: font(700, 26), color: C.blue, align: 'right' });
    text(ctx, subtitle, W - M, 128, { font: font(700, 34), color: C.ink, align: 'right' });
    ctx.fillStyle = C.blue;
    ctx.fillRect(M, 166, W - 2 * M, 4);
    return 170;
  }

  function footer(ctx, y, note) {
    line(ctx, M, y, W - M, y, C.rule, 2);
    text(ctx, 'Thank you.', M, y + 50, { font: font(600, 28), color: C.ink });
    text(ctx, note, W - M, y + 50, { font: font(400, 22), color: C.muted, align: 'right', max: W - 2 * M - 200 });
  }

  /*
   * bill: Ledger.monthBill(...)   customer: {name, address, phone, rate}
   * settings: shop settings   logo: loaded <img>   today: {y,m,d}
   */
  function drawBill(bill, customer, settings, logo, today) {
    var probe = document.createElement('canvas').getContext('2d');
    probe.font = font(400, 26);
    var addr = customer.address ? wrap(probe, customer.address, 560, 2) : [];
    var infoH = 40 + 46 + addr.length * 36 + (customer.phone ? 36 : 0);
    infoH = Math.max(infoH, 140);
    var rowH = 44;
    var sum = [];
    sum.push(['Total milk', L.formatLitre(bill.litres) + ' L  (' + bill.daysWithMilk + ' days)']);
    sum.push(['Milk amount', rs(bill.paisa)]);
    if (bill.oldAdvancePaisa > 0) sum.push(['Advance from earlier months', '− ' + rs(bill.oldAdvancePaisa)]);
    bill.payments.forEach(function (p) {
      sum.push([(p.kind === 'bill' ? 'Paid' : 'Advance') + ' on ' + p.date.replace(/-/g, '/'), '− ' + rs(L.toPaisa(p.amount))]);
    });
    if (bill.includeOldDue) sum.push(['Unpaid from earlier months', '+ ' + rs(bill.oldDuePaisa)]);
    var paidInFull = bill.toPayPaisa === 0 && bill.paisa > 0;

    var H = 170 + 40 + infoH + 30 + 52 + bill.rows.length * rowH + 56 + 36 + sum.length * 50 + 90 +
      (bill.advanceLeftPaisa > 0 ? 44 : 0) + 50 + 90;
    var cv = canvasOf(H);
    var ctx = cv.getContext('2d');
    var y = header(ctx, settings, logo, 'MILK BILL', Cal.monthName(bill.m, 'en') + ' ' + bill.y);

    // bill to / bill details
    y += 40;
    text(ctx, 'BILL TO', M, y + 20, { font: font(700, 20), color: C.muted });
    fitFont(ctx, customer.name, 700, 36, 26, 600);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.fillText(fit(ctx, customer.name, 600), M, y + 64);
    var cy = y + 64;
    addr.forEach(function (l) { cy += 36; text(ctx, l, M, cy, { font: font(400, 26), color: C.ink }); });
    if (customer.phone) { cy += 36; text(ctx, 'Phone ' + customer.phone, M, cy, { font: font(400, 26), color: C.ink, max: 600 }); }
    var first = Cal.format(bill.y, bill.m, 1), last = Cal.format(bill.y, bill.m, bill.days);
    [['PERIOD', first + ' – ' + last], ['BILL DATE', Cal.format(today.y, today.m, today.d)]].forEach(function (p, i) {
      text(ctx, p[0], W - M, y + 20 + i * 68, { font: font(700, 20), color: C.muted, align: 'right' });
      text(ctx, p[1], W - M, y + 52 + i * 68, { font: font(600, 26), color: C.ink, align: 'right' });
    });
    y += infoH + 30;

    // table
    var cDay = M + 16, cDate = M + 110, cMilk = 640, cRate = 820, cAmt = W - M - 16;
    ctx.fillStyle = C.head;
    ctx.fillRect(M, y, W - 2 * M, 52);
    [['DAY', cDay, 'left'], ['DATE', cDate, 'left'], ['MILK (L)', cMilk, 'right'], ['RATE (RS./L)', cRate, 'right'], ['AMOUNT (RS.)', cAmt, 'right']].forEach(function (h) {
      text(ctx, h[0], h[1], y + 34, { font: font(700, 20), color: C.muted, align: h[2] });
    });
    y += 52;
    bill.rows.forEach(function (r) {
      var by = y + 30;
      var has = r.litres !== null;
      text(ctx, String(r.day), cDay, by, { font: font(500, 24), color: C.muted });
      text(ctx, r.date, cDate, by, { font: font(400, 24), color: C.ink });
      text(ctx, Cal.DAYS_EN[Cal.weekday(bill.y, bill.m, r.day)].slice(0, 3), cDate + 150, by, { font: font(400, 20), color: C.faint });
      text(ctx, has ? L.formatLitre(r.litres) : '–', cMilk, by, { font: font(has ? 600 : 400, 24), color: has ? C.ink : C.faint, align: 'right' });
      text(ctx, has && r.litres > 0 ? L.formatMoney(Math.round(r.rate * 100)) : '–', cRate, by, { font: font(400, 24), color: has && r.litres > 0 ? C.muted : C.faint, align: 'right' });
      text(ctx, has && r.paisa ? L.formatMoney(r.paisa) : '–', cAmt, by, { font: font(has && r.paisa ? 600 : 400, 24), color: has && r.paisa ? C.ink : C.faint, align: 'right' });
      y += rowH;
      line(ctx, M, y, W - M, y, C.rule, 1);
    });
    line(ctx, M, y, W - M, y, C.ink, 2);
    text(ctx, 'Total', cDay, y + 38, { font: font(700, 26), color: C.ink });
    text(ctx, L.formatLitre(bill.litres), cMilk, y + 38, { font: font(700, 26), color: C.ink, align: 'right' });
    text(ctx, L.formatMoney(bill.paisa), cAmt, y + 38, { font: font(700, 26), color: C.ink, align: 'right' });
    y += 56 + 36;

    // summary
    var sx = 470;
    sum.forEach(function (r) {
      text(ctx, r[0], sx, y + 32, { font: font(400, 24), color: C.muted, max: 330 });
      text(ctx, r[1], W - M, y + 32, { font: font(600, 26), color: C.ink, align: 'right' });
      line(ctx, sx, y + 50, W - M, y + 50, C.rule, 1);
      y += 50;
    });
    y += 16;
    if (paidInFull) {
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 3;
      roundRect(ctx, sx, y, W - M - sx, 70, 10);
      ctx.stroke();
      text(ctx, 'PAID IN FULL', sx + 24, y + 46, { font: font(700, 28), color: C.blue });
      text(ctx, rs(0), W - M - 24, y + 46, { font: font(700, 28), color: C.blue, align: 'right' });
    } else {
      ctx.fillStyle = C.head;
      roundRect(ctx, sx, y, W - M - sx, 70, 10);
      ctx.fill();
      text(ctx, 'AMOUNT TO PAY', sx + 24, y + 45, { font: font(700, 24), color: C.ink });
      fitFont(ctx, rs(bill.toPayPaisa), 700, 36, 26, 300);
      ctx.fillStyle = C.blue;
      ctx.textAlign = 'right';
      ctx.fillText(rs(bill.toPayPaisa), W - M - 24, y + 48);
    }
    y += 74;
    if (bill.advanceLeftPaisa > 0) {
      text(ctx, 'Advance left for next month: ' + rs(bill.advanceLeftPaisa), W - M, y + 30, { font: font(500, 22), color: C.muted, align: 'right' });
      y += 44;
    }
    y += 50;
    footer(ctx, y, (settings.shopName || 'Milk Bill Management') + '  ·  ' + Cal.format(today.y, today.m, today.d));
    return cv;
  }

  // Every customer's totals for one month.
  function drawReport(report, y0, m0, settings, logo, today) {
    var rowH = 52;
    var t = report.totals;
    var H = 170 + 40 + 110 + 36 + 52 + Math.max(1, report.rows.length) * rowH + 60 + 50 + 90;
    var cv = canvasOf(H);
    var ctx = cv.getContext('2d');
    var y = header(ctx, settings, logo, 'MONTH REPORT', Cal.monthName(m0, 'en') + ' ' + y0);
    y += 40;
    var boxes = [['TOTAL MILK', L.formatLitre(t.litres) + ' L'], ['SALES', rs(t.paisa)], ['RECEIVED', rs(t.paid)], ['PENDING', rs(t.toPay)]];
    var bw = (W - 2 * M - 3 * 16) / 4;
    boxes.forEach(function (b, i) {
      var bx = M + i * (bw + 16);
      ctx.strokeStyle = C.rule;
      ctx.lineWidth = 2;
      roundRect(ctx, bx, y, bw, 110, 10);
      ctx.stroke();
      text(ctx, b[0], bx + 20, y + 38, { font: font(700, 18), color: C.muted });
      fitFont(ctx, b[1], 700, 32, 20, bw - 40);
      ctx.fillStyle = i === 3 && t.toPay > 0 ? C.amber : C.ink;
      ctx.textAlign = 'left';
      ctx.fillText(b[1], bx + 20, y + 84);
    });
    y += 110 + 36;
    var cNum = M + 16, cName = M + 70, cMilk = 600, cAmt = 750, cPaid = 890, cPay = W - M - 16;
    ctx.fillStyle = C.head;
    ctx.fillRect(M, y, W - 2 * M, 52);
    [['#', cNum, 'left'], ['CUSTOMER', cName, 'left'], ['MILK (L)', cMilk, 'right'], ['AMOUNT', cAmt, 'right'], ['PAID', cPaid, 'right'], ['TO PAY', cPay, 'right']].forEach(function (h) {
      text(ctx, h[0], h[1], y + 34, { font: font(700, 20), color: C.muted, align: h[2] });
    });
    y += 52;
    if (!report.rows.length) {
      text(ctx, 'No customers', W / 2, y + 34, { font: font(400, 24), color: C.muted, align: 'center' });
      y += rowH;
    }
    report.rows.forEach(function (r, i) {
      var b = r.bill, by = y + 34;
      text(ctx, String(i + 1), cNum, by, { font: font(500, 22), color: C.muted });
      text(ctx, r.customer.name, cName, by, { font: font(600, 24), color: C.ink, max: cMilk - cName - 110 });
      text(ctx, b.litres ? L.formatLitre(b.litres) : '–', cMilk, by, { font: font(400, 24), color: b.litres ? C.ink : C.faint, align: 'right' });
      text(ctx, b.paisa ? L.formatMoney(b.paisa) : '–', cAmt, by, { font: font(400, 24), color: b.paisa ? C.ink : C.faint, align: 'right' });
      text(ctx, b.paidPaisa ? L.formatMoney(b.paidPaisa) : '–', cPaid, by, { font: font(400, 24), color: b.paidPaisa ? C.ink : C.faint, align: 'right' });
      var pay = b.toPayPaisa > 0 ? L.formatMoney(b.toPayPaisa) : b.status === 'none' ? '–' : 'Paid';
      text(ctx, pay, cPay, by, { font: font(600, 24), color: b.toPayPaisa > 0 ? C.amber : b.status === 'none' ? C.faint : C.blue, align: 'right' });
      y += rowH;
      line(ctx, M, y, W - M, y, C.rule, 1);
    });
    line(ctx, M, y, W - M, y, C.ink, 2);
    text(ctx, 'Total', cName, y + 40, { font: font(700, 26), color: C.ink });
    text(ctx, L.formatLitre(t.litres), cMilk, y + 40, { font: font(700, 26), color: C.ink, align: 'right' });
    text(ctx, L.formatMoney(t.paisa), cAmt, y + 40, { font: font(700, 26), color: C.ink, align: 'right' });
    text(ctx, L.formatMoney(t.paid), cPaid, y + 40, { font: font(700, 26), color: C.ink, align: 'right' });
    text(ctx, L.formatMoney(t.toPay), cPay, y + 40, { font: font(700, 26), color: C.ink, align: 'right' });
    y += 60 + 50;
    footer(ctx, y, (settings.shopName || 'Milk Bill Management') + '  ·  ' + Cal.format(today.y, today.m, today.d));
    return cv;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('blob')); }, 'image/png');
      } else {
        try {
          var data = atob(canvas.toDataURL('image/png').split(',')[1]);
          var arr = new Uint8Array(data.length);
          for (var i = 0; i < data.length; i++) arr[i] = data.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }
    });
  }

  root.BillImage = { drawBill: drawBill, drawReport: drawReport, toBlob: toBlob, fontsReady: function () { return Promise.resolve(); } };
})(typeof self !== 'undefined' ? self : this);
