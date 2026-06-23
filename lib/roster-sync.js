/* SH Pilot Logbook — roster -> calendar rule engine (pure)
   Usage (browser): RosterSync.build(rosterJson)  -> { events, warnings, unknownCodes, month }
   Usage (node):    require('./roster-sync.js').build(json)
   Input is a "duty roster JSON" (produced from the t'way Excel, see SCHEMA below).
   Output events are KST (Asia/Seoul). No alarms/reminders are added.

   SCHEMA
   {
     "type": "fltroster",
     "month": "2026-07",                 // roster month, used in [FLTROSTER:..] tag + UID
     "tz": "Asia/Seoul",                 // informational; times are KST wall-clock HHMM
     "duties": [
       {
         "date": "2026-07-02",           // EFFECTIVE operating date (after any (B) day shift, resolved in chat)
         "code": "713",                  // flight no | OFF RQOFF VAC RDO RESV S1 S2 SBY SBY-A SBY-B L/O TRAIN
         "from": "GMP", "to": "CJU",     // optional route (IATA or ICAO)
         "su": "0610",                   // show-up HHMM KST (optional)
         "std": "0710", "sta": "0815",   // scheduled off/on HHMM KST (optional for non-flight)
         "stdB": "", "staB": "", "suB":"", // (B) block overrides (optional) - replace base time when present
         "role": "FO",                   // self role PIC|FO|DH|TFO (optional, default FO)
         "reg": "HL8378", "acType":"B737-800", // optional (flights)
         "crew": ["CA Hong","FO Lee \u2605\ubcf8\uc778"] // optional crew lines (self pre-marked in chat)
       }
     ]
   }
*/
(function (root) {
  'use strict';

  var ENGINE_VER = 'v0.6a';

  // colorId per handover table
  var COLOR = {
    off: '8', resv: '2', eval: '9', standby: '6',
    layover: '3', train: '7', flight: '7', showup: '5'
  };

  var ALLDAY_CODES = { OFF: 1, RQOFF: 1, VAC: 1, RDO: 1 };
  var KNOWN = { OFF:1, RQOFF:1, VAC:1, RDO:1, RESV:1, S1:1, S2:1, 'L/O':1, TRAIN:1 };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function normCode(code) { return String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'X'; }
  function isFlightNo(code) { return /^[A-Z]*\d+[A-Z]?$/i.test(String(code || '').trim()) && /\d/.test(String(code)); }
  function isStandby(code) { return /^SBY/i.test(String(code || '').trim()); }

  // 'HHMM' or 'H:MM' -> minutes; '' / null -> null
  function clk(v) {
    if (v == null) return null;
    var s = String(v).trim(); if (!s) return null;
    s = s.replace(':', '');
    if (!/^\d{3,4}$/.test(s)) return null;
    var h = parseInt(s.slice(0, s.length - 2), 10), m = parseInt(s.slice(-2), 10);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  function eff(base, b) { var x = clk(b); return x != null ? x : clk(base); } // (B) override wins
  function addDay(ymd, n) {
    var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dt(ymd, min) { return ymd + 'T' + pad2(Math.floor(min / 60)) + ':' + pad2(min % 60) + ':00'; }
  // end on same day unless it wraps past midnight relative to start
  function endParts(ymd, startMin, endMin) {
    var ed = ymd; if (endMin < startMin) ed = addDay(ymd, 1);
    return { date: ed, min: endMin };
  }

  function categoryOf(duty) {
    var raw = String(duty.code || '').trim().toUpperCase();
    if (ALLDAY_CODES[raw]) return 'off';
    if (raw === 'RESV') {
      var hasMove = duty.from && duty.to && String(duty.from).toUpperCase() !== String(duty.to).toUpperCase();
      return hasMove ? 'resv' : 'off-resv';   // no route / same route = all-day reserve
    }
    if (raw === 'S1' || raw === 'S2') return 'eval';
    if (isStandby(raw)) return 'standby';
    if (raw === 'L/O') return 'layover';
    if (raw === 'TRAIN') return 'train';
    if (isFlightNo(raw)) return 'flight';
    return 'unknown';
  }

  function roleSuffix(role) {
    var r = String(role || '').toUpperCase();
    if (r === 'DH') return ' (DH)';
    if (r === 'TFO') return ' (TFO)';
    return '';
  }
  function routeStr(d) { return (d.from || '') + '-' + (d.to || ''); }

  function build(input) {
    var data = (typeof input === 'string') ? JSON.parse(input) : input;
    var month = data.month || '';
    var duties = (data.duties || data.flights || data.legs || []).slice();
    var warnings = [], unknownCodes = {};
    var tag = month ? ('[FLTROSTER:' + month + ']') : '';

    // 1) Normalize: resolve effective times, category, anchor (for sorting/show-up)
    var norm = duties.map(function (d, i) {
      var cat = categoryOf(d);
      var su = eff(d.su, d.suB), std = eff(d.std, d.stdB), sta = eff(d.sta, d.staB);
      return {
        i: i, raw: d, date: d.date, code: d.code, cat: cat,
        su: su, std: std, sta: sta,
        // layover has no times of its own and must sort LAST within its day so the
        // "previous timed duty" lookup resolves to that day's last flight.
        anchor: (cat === 'layover') ? 99999 : (su != null ? su : (std != null ? std : (sta != null ? sta : 0)))
      };
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.anchor - b.anchor;
    });

    function descOf(d, extra) {
      var lines = [];
      if (Array.isArray(d.crew) && d.crew.length) lines.push(d.crew.join('\n'));
      if (extra) lines.push(extra);
      if (tag) lines.push(tag);
      return lines.join('\n\n');
    }

    var events = [];

    // 2) Primary event per duty (layover handled in a later pass once neighbours exist)
    norm.forEach(function (n) {
      var d = n.raw, cat = n.cat, ev = null;

      if (cat === 'off' || cat === 'off-resv') {
        ev = {
          cat: (cat === 'off-resv' ? 'resv' : 'off'), allDay: true,
          summary: (String(d.code).toUpperCase() === 'RESV') ? 'RESV' : String(d.code).toUpperCase(),
          colorId: (cat === 'off-resv') ? COLOR.resv : COLOR.off,
          startDate: d.date, endDate: addDay(d.date, 1),
          description: descOf(d, '')
        };
      } else if (cat === 'flight') {
        if (n.std == null || n.sta == null) { warnings.push(d.date + ' ' + d.code + ': missing STD/STA'); }
        var e1 = endParts(d.date, n.std || 0, n.sta != null ? n.sta : (n.std || 0));
        ev = {
          cat: 'flight', allDay: false,
          summary: String(d.code).toUpperCase() + ' ' + routeStr(d) + roleSuffix(d.role),
          colorId: COLOR.flight, location: routeStr(d),
          startDateTime: dt(d.date, n.std || 0), endDateTime: dt(e1.date, e1.min),
          description: descOf(d, '')
        };
      } else if (cat === 'resv') {
        var e2 = endParts(d.date, n.std || 0, n.sta != null ? n.sta : (n.std || 0));
        ev = {
          cat: 'resv', allDay: false, summary: 'RESV ' + routeStr(d), colorId: COLOR.resv,
          location: routeStr(d), startDateTime: dt(d.date, n.std || 0), endDateTime: dt(e2.date, e2.min),
          description: descOf(d, '')
        };
      } else if (cat === 'train') {
        var e3 = endParts(d.date, n.std || 0, n.sta != null ? n.sta : (n.std || 0));
        ev = {
          cat: 'train', allDay: false, summary: 'TRAIN ' + routeStr(d) + ' (DH)', colorId: COLOR.train,
          location: routeStr(d), startDateTime: dt(d.date, n.std || 0), endDateTime: dt(e3.date, e3.min),
          description: descOf(d, '')
        };
      } else if (cat === 'eval') {
        var es = (n.su != null ? n.su : n.std) || 0, ee = (n.sta != null ? n.sta : es);
        var e4 = endParts(d.date, es, ee);
        ev = {
          cat: 'eval', allDay: false, summary: '\uc815\uae30 \uc2ec \ud3c9\uac00 (' + String(d.code).toUpperCase() + ')',
          colorId: COLOR.eval, startDateTime: dt(d.date, es), endDateTime: dt(e4.date, e4.min),
          description: descOf(d, '')
        };
      } else if (cat === 'standby') {
        var ss = (n.su != null ? n.su : n.std) || 0, se = (n.sta != null ? n.sta : ss);
        var e5 = endParts(d.date, ss, se);
        ev = {
          cat: 'standby', allDay: false, summary: String(d.code).toUpperCase(), colorId: COLOR.standby,
          startDateTime: dt(d.date, ss), endDateTime: dt(e5.date, e5.min),
          description: descOf(d, '')
        };
      } else if (cat === 'layover') {
        ev = { cat: 'layover', allDay: false, summary: 'L/O ' + (d.to || d.from || d.location || ''),
          colorId: COLOR.layover, _layover: true, _date: d.date, description: descOf(d, '') };
      } else { // unknown
        unknownCodes[String(d.code)] = (unknownCodes[String(d.code)] || 0) + 1;
        warnings.push(d.date + ' ' + d.code + ': unknown code');
        var us = n.anchor || 0, ue = (n.sta != null ? n.sta : us);
        var e6 = endParts(d.date, us, ue);
        ev = {
          cat: 'unknown', unknown: true, allDay: (n.su == null && n.std == null && n.sta == null),
          summary: String(d.code) + ' ?', colorId: '11',
          description: descOf(d, '')
        };
        if (ev.allDay) { ev.startDate = d.date; ev.endDate = addDay(d.date, 1); }
        else { ev.startDateTime = dt(d.date, us); ev.endDateTime = dt(e6.date, e6.min); }
      }

      ev._date = ev._date || d.date; ev._anchor = n.anchor; ev._n = n;
      ev._code = normCode(d.code);
      events.push(ev);
    });

    // 3) Layover times: start = previous timed event's end, end = next timed event's start
    function isTimed(e) { return e && !e.allDay && e.startDateTime; }
    for (var k = 0; k < events.length; k++) {
      if (!events[k]._layover) continue;
      var prev = null, next = null;
      for (var p = k - 1; p >= 0; p--) { if (isTimed(events[p]) && !events[p]._layover) { prev = events[p]; break; } }
      for (var q = k + 1; q < events.length; q++) { if (isTimed(events[q]) && !events[q]._layover) { next = events[q]; break; } }
      // next start should be its SU (report) rather than STD when available
      var nextStart = null;
      if (next) { nextStart = (next._n && next._n.su != null) ? dt(next._date, next._n.su) : next.startDateTime; }
      if (prev && nextStart) {
        events[k].startDateTime = prev.endDateTime;
        events[k].endDateTime = nextStart;
      } else {
        warnings.push(events[k]._date + ' L/O: could not resolve start/end from neighbours');
        events[k].startDateTime = dt(events[k]._date, 0);
        events[k].endDateTime = dt(addDay(events[k]._date, 1), 0);
      }
    }

    // 4) Show up: first reporting duty of each flying day; skip if SU == STD
    var showCats = { flight: 1, train: 1 };
    var firstByDate = {};
    events.forEach(function (e) {
      if (!showCats[e.cat]) return;
      var n = e._n; if (!n || n.su == null) return;
      var d0 = e._date;
      if (!firstByDate[d0] || n.su < firstByDate[d0]._n.su) firstByDate[d0] = e;
    });
    var showEvents = [];
    Object.keys(firstByDate).forEach(function (d0) {
      var e = firstByDate[d0], n = e._n;
      if (n.std != null && n.su === n.std) return; // turnaround: report == departure
      var s = n.su, end = endParts(d0, s, s + 10);
      showEvents.push({
        cat: 'showup', allDay: false, summary: 'Show up', colorId: COLOR.showup,
        startDateTime: dt(d0, s), endDateTime: dt(end.date, end.min),
        description: tag, _date: d0, _anchor: s, _code: 'SU'
      });
    });
    events = events.concat(showEvents);

    // 5) Sort final, assign per-day seq + UID (Show up sorts first within its day)
    events.sort(function (a, b) {
      if (a._date !== b._date) return a._date < b._date ? -1 : 1;
      return (a._anchor || 0) - (b._anchor || 0);
    });
    var seqByDate = {};
    events.forEach(function (e) {
      var d0 = e._date; var seq = (seqByDate[d0] = (seqByDate[d0] == null ? 0 : seqByDate[d0] + 1));
      var ymd = d0.replace(/-/g, '');
      var code = (e.cat === 'showup') ? 'SU' : (e._code || 'X');
      e.uid = 'fltroster-' + month + '-' + ymd + '-' + pad2(seq) + '-' + code + '@shlee';
      delete e._layover;
    });

    return {
      engine: ENGINE_VER, month: month, events: events,
      warnings: warnings, unknownCodes: Object.keys(unknownCodes)
    };
  }

  // Google Calendar body (used by v0.6c sync). UID embedded in description for idempotent diff.
  function toGcalBody(ev) {
    var body = { summary: ev.summary, colorId: ev.colorId,
      description: ((ev.description ? ev.description + '\n\n' : '') + '[UID:' + ev.uid + ']') };
    if (ev.location) body.location = ev.location;
    if (ev.allDay) { body.start = { date: ev.startDate }; body.end = { date: ev.endDate }; }
    else {
      body.start = { dateTime: ev.startDateTime, timeZone: 'Asia/Seoul' };
      body.end = { dateTime: ev.endDateTime, timeZone: 'Asia/Seoul' };
    }
    return body;
  }

  // ---- Idempotent diff (v0.6c) -------------------------------------------------
  function uidFromDescription(desc) { var m = (desc || '').match(/\[UID:([^\]]+)\]/); return m ? m[1] : null; }
  function normDT(s) { return s ? String(s).replace(/([+-]\d\d:?\d\d|Z)$/, '').slice(0, 19) : ''; }
  function remoteStartKey(e) {
    if (e.start && e.start.date) return 'D:' + String(e.start.date).slice(0, 10);
    if (e.start && e.start.dateTime) return 'T:' + normDT(e.start.dateTime);
    return '?';
  }
  function localStartKey(ev) {
    return ev.allDay ? ('D:' + ev.startDate.slice(0, 10)) : ('T:' + normDT(ev.startDateTime));
  }
  function remoteEndKey(e) {
    if (e.end && e.end.date) return 'D:' + String(e.end.date).slice(0, 10);
    if (e.end && e.end.dateTime) return 'T:' + normDT(e.end.dateTime);
    return '?';
  }
  function localEndKey(ev) {
    return ev.allDay ? ('D:' + ev.endDate.slice(0, 10)) : ('T:' + normDT(ev.endDateTime));
  }
  function gcalChanged(remote, ev) {
    var b = toGcalBody(ev);
    if ((remote.summary || '') !== (b.summary || '')) return true;
    if (String(remote.colorId || '') !== String(b.colorId || '')) return true;
    if ((remote.location || '') !== (b.location || '')) return true;
    if ((remote.description || '').trim() !== (b.description || '').trim()) return true;
    if (remoteStartKey(remote) !== localStartKey(ev)) return true;
    if (remoteEndKey(remote) !== localEndKey(ev)) return true;
    return false;
  }
  // existing: array of Google event resources (items). events: engine output events.
  function diff(existing, events) {
    existing = existing || [];
    var byUid = {}, byStart = {}, used = {};
    existing.forEach(function (e) {
      var u = uidFromDescription(e.description); if (u) byUid[u] = e;
      var k = remoteStartKey(e); (byStart[k] = byStart[k] || []).push(e);
    });
    var toInsert = [], toPatch = [], toDelete = [], seen = {};
    events.forEach(function (ev) {
      seen[ev.uid] = 1;
      var found = byUid[ev.uid];
      if (!found) { // legacy fallback: same start, no UID yet, not already used
        var cands = byStart[localStartKey(ev)] || [];
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          if (!used[c.id] && !uidFromDescription(c.description)) { found = c; break; }
        }
      }
      if (!found) { toInsert.push(ev); return; }
      used[found.id] = 1;
      if (gcalChanged(found, ev)) toPatch.push({ id: found.id, ev: ev, summary: found.summary });
    });
    existing.forEach(function (e) {
      var u = uidFromDescription(e.description);
      if (u && !seen[u] && !used[e.id]) {
        toDelete.push({ id: e.id, summary: e.summary, start: (e.start && (e.start.dateTime || e.start.date)) || '' });
      }
    });
    return { toInsert: toInsert, toPatch: toPatch, toDelete: toDelete };
  }

  // ICS (v0.6b). Timed events carry TZID=Asia/Seoul with a VTIMEZONE block (fixed +09:00, no DST).
  function toIcs(res) {
    function esc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
    function fold(line) { // RFC 5545 line folding (conservative, char-based)
      if (line.length <= 74) return line;
      var out = line.slice(0, 74), rest = line.slice(74);
      while (rest.length > 73) { out += '\r\n ' + rest.slice(0, 73); rest = rest.slice(73); }
      return out + '\r\n ' + rest;
    }
    function stampLocal(s) { return s.replace(/[-:]/g, ''); } // 'YYYY-MM-DDTHH:MM:SS' -> 'YYYYMMDDTHHMMSS'
    function stampDate(s) { return s.replace(/-/g, ''); }
    var dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SH Pilot Logbook//roster ' + ENGINE_VER + '//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19880101T000000',
      'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE'];
    (res.events || []).forEach(function (e) {
      var lines = ['BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + dtstamp];
      if (e.allDay) {
        lines.push('DTSTART;VALUE=DATE:' + stampDate(e.startDate));
        lines.push('DTEND;VALUE=DATE:' + stampDate(e.endDate));
      } else {
        lines.push('DTSTART;TZID=Asia/Seoul:' + stampLocal(e.startDateTime));
        lines.push('DTEND;TZID=Asia/Seoul:' + stampLocal(e.endDateTime));
      }
      lines.push('SUMMARY:' + esc(e.summary));
      if (e.location) lines.push('LOCATION:' + esc(e.location));
      if (e.colorId) lines.push('CATEGORIES:' + esc(e.cat || ''));
      var desc = (e.description ? e.description + '\n\n' : '') + '[UID:' + e.uid + ']';
      lines.push('DESCRIPTION:' + esc(desc));
      lines.push('END:VEVENT');
      lines.forEach(function (l) { L.push(fold(l)); });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }

  var api = { ENGINE_VER: ENGINE_VER, build: build, toGcalBody: toGcalBody, toIcs: toIcs,
    diff: diff, uidFromDescription: uidFromDescription,
    _normCode: normCode, _categoryOf: categoryOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RosterSync = api;
})(typeof self !== 'undefined' ? self : this);
