/* SH Pilot Logbook — PDF export engine
   Usage (browser): LogbookPDF.build(window.jspdf.jsPDF, {flights, sim, profile, format})
   Usage (node):    require('./logbook-pdf.js').build(require('jspdf').jsPDF, {...})
   Output is rendered in English/Latin for international authority submission. */
(function (root) {
  'use strict';

  function fmtHM(min) {
    min = Math.round(min || 0); if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  }
  function fmtHMz(min) { var s = fmtHM(min); return s || '0:00'; }
  function ddmmyy(iso) { if (!iso) return ''; var p = iso.split('-'); return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0].slice(2)) : iso; }
  function isSingle(f) { var c = f.acClass || ''; return c.indexOf('단발') >= 0 || /(^|[^A-Z])SE/.test(c) || /single/i.test(c); }
  function seMin(f) { return (!f.multi && isSingle(f)) ? (f.total || 0) : 0; }
  function meMin(f) { return (!f.multi && !isSingle(f)) ? (f.total || 0) : 0; }
  function mpMin(f) { return f.multi ? (f.total || 0) : 0; }
  function apprCount(f) { if (!f.appr) return 0; var parts = String(f.appr).split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean); return parts.length; }
  function simCatEN(c) {
    var map = { '정기 심 평가': 'Proficiency Check', '훈련': 'Training', '초기/전환': 'Initial / Conversion', '기타': 'Other' };
    return map[c] || c || 'Session';
  }

  /* ---- column specifications ---- */
  function easaCols() {
    return [
      { lab: 'DATE', w: 16, a: 'l', get: function (f) { return ddmmyy(f.date); } },
      { grp: 'DEPARTURE', lab: 'PLACE', w: 13, a: 'l', get: function (f) { return f.dep || ''; } },
      { grp: 'DEPARTURE', lab: 'TIME', w: 11, a: 'c', get: function (f) { return f.off != null ? clk(f.off) : ''; } },
      { grp: 'ARRIVAL', lab: 'PLACE', w: 13, a: 'l', get: function (f) { return f.arr || ''; } },
      { grp: 'ARRIVAL', lab: 'TIME', w: 11, a: 'c', get: function (f) { return f.on != null ? clk(f.on) : ''; } },
      { grp: 'AIRCRAFT', lab: 'TYPE', w: 18, a: 'l', get: function (f) { return f.acType || ''; } },
      { grp: 'AIRCRAFT', lab: 'REG', w: 16, a: 'l', get: function (f) { return f.reg || ''; } },
      { grp: 'SP TIME', lab: 'SE', w: 11, a: 'r', sum: seMin, get: function (f) { return fmtHM(seMin(f)); } },
      { grp: 'SP TIME', lab: 'ME', w: 11, a: 'r', sum: meMin, get: function (f) { return fmtHM(meMin(f)); } },
      { lab: 'MP', w: 13, a: 'r', sum: mpMin, get: function (f) { return fmtHM(mpMin(f)); } },
      { lab: 'TOTAL', w: 13, a: 'r', sum: function (f) { return f.total || 0; }, get: function (f) { return fmtHMz(f.total); } },
      { lab: 'PIC NAME', w: 22, a: 'l', get: function (f) { return f.picName || ''; } },
      { grp: 'LANDINGS', lab: 'DAY', w: 9, a: 'r', sum: function (f) { return f.dLdg || 0; }, isInt: true, get: function (f) { return f.dLdg || ''; } },
      { grp: 'LANDINGS', lab: 'NGT', w: 9, a: 'r', sum: function (f) { return f.nLdg || 0; }, isInt: true, get: function (f) { return f.nLdg || ''; } },
      { grp: 'CONDITION', lab: 'NIGHT', w: 12, a: 'r', sum: function (f) { return f.night || 0; }, get: function (f) { return fmtHM(f.night); } },
      { grp: 'CONDITION', lab: 'IFR', w: 12, a: 'r', sum: function (f) { return f.ifr || 0; }, get: function (f) { return fmtHM(f.ifr); } },
      { grp: 'FUNCTION', lab: 'PIC', w: 11, a: 'r', sum: function (f) { return f.pic || 0; }, get: function (f) { return fmtHM(f.pic); } },
      { grp: 'FUNCTION', lab: 'CO', w: 11, a: 'r', sum: function (f) { return f.sic || 0; }, get: function (f) { return fmtHM(f.sic); } },
      { grp: 'FUNCTION', lab: 'DUAL', w: 11, a: 'r', sum: function (f) { return f.dual || 0; }, get: function (f) { return fmtHM(f.dual); } },
      { grp: 'FUNCTION', lab: 'INST', w: 11, a: 'r', sum: function (f) { return f.instr || 0; }, get: function (f) { return fmtHM(f.instr); } },
      { lab: 'REMARKS', w: 0, a: 'l', get: function (f) { return remark(f); } }
    ];
  }
  function faaCols() {
    return [
      { lab: 'DATE', w: 16, a: 'l', get: function (f) { return ddmmyy(f.date); } },
      { grp: 'AIRCRAFT', lab: 'MAKE/MODEL', w: 20, a: 'l', get: function (f) { return f.acType || ''; } },
      { grp: 'AIRCRAFT', lab: 'IDENT', w: 16, a: 'l', get: function (f) { return f.reg || ''; } },
      { grp: 'ROUTE', lab: 'FROM', w: 13, a: 'l', get: function (f) { return f.dep || ''; } },
      { grp: 'ROUTE', lab: 'TO', w: 13, a: 'l', get: function (f) { return f.arr || ''; } },
      { lab: 'APP', w: 8, a: 'r', sum: apprCount, isInt: true, get: function (f) { return apprCount(f) || ''; } },
      { grp: 'LANDINGS', lab: 'DAY', w: 9, a: 'r', sum: function (f) { return f.dLdg || 0; }, isInt: true, get: function (f) { return f.dLdg || ''; } },
      { grp: 'LANDINGS', lab: 'NGT', w: 9, a: 'r', sum: function (f) { return f.nLdg || 0; }, isInt: true, get: function (f) { return f.nLdg || ''; } },
      { grp: 'CLASS', lab: 'SE', w: 12, a: 'r', sum: seMin, get: function (f) { return fmtHM(seMin(f)); } },
      { grp: 'CLASS', lab: 'ME', w: 12, a: 'r', sum: meMin, get: function (f) { return fmtHM(meMin(f)); } },
      { grp: 'CONDITIONS', lab: 'NIGHT', w: 12, a: 'r', sum: function (f) { return f.night || 0; }, get: function (f) { return fmtHM(f.night); } },
      { grp: 'CONDITIONS', lab: 'INSTR', w: 12, a: 'r', sum: function (f) { return f.ifr || 0; }, get: function (f) { return fmtHM(f.ifr); } },
      { grp: 'CONDITIONS', lab: 'XC', w: 12, a: 'r', sum: function (f) { return f.xc ? (f.total || 0) : 0; }, get: function (f) { return f.xc ? fmtHM(f.total) : ''; } },
      { grp: 'FUNCTION', lab: 'PIC', w: 11, a: 'r', sum: function (f) { return f.pic || 0; }, get: function (f) { return fmtHM(f.pic); } },
      { grp: 'FUNCTION', lab: 'SIC', w: 11, a: 'r', sum: function (f) { return f.sic || 0; }, get: function (f) { return fmtHM(f.sic); } },
      { grp: 'FUNCTION', lab: 'DUAL', w: 11, a: 'r', sum: function (f) { return f.dual || 0; }, get: function (f) { return fmtHM(f.dual); } },
      { grp: 'FUNCTION', lab: 'INST', w: 11, a: 'r', sum: function (f) { return f.instr || 0; }, get: function (f) { return fmtHM(f.instr); } },
      { lab: 'TOTAL', w: 13, a: 'r', sum: function (f) { return f.total || 0; }, get: function (f) { return fmtHMz(f.total); } },
      { lab: 'REMARKS', w: 0, a: 'l', get: function (f) { return remark(f); } }
    ];
  }
  function clk(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + (m < 10 ? '0' : '') + m; }
  function remark(f) {
    var bits = [];
    if (f.fno) bits.push(f.fno);
    if (f.auto) bits.push('A/L x' + f.auto);
    if (f.appr) bits.push(f.appr);
    if (f.rem) bits.push(f.rem);
    return bits.join(' · ');
  }

  var TITLES = {
    EASA: 'EASA Part-FCL — Pilot Flying Logbook',
    FAA: 'FAA — Pilot Logbook',
    GCAA: 'GCAA (UAE) — Pilot Flying Logbook'
  };

  function build(jsPDF, opts) {
    opts = opts || {};
    var flights = (opts.flights || []).slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || ((a._c || 0) - (b._c || 0)); });
    var sim = (opts.sim || []).slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
    var profile = opts.profile || {};
    var format = opts.format || 'EASA';
    var cols = format === 'FAA' ? faaCols() : easaCols();

    var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    var PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
    var M = 6, x0 = M, top = 22;
    var usable = PW - M * 2;

    // distribute remaining width to REMARKS (w:0)
    var fixed = 0, flex = null;
    cols.forEach(function (c) { if (c.w) fixed += c.w; else flex = c; });
    if (flex) flex.w = Math.max(24, usable - fixed);

    var grouped = cols.some(function (c) { return c.grp; });
    var hH = grouped ? 9 : 5.5, rowH = 5.4;
    var bottomReserve = 14; // page subtotal + cumulative rows
    var rowsPerPage = Math.floor((PH - top - hH - bottomReserve - M) / rowH);
    if (rowsPerPage < 1) rowsPerPage = 1;

    var run = {}; cols.forEach(function (c, i) { if (c.sum) run[i] = 0; });
    var totalPages = Math.max(1, Math.ceil(flights.length / rowsPerPage));
    var pageNo = 0;

    function header() {
      pageNo++;
      doc.setDrawColor(40); doc.setTextColor(20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(TITLES[format] || TITLES.EASA, x0, 10);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      var who = (profile.name ? 'Name: ' + profile.name : '') + (profile.lic ? '   Licence: ' + profile.lic : '');
      if (who) doc.text(who, x0, 15);
      doc.text('Generated ' + new Date().toISOString().slice(0, 10) + '   Page ' + pageNo + ' / ' + (totalPages + 1), PW - M, 10, { align: 'right' });
      doc.setFontSize(7);
      doc.text('All times UTC · HH:MM', PW - M, 15, { align: 'right' });
      drawHeaderRow();
    }
    function drawHeaderRow() {
      var y = top, x = x0;
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setLineWidth(0.2);
      // group spans
      var i = 0;
      while (i < cols.length) {
        var c = cols[i];
        if (c.grp) {
          var span = 0, ws = 0, j = i;
          while (j < cols.length && cols[j].grp === c.grp) { ws += cols[j].w; span++; j++; }
          doc.rect(x, y, ws, hH / 2);
          doc.text(c.grp, x + ws / 2, y + hH / 2 - 1.2, { align: 'center' });
          var xx = x;
          for (var k = i; k < j; k++) { doc.rect(xx, y + hH / 2, cols[k].w, hH / 2); doc.text(cols[k].lab, xx + cols[k].w / 2, y + hH - 1.2, { align: 'center' }); xx += cols[k].w; }
          x += ws; i = j;
        } else {
          doc.rect(x, y, c.w, hH);
          doc.text(c.lab, x + c.w / 2, y + hH / 2 + 0.8, { align: 'center' });
          x += c.w; i++;
        }
      }
    }
    function cell(x, y, w, h, txt, align) {
      doc.rect(x, y, w, h);
      if (txt === '' || txt == null) return;
      txt = String(txt);
      var maxch = Math.floor(w / 1.05);
      if (txt.length > maxch && maxch > 3) txt = txt.slice(0, maxch - 1) + '…';
      var tx = align === 'r' ? x + w - 1 : align === 'c' ? x + w / 2 : x + 1;
      doc.text(txt, tx, y + h / 2 + 1, { align: align === 'r' ? 'right' : align === 'c' ? 'center' : 'left' });
    }
    function dataRow(f, y) {
      var x = x0; doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
      cols.forEach(function (c, idx) {
        cell(x, y, c.w, rowH, c.get(f), c.a);
        if (c.sum) run[idx] += c.sum(f) || 0;
        x += c.w;
      });
    }
    function sumRow(y, label, vals, bold) {
      var x = x0; doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(6);
      // label spans the leading non-sum columns up to first sum col
      var firstSum = 0; for (var i = 0; i < cols.length; i++) { if (cols[i].sum) { firstSum = i; break; } }
      var lw = 0; for (var k = 0; k < firstSum; k++) lw += cols[k].w;
      doc.rect(x, y, lw, rowH); doc.text(label, x + 1, y + rowH / 2 + 1);
      x += lw;
      for (var c = firstSum; c < cols.length; c++) {
        var col = cols[c];
        var txt = '';
        if (col.sum) txt = col.isInt ? String(vals[c] || 0) : fmtHMz(vals[c]);
        cell(x, y, col.w, rowH, txt, col.sum ? 'r' : col.a);
        x += col.w;
      }
    }

    // ---- ledger pages ----
    header();
    var y = top + hH;
    var pageVals = {};
    function resetPage() { pageVals = {}; cols.forEach(function (c, i) { if (c.sum) pageVals[i] = 0; }); }
    resetPage();
    var onPage = 0;

    function flushPageTotals() {
      // page subtotal + cumulative
      sumRow(y, 'TOTAL THIS PAGE', pageVals, true); y += rowH;
      var cum = {}; cols.forEach(function (c, i) { if (c.sum) cum[i] = run[i]; });
      sumRow(y, 'TOTAL TO DATE', cum, true); y += rowH;
    }

    if (!flights.length) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120);
      doc.text('No flight entries.', x0 + 2, y + 6); doc.setTextColor(20);
      flushPageTotals();
    } else {
      flights.forEach(function (f, idx) {
        dataRow(f, y);
        cols.forEach(function (c, i) { if (c.sum) pageVals[i] += c.sum(f) || 0; });
        y += rowH; onPage++;
        if (onPage >= rowsPerPage && idx < flights.length - 1) {
          flushPageTotals();
          doc.addPage(); header(); y = top + hH; onPage = 0; resetPage();
        }
      });
      flushPageTotals();
    }

    // ---- summary / certification page ----
    doc.addPage(); pageNo++;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20);
    doc.text((TITLES[format] || '') + '  —  Summary', x0, 12);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Generated ' + new Date().toISOString().slice(0, 10) + '   Page ' + pageNo + ' / ' + pageNo, PW - M, 12, { align: 'right' });

    // grand totals
    var T = grand(flights);
    var pairs = [
      ['Total Flight Time', fmtHMz(T.total)],
      ['Multi-Pilot Time', fmtHMz(T.mp)],
      ['PIC', fmtHMz(T.pic)],
      ['Co-Pilot / SIC', fmtHMz(T.sic)],
      ['Dual', fmtHMz(T.dual)],
      ['Instructor', fmtHMz(T.instr)],
      ['Night', fmtHMz(T.night)],
      ['IFR / Instrument', fmtHMz(T.ifr)],
      ['Cross-Country', fmtHMz(T.xc)],
      ['Landings (Day / Night)', T.dLdg + ' / ' + T.nLdg],
      ['Autolandings', String(T.auto)],
      ['Number of Flights', String(T.n)]
    ];
    var by = 20, col1 = x0, col2 = x0 + 95, bw = 88, bh = 6.2;
    doc.setFontSize(8.5);
    pairs.forEach(function (p, i) {
      var cx = (i % 2 === 0) ? col1 : col2;
      var ry = by + Math.floor(i / 2) * bh;
      doc.setDrawColor(60); doc.setLineWidth(0.2); doc.rect(cx, ry, bw, bh);
      doc.setFont('helvetica', 'normal'); doc.text(p[0], cx + 2, ry + bh / 2 + 1.2);
      doc.setFont('helvetica', 'bold'); doc.text(String(p[1]), cx + bw - 2, ry + bh / 2 + 1.2, { align: 'right' });
    });
    var yy = by + Math.ceil(pairs.length / 2) * bh + 8;

    // by type
    var types = byType(flights);
    if (types.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('By Aircraft Type', x0, yy); yy += 4;
      doc.setFontSize(7.5);
      var head = ['TYPE', 'FLIGHTS', 'BLOCK', 'DAY LDG', 'NGT LDG'], cw = [40, 24, 24, 24, 24];
      var tx = x0; doc.setFont('helvetica', 'bold');
      head.forEach(function (h, i) { doc.rect(tx, yy, cw[i], 5.5); doc.text(h, tx + 1.5, yy + 3.8); tx += cw[i]; });
      yy += 5.5; doc.setFont('helvetica', 'normal');
      types.forEach(function (t) {
        var rx = x0, vals = [t.type || '(none)', String(t.n), fmtHMz(t.total), String(t.dLdg), String(t.nLdg)];
        vals.forEach(function (v, i) { doc.rect(rx, yy, cw[i], 5); doc.text(String(v), rx + 1.5, yy + 3.5); rx += cw[i]; });
        yy += 5;
      });
      yy += 6;
    }

    // simulator
    if (sim.length) {
      var st = sim.reduce(function (a, s) { return a + (s.total || 0); }, 0);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('Simulator / FSTD  —  ' + sim.length + ' session(s), ' + fmtHMz(st) + ' total', x0, yy); yy += 4;
      doc.setFontSize(7.5);
      var sh = ['DATE', 'TYPE', 'CATEGORY', 'TIME', 'RESULT'], scw = [22, 34, 46, 20, 24];
      var sx = x0; doc.setFont('helvetica', 'bold');
      sh.forEach(function (h, i) { doc.rect(sx, yy, scw[i], 5.5); doc.text(h, sx + 1.5, yy + 3.8); sx += scw[i]; });
      yy += 5.5; doc.setFont('helvetica', 'normal');
      sim.slice(0, 14).forEach(function (s) {
        var rx = x0, vals = [ddmmyy(s.date), s.type || '', simCatEN(s.cat), fmtHMz(s.total), s.res || ''];
        vals.forEach(function (v, i) { doc.rect(rx, yy, scw[i], 5); var t = String(v); if (t.length > scw[i] / 1.4) t = t.slice(0, Math.floor(scw[i] / 1.4)) + '…'; doc.text(t, rx + 1.5, yy + 3.5); rx += scw[i]; });
        yy += 5;
      });
      yy += 6;
    }

    if (format === 'GCAA') {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(90);
      doc.text('Note: Totals reconcile with all logged entries. Verify against your licence totals before submission to the GCAA.', x0, yy);
      doc.setTextColor(20); yy += 7;
    }

    // certification
    if (yy > PH - 26) { doc.addPage(); yy = 20; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('I certify that the entries in this logbook are complete and correct.', x0, yy); yy += 12;
    function sigline(label, x, w) { doc.setLineWidth(0.3); doc.line(x, yy, x + w, yy); doc.setFontSize(7); doc.text(label, x, yy + 4); }
    sigline('Signature', x0, 70);
    sigline('Name: ' + (profile.name || ''), x0 + 80, 70);
    sigline('Licence: ' + (profile.lic || ''), x0 + 160, 50);
    sigline('Date', x0 + 220, 40);

    return doc;
  }

  function grand(flights) {
    var T = { total: 0, mp: 0, pic: 0, sic: 0, dual: 0, instr: 0, night: 0, ifr: 0, xc: 0, dLdg: 0, nLdg: 0, auto: 0, n: 0 };
    flights.forEach(function (f) {
      T.total += f.total || 0; T.mp += mpMin(f); T.pic += f.pic || 0; T.sic += f.sic || 0;
      T.dual += f.dual || 0; T.instr += f.instr || 0; T.night += f.night || 0; T.ifr += f.ifr || 0;
      T.xc += f.xc ? (f.total || 0) : 0; T.dLdg += f.dLdg || 0; T.nLdg += f.nLdg || 0; T.auto += f.auto || 0; T.n++;
    });
    return T;
  }
  function byType(flights) {
    var m = {};
    flights.forEach(function (f) {
      var k = f.acType || '';
      if (!m[k]) m[k] = { type: k, n: 0, total: 0, dLdg: 0, nLdg: 0 };
      m[k].n++; m[k].total += f.total || 0; m[k].dLdg += f.dLdg || 0; m[k].nLdg += f.nLdg || 0;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.total - a.total; });
  }

  var api = { build: build, _grand: grand };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LogbookPDF = api;
})(typeof window !== 'undefined' ? window : null);
