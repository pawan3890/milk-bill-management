// Makes every app icon and splash image from icons/logo.svg.
// Run with:  node tools/make-icons.js
'use strict';
var fs = require('fs');
var path = require('path');
var Resvg = require('@resvg/resvg-js').Resvg;

var root = path.join(__dirname, '..');
var iconsDir = path.join(root, 'icons');
var res = path.join(root, 'android', 'app', 'src', 'main', 'res');
var WHITE = '#FFFFFF';
var EDGE = '#DDE1E6';
var NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

var source = fs.readFileSync(path.join(iconsDir, 'logo.svg'), 'utf8');
var rootTag = source.match(/<svg[^>]*>/)[0];
var vb = rootTag.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
var art = source.slice(source.indexOf(rootTag) + rootTag.length).replace(/<\/svg>\s*$/, '');

// Pixel bounds of the logo in its own units, and the radius of the smallest circle
// (around a centre between the box centre and the best-fitting centre) that holds it.
function measure() {
  var W = Math.round(vb[2]), H = Math.round(vb[3]);
  var img = new Resvg('<svg ' + NS + ' viewBox="' + vb.join(' ') + '" width="' + W + '" height="' + H + '">' + art + '</svg>',
    { fitTo: { mode: 'width', value: W } }).render();
  var px = img.pixels, w = img.width, h = img.height, x0 = w, y0 = h, x1 = 0, y1 = 0, pts = [];
  for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) {
    if (px[(y * w + x) * 4 + 3] < 10) continue;
    pts.push([x, y]);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x1 += 2; y1 += 2;
  var box = { x: vb[0] + x0, y: vb[1] + y0, w: x1 - x0, h: y1 - y0 };
  box.cx = box.x + box.w / 2;
  box.cy = box.y + box.h / 2;
  var best = null;
  for (var cy = y0 + box.h * 0.3; cy <= y0 + box.h * 0.7; cy += 4) {
    for (var cx = x0 + box.w * 0.4; cx <= x0 + box.w * 0.6; cx += 4) {
      var r = farthest(pts, cx, cy);
      if (!best || r < best.r) best = { cx: cx, cy: cy, r: r };
    }
  }
  box.ox = box.cx;
  box.oy = (box.cy + vb[1] + best.cy) / 2;
  box.r = farthest(pts, box.ox - vb[0], box.oy - vb[1]);
  return box;
}

function farthest(pts, cx, cy) {
  var r = 0;
  for (var i = 0; i < pts.length; i++) {
    var dx = pts[i][0] - cx, dy = pts[i][1] - cy, d = dx * dx + dy * dy;
    if (d > r) r = d;
  }
  return Math.sqrt(r);
}

// The logo scaled and moved so its point (fx, fy) lands on (x, y).
function place(fx, fy, scale, x, y) {
  return '<g transform="translate(' + (x - fx * scale).toFixed(3) + ' ' + (y - fy * scale).toFixed(3) + ') scale(' + scale.toFixed(6) + ')">' + art + '</g>';
}

function page(w, h, inner) {
  return '<svg ' + NS + ' width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + inner + '</svg>';
}

function png(svg, width) { return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng(); }

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

var L = measure();

// Logo inside a square tile, sized by its bounding box (share = part of the side it fills).
function tile(size, share, background) {
  return page(size, size, (background || '') + place(L.cx, L.cy, size * share / Math.max(L.w, L.h), size / 2, size / 2));
}
// Logo inside a circle of the given radius (for masked icons).
function inCircle(size, radius, background) {
  return page(size, size, (background || '') + place(L.ox, L.oy, radius / L.r, size / 2, size / 2));
}
function roundedWhite(size, rx) { return '<rect width="' + size + '" height="' + size + '" rx="' + rx + '" fill="' + WHITE + '"/>'; }
function fullWhite(size) { return '<rect width="' + size + '" height="' + size + '" fill="' + WHITE + '"/>'; }

// ---------- web / home-screen icons ----------
write(path.join(iconsDir, 'favicon-32.png'), png(tile(32, 0.96), 32));
write(path.join(iconsDir, 'favicon-64.png'), png(tile(64, 0.96), 64));
write(path.join(iconsDir, 'icon-192.png'), png(tile(192, 0.64, roundedWhite(192, 42)), 192));
write(path.join(iconsDir, 'icon-512.png'), png(tile(512, 0.64, roundedWhite(512, 112)), 512));
write(path.join(iconsDir, 'maskable-512.png'), png(inCircle(512, 512 * 0.34, fullWhite(512)), 512));
write(path.join(iconsDir, 'apple-touch-icon.png'), png(tile(180, 0.64, fullWhite(180)), 180));

// ---------- Android ----------
if (fs.existsSync(res)) {
  var densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  Object.keys(densities).forEach(function (d) {
    var k = densities[d];
    var s48 = Math.round(48 * k), s108 = Math.round(108 * k), s288 = Math.round(288 * k);
    var edge = Math.max(1, Math.round(k));
    // Launchers before Android 8: a white rounded square / circle with a faint edge.
    write(path.join(res, 'mipmap-' + d, 'ic_launcher.png'), png(tile(s48, 0.6,
      '<rect x="' + (k + edge / 2) + '" y="' + (k + edge / 2) + '" width="' + (s48 - 2 * k - edge) + '" height="' + (s48 - 2 * k - edge) + '" rx="' + (10 * k) + '" fill="' + WHITE + '" stroke="' + EDGE + '" stroke-width="' + edge + '"/>'), s48));
    write(path.join(res, 'mipmap-' + d, 'ic_launcher_round.png'), png(inCircle(s48, 16 * k,
      '<circle cx="' + s48 / 2 + '" cy="' + s48 / 2 + '" r="' + (s48 / 2 - k - edge / 2) + '" fill="' + WHITE + '" stroke="' + EDGE + '" stroke-width="' + edge + '"/>'), s48));
    // Android 8 and newer: the logo on its own layer, inside the 66 dp safe circle.
    write(path.join(res, 'mipmap-' + d, 'ic_launcher_foreground.png'), png(inCircle(s108, 29 * k), s108));
    // Android 12 and newer opening screen: the logo inside the circle the system allows.
    write(path.join(res, 'drawable-' + d, 'splash_logo.png'), png(inCircle(s288, 66 * k), s288));
  });
  write(path.join(res, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">' + WHITE + '</color>\n</resources>\n');

  // Opening screen before Android 12: white page with the logo in the middle.
  fs.readdirSync(res).forEach(function (dir) {
    var file = path.join(res, dir, 'splash.png');
    if (!fs.existsSync(file)) return;
    var buf = fs.readFileSync(file);
    var w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    var scale = Math.min(w, h) * 0.3 / Math.max(L.w, L.h);
    write(file, png(page(w, h, '<rect width="100%" height="100%" fill="' + WHITE + '"/>' + place(L.cx, L.cy, scale, w / 2, h / 2)), w));
  });
}
console.log('icons ready');
