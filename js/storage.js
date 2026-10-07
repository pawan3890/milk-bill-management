/*
 * Saving for Milk Bill Management.
 *
 * Data is split into small parts: 'meta' (settings + customers) and one part per
 * Nepali month ('2083-06'). Every change is written to this phone's storage at once.
 */
(function (root) {
  'use strict';

  var PREFIX = 'dms.';
  var MONTH_RE = /^\d{4}-\d{2}$/;

  // ---------- this phone's storage ----------

  var Local = {
    ok: (function () {
      try {
        var k = PREFIX + 'probe';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    })(),

    keyFor: function (part) { return part === 'meta' ? PREFIX + 'meta' : PREFIX + 'month.' + part; },

    readAll: function () {
      if (!Local.ok) return null;
      try {
        var raw = localStorage.getItem(PREFIX + 'meta');
        if (!raw) return null;
        var state = { meta: JSON.parse(raw), months: {} };
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX + 'month.') === 0) {
            var mk = k.slice((PREFIX + 'month.').length);
            if (MONTH_RE.test(mk)) state.months[mk] = JSON.parse(localStorage.getItem(k));
          }
        }
        return state;
      } catch (e) {
        return null;
      }
    },

    // Returns true when written. Throws 'storageFull' if the phone has no room.
    write: function (part, data) {
      if (!Local.ok) return false;
      try {
        if (data === null) localStorage.removeItem(Local.keyFor(part));
        else localStorage.setItem(Local.keyFor(part), JSON.stringify(data));
        return true;
      } catch (e) {
        throw new Error('storageFull');
      }
    },

    monthKeys: function () {
      var out = [];
      if (!Local.ok) return out;
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX + 'month.') === 0) out.push(k.slice((PREFIX + 'month.').length));
        }
      } catch (e) { /* ignore */ }
      return out;
    },

    getFlag: function (name) {
      try { return localStorage.getItem(PREFIX + 'flag.' + name); } catch (e) { return null; }
    },
    setFlag: function (name, value) {
      try { localStorage.setItem(PREFIX + 'flag.' + name, value); } catch (e) { /* ignore */ }
    }
  };

  var Store = {
    mode: 'device',        // 'device' | 'memory'
    _state: null,

    // Loads saved data. Resolves { state, mode }.
    init: function (emptyState) {
      Store.mode = Local.ok ? 'device' : 'memory';
      Store._state = Local.readAll() || emptyState();
      if (navigator.storage && navigator.storage.persist) {
        try { navigator.storage.persist().catch(function () {}); } catch (e) { /* ignore */ }
      }
      return Promise.resolve({ state: Store._state, mode: Store.mode });
    },

    // Save the given parts ('meta' and/or month keys). Throws 'storageFull' if it fails.
    save: function (parts) {
      var state = Store._state;
      var seen = {};
      parts.forEach(function (part) {
        if (!part || seen[part]) return;
        seen[part] = true;
        var data = part === 'meta' ? state.meta : (state.months[part] || null);
        if (Store.mode === 'device') Local.write(part, data);
      });
    },

    // Replace everything (restore from backup).
    replaceAll: function (newState) {
      var old = Store._state;
      var parts = ['meta'];
      Object.keys(old.months).forEach(function (mk) { if (!newState.months[mk]) parts.push(mk); });
      Object.keys(newState.months).forEach(function (mk) { parts.push(mk); });
      Store._state = newState;
      Store.save(parts);
      return newState;
    },

    Local: Local
  };

  root.Store = Store;
})(typeof self !== 'undefined' ? self : this);
