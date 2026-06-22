/**
 * ANIMA — anonymous analytics collector (Google Apps Script Web App)
 * © 2025 David Dalmazzo. ANIMA MSCA 101203318, EU Horizon Europe.
 *
 * Receives behaviour events from analytics.js and appends one row per event to
 * the bound Google Sheet. NO personal data is stored: Apps Script never sees the
 * client IP, and the payload carries only a random per-tab session id.
 *
 * ── DEPLOY (≈3 min) ─────────────────────────────────────────────────────────
 *   1. Create a Google Sheet → Extensions → Apps Script.
 *   2. Paste this file in, Save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as:  Me
 *        Who has access:  Anyone
 *   4. Copy the Web app URL (ends in /exec) → paste into analytics.js
 *      CONFIG.behaviorEndpoint.
 *
 * ── GET THE CSV ─────────────────────────────────────────────────────────────
 *   • In Sheets:  File → Download → CSV, drop into  dataset/events.csv  and commit.
 *   • Or programmatically (commit the result into the repo):
 *        curl -L "https://script.google.com/.../exec?export=csv&key=YOUR_KEY" \
 *             -o dataset/events.csv
 */

// Target spreadsheet (opened by ID so the script works standalone or bound).
var SHEET_ID   = '1Ad0pfAWjMt5xtuCP2Yh8fNsdV9B_KEoeb2-NtE0N4qQ';
var SHEET_NAME = 'events';
var HEADERS    = ['received_at', 'event_ts', 'sid', 'event', 'page', 'target', 'props'];

// Optional shared secret for the CSV export endpoint. Leave '' to disable export.
var EXPORT_KEY = '';

function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function targetString_(props) {
  if (!props) return '';
  if (typeof props === 'string') return props;
  if (props.name)  return String(props.name);
  if (props.label) return String(props.label);
  return [props.tag || '', props.id || '', props.cls || ''].join('').trim();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data   = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var events = data.events || (data.event ? [data] : []);
    if (!events.length) return json_({ ok: true, n: 0 });

    var now  = new Date();
    var rows = events.map(function (ev) {
      return [
        now,
        ev.ts || '',
        ev.sid || '',
        ev.event || '',
        ev.page || '',
        targetString_(ev.props),
        JSON.stringify(ev.props || {}),
      ];
    });

    // One batched write — far faster and safer than appendRow per event.
    var sh    = sheet_();
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, HEADERS.length).setValues(rows);

    return json_({ ok: true, n: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Export the whole sheet as CSV (guarded by EXPORT_KEY). Used to pull the data
// into dataset/events.csv for committing to the GitHub repo.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.export === 'csv') {
    if (!EXPORT_KEY || p.key !== EXPORT_KEY) {
      return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
    }
    var values = sheet_().getDataRange().getValues();
    var csv = values.map(function (row) {
      return row.map(function (c) {
        var s = (c instanceof Date) ? c.toISOString() : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
  }
  return json_({ ok: true, service: 'anima-analytics' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
