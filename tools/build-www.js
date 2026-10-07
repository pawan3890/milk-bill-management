// Copies the app files into www/ for the Android app (Capacitor).
// Run with:  node tools/build-www.js
'use strict';
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var out = path.join(root, 'www');
var items = ['index.html', 'css', 'js', 'icons'];

function copy(src, dst) {
  var st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    fs.readdirSync(src).forEach(function (f) { copy(path.join(src, f), path.join(dst, f)); });
  } else {
    fs.copyFileSync(src, dst);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
items.forEach(function (it) {
  var src = path.join(root, it);
  if (fs.existsSync(src)) copy(src, path.join(out, it));
});
// The Android app needs Capacitor's bridge script before platform.js.
fs.copyFileSync(path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'), path.join(out, 'js', 'capacitor.js'));
var html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
html = html.replace('<script src="js/platform.js"></script>', '<script src="js/capacitor.js"></script>\n<script src="js/platform.js"></script>')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '');
if (html.indexOf('js/capacitor.js') < 0) throw new Error('could not add capacitor.js');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www ready');
