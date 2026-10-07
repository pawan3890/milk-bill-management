/*
 * Phone features for Milk Bill Management: saving files, sharing, automatic backups
 * and the back button.
 *
 * Android app:  files go to  Documents/Milk Bill Management/{Bills, Reports, Backups},
 *               with one folder per month inside Bills and Backups (e.g. "2083-06 Asoj")
 * Browser:      files go to the browser's Downloads
 */
(function (root) {
  'use strict';

  var FOLDER = 'Milk Bill Management';
  var SUBFOLDERS = { bills: 'Bills', reports: 'Reports', backups: 'Backups' };

  var Cap = root.Capacitor;
  var isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  var plugins = {};

  function plugin(name) {
    if (!isNative) return null;
    if (plugins[name]) return plugins[name];
    var p = null;
    try {
      var register = (root.capacitorExports && root.capacitorExports.registerPlugin) || Cap.registerPlugin;
      if (register) p = register(name);
    } catch (e) { p = null; }
    if (!p && Cap.Plugins) p = Cap.Plugins[name] || null;
    plugins[name] = p;
    return p;
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // ---------- Android ----------

  var permissionOk = null;
  function ensurePermission(FS) {
    if (permissionOk) return Promise.resolve(true);
    return FS.checkPermissions().then(function (s) {
      if (s.publicStorage === 'granted') return true;
      return FS.requestPermissions().then(function (r) { return r.publicStorage === 'granted'; });
    }).then(function (ok) {
      permissionOk = ok;
      return ok;
    }, function () { return true; });
  }

  function altName(filename) {
    var dot = filename.lastIndexOf('.');
    var stamp = new Date();
    var hhmm = ('0' + stamp.getHours()).slice(-2) + ('0' + stamp.getMinutes()).slice(-2) + ('0' + stamp.getSeconds()).slice(-2);
    return filename.slice(0, dot) + '-' + hhmm + filename.slice(dot);
  }

  function baseName(path) { return path.slice(path.lastIndexOf('/') + 1); }

  // path: file name, or "month folder/file name", inside the kind's folder.
  // data: string (text files) or Blob (images).
  function writeToFolder(kind, path, data) {
    var FS = plugin('Filesystem');
    if (!FS) return Promise.reject(new Error('unavailable'));
    var slash = path.lastIndexOf('/');
    var dir = FOLDER + '/' + (SUBFOLDERS[kind] || 'Files') + (slash >= 0 ? '/' + path.slice(0, slash) : '');
    var filename = baseName(path);
    var isText = typeof data === 'string';
    return ensurePermission(FS).then(function (ok) {
      if (!ok) throw new Error('permission');
      return isText ? data : blobToBase64(data);
    }).then(function (payload) {
      var opts = { path: dir + '/' + filename, data: payload, directory: 'DOCUMENTS', recursive: true };
      if (isText) opts.encoding = 'utf8';
      var plain = function (s) { return String(s).replace(/^﻿/, ''); };
      // Text files (backups) are read back and written once more if they do not match,
      // so a backup is never left half written.
      var verify = function (r, again) {
        if (!isText) return r;
        return FS.readFile({ path: dir + '/' + r.name, directory: 'DOCUMENTS', encoding: 'utf8' }).then(function (back) {
          if (plain(back.data) === plain(payload)) return r;
          if (!again) throw new Error('verify');
          opts.path = dir + '/' + r.name;
          return FS.writeFile(opts).then(function () { return verify(r, false); });
        });
      };
      return FS.writeFile(opts).then(function (r) { return { uri: r.uri, name: filename }; }, function () {
        // A file with this name can belong to an earlier install of the app; keep both.
        var other = altName(filename);
        opts.path = dir + '/' + other;
        return FS.writeFile(opts).then(function (r) { return { uri: r.uri, name: other }; });
      }).then(function (r) { return verify(r, true); });
    }).then(function (r) {
      return { ok: true, name: r.name, uri: r.uri, where: 'Documents/' + dir };
    });
  }

  function shareNative(filename, data, title) {
    var FS = plugin('Filesystem');
    var Share = plugin('Share');
    if (!FS || !Share) return Promise.reject(new Error('unavailable'));
    var isText = typeof data === 'string';
    return (isText ? Promise.resolve(data) : blobToBase64(data)).then(function (payload) {
      var opts = { path: 'share/' + filename, data: payload, directory: 'CACHE', recursive: true };
      if (isText) opts.encoding = 'utf8';
      return FS.writeFile(opts);
    }).then(function (r) {
      return Share.share({ title: title || filename, files: [r.uri], dialogTitle: title || filename });
    }).then(function () { return true; });
  }

  // ---------- public ----------

  var Platform = {
    isNative: isNative,
    folder: 'Documents/' + FOLDER,
    folderName: FOLDER,
    folders: { backups: SUBFOLDERS.backups, bills: SUBFOLDERS.bills, reports: SUBFOLDERS.reports },

    // path: file name, or "month folder/file name" (the folder is used on the phone only).
    // Resolves { ok, where?, name?, error? }.
    saveFile: function (kind, path, data, mime) {
      if (isNative) {
        return writeToFolder(kind, path, data).catch(function (e) {
          return { ok: false, error: e && e.message === 'permission' ? 'permission' : 'failed' };
        });
      }
      var filename = baseName(path);
      var blob = typeof data === 'string' ? new Blob([data], { type: mime || 'text/plain' }) : data;
      try {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        return Promise.resolve({ ok: true, name: filename, where: 'Downloads' });
      } catch (e) {
        return Promise.resolve({ ok: false, error: 'failed' });
      }
    },

    canShare: function () {
      if (isNative) return !!plugin('Share');
      try {
        var f = new File(['x'], 'x.png', { type: 'image/png' });
        return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] }));
      } catch (e) { return false; }
    },

    // Resolves true when the share sheet was used, false when cancelled. Rejects on failure.
    shareFile: function (filename, data, mime, title) {
      if (isNative) return shareNative(filename, data, title);
      var blob = typeof data === 'string' ? new Blob([data], { type: mime || 'text/plain' }) : data;
      var file = new File([blob], filename, { type: mime || blob.type });
      return navigator.share({ files: [file], title: title || filename }).then(function () { return true; }, function (e) {
        if (e && e.name === 'AbortError') return false;
        throw e;
      });
    },

    // Android only: writes one file of a month's backup folder (Backups/2083-06 Asoj/...).
    // Resolves { ok, name, where } or null.
    autoBackup: function (path, text) {
      if (!isNative) return Promise.resolve(null);
      return writeToFolder('backups', path, text).catch(function () { return null; });
    },

    onBackButton: function (handler) {
      var App = plugin('App');
      if (App && App.addListener) App.addListener('backButton', handler);
      return !!App;
    },

    exitApp: function () {
      var App = plugin('App');
      if (App && App.exitApp) App.exitApp();
    },

    onResume: function (handler) {
      var App = plugin('App');
      if (App && App.addListener) App.addListener('resume', handler);
    },

    // ---------- safe copy inside the app (Android) ----------
    // A second copy of all records in the app's private storage. It survives clearing of
    // the web view's data and is included in Android's own phone backup.

    writeSafeCopy: function (json) {
      var FS = plugin('Filesystem');
      if (!FS) return Promise.resolve(false);
      var tmp = { path: 'safe/current.tmp', data: json, directory: 'DATA', encoding: 'utf8', recursive: true };
      return FS.writeFile(tmp).then(function () {
        return FS.deleteFile({ path: 'safe/current.json', directory: 'DATA' }).catch(function () {});
      }).then(function () {
        return FS.rename({ from: 'safe/current.tmp', to: 'safe/current.json', directory: 'DATA', toDirectory: 'DATA' });
      }).then(function () { return true; }, function () {
        return FS.writeFile({ path: 'safe/current.json', data: json, directory: 'DATA', encoding: 'utf8', recursive: true })
          .then(function () { return true; }, function () { return false; });
      });
    },

    readSafeCopy: function () {
      var FS = plugin('Filesystem');
      if (!FS) return Promise.resolve(null);
      var read = function (p) { return FS.readFile({ path: p, directory: 'DATA', encoding: 'utf8' }).then(function (r) { return r.data; }); };
      return read('safe/current.json').catch(function () { return read('safe/current.tmp'); }).catch(function () { return null; });
    },

    // One snapshot per day (overwritten during the day), the newest 30 kept.
    writeSnapshot: function (name, json) {
      var FS = plugin('Filesystem');
      if (!FS) return Promise.resolve(false);
      return FS.writeFile({ path: 'safe/snapshots/' + name + '.json', data: json, directory: 'DATA', encoding: 'utf8', recursive: true })
        .then(function () {
          return FS.readdir({ path: 'safe/snapshots', directory: 'DATA' }).then(function (res) {
            var names = (res.files || []).map(function (f) { return typeof f === 'string' ? f : f.name; }).filter(function (n) { return /\.json$/.test(n); }).sort();
            names.slice(0, Math.max(0, names.length - 30)).forEach(function (n) {
              FS.deleteFile({ path: 'safe/snapshots/' + n, directory: 'DATA' }).catch(function () {});
            });
            return true;
          });
        }).catch(function () { return false; });
    },

    // Earlier copies that can be restored: app snapshots, the month folders in Backups
    // and any older backup files kept loose in Backups.
    listCopies: function () {
      var FS = plugin('Filesystem');
      if (!FS) return Promise.resolve([]);
      function list(dir, directory, source, deep) {
        return FS.readdir({ path: dir, directory: directory }).then(function (res) {
          return Promise.all((res.files || []).map(function (f) {
            var name = typeof f === 'string' ? f : f.name;
            var path = dir + '/' + name;
            if (f.type === 'directory') return deep ? list(path, directory, source, false) : [];
            return /\.json$/.test(name) ? [{ source: source, name: name, path: path, directory: directory, mtime: f.mtime || 0, size: f.size || 0 }] : [];
          }));
        }).then(function (groups) { return [].concat.apply([], groups); }).catch(function () { return []; });
      }
      return Promise.all([
        list('safe/snapshots', 'DATA', 'app', false),
        list(FOLDER + '/' + SUBFOLDERS.backups, 'DOCUMENTS', 'folder', true)
      ]).then(function (lists) {
        return lists[0].concat(lists[1]).sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); });
      });
    },

    readCopy: function (entry) {
      var FS = plugin('Filesystem');
      if (!FS) return Promise.reject(new Error('unavailable'));
      return FS.readFile({ path: entry.path, directory: entry.directory, encoding: 'utf8' }).then(function (r) { return r.data; });
    }
  };

  root.Platform = Platform;
})(typeof self !== 'undefined' ? self : this);
