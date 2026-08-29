/**
 * Ticket Inventory — write API
 *
 * Deployed as a standalone Apps Script web app. The React PWA POSTs here to
 * add or update rows. Read traffic does NOT come through here — that still
 * goes straight to the Sheets API with an API key.
 *
 * THIS FILE IS THE SOURCE OF TRUTH. Edit it here, commit it, then paste into
 * the Apps Script editor and redeploy. Do not edit only in Google's editor or
 * the two will drift apart.
 *
 * ---------------------------------------------------------------------------
 * DEPLOYMENT SETTINGS (both required, both easy to get wrong)
 *   Execute as:      Me (the script owner)
 *   Who has access:  Anyone
 *
 * "Execute as: Me" is what lets the script write to sheets the visitor has no
 * account access to. "Anyone" is required because the PWA has no Google login
 * to present.
 *
 * ---------------------------------------------------------------------------
 * SECURITY MODEL — read this before adding a tenant
 *
 * The deployment URL ships inside the public JS bundle, so anyone who reads
 * the page source can POST here. The protection is that SHEETS below lives
 * server-side and is never sent to the browser: this script can only ever
 * write to the spreadsheets named here, to a tab called "Master", and only in
 * columns that already exist in that tab's header row. It cannot be turned
 * into a general-purpose write proxy for the owner's Drive.
 *
 * What it does NOT protect against: someone who reads the bundle can write
 * junk into any tenant's sheet. Google Sheets version history
 * (File > Version history > See version history) is the recovery path.
 * ---------------------------------------------------------------------------
 */

// Tenant id -> spreadsheet ID. Must match the keys in src/tenants.js.
// Never expose this map to the client.
var SHEETS = {
  gary:  '1Fbl4-knyxeA7DvTzimyW3-gJ5w-diobiC9XgvXYlFYw',
  wendy: '1NrSoPCuMBU-VpCw7q_kDQYz2-qV8yditokCLcLWinQE'
};

var TAB_NAME = 'Master';

// Fields that must be non-empty on both add and update.
var REQUIRED = ['Date', 'Who 1', 'Where', 'Event Type'];

function doPost(e) {
  // Serialize writes. appendRow is not atomic across concurrent invocations,
  // so two people saving at once could otherwise land on the same row.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, error: 'Server busy, try again' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Empty request body' });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return json({ ok: false, error: 'Malformed JSON' });
    }

    var sheetId = SHEETS[body.tenant];
    if (!sheetId) {
      return json({ ok: false, error: 'Unknown tenant' });
    }

    var ticket = body.ticket;
    if (!ticket || typeof ticket !== 'object') {
      return json({ ok: false, error: 'Missing ticket data' });
    }

    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName(TAB_NAME);
    if (!sheet) {
      return json({ ok: false, error: 'Tab "' + TAB_NAME + '" not found' });
    }

    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      return json({ ok: false, error: 'Sheet has no header row' });
    }
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    for (var i = 0; i < REQUIRED.length; i++) {
      var field = REQUIRED[i];
      if (!ticket[field] || String(ticket[field]).trim() === '') {
        return json({ ok: false, error: field + ' is required' });
      }
    }

    if (body.op === 'add') {
      sheet.appendRow(buildRow(headers, ticket, null));
      return json({ ok: true, row: sheet.getLastRow() });
    }

    if (body.op === 'update') {
      var rowNum = parseInt(body.row, 10);
      if (!rowNum || rowNum < 2 || rowNum > sheet.getLastRow()) {
        return json({ ok: false, error: 'Invalid row number: ' + body.row });
      }
      var range = sheet.getRange(rowNum, 1, 1, headers.length);
      var existing = range.getValues()[0];
      range.setValues([buildRow(headers, ticket, existing)]);
      return json({ ok: true, row: rowNum });
    }

    return json({ ok: false, error: 'Unknown op: ' + body.op });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Build a row array in the sheet's own column order.
 *
 * Keys in `ticket` are literal header names ("Who 1", "Setlist URL"), so the
 * client never needs to know column positions and columns can be reordered in
 * the sheet without touching any code.
 *
 * On update, any header the client didn't send keeps its existing value —
 * that way a form that doesn't know about a column can't blank it out.
 */
function buildRow(headers, ticket, existing) {
  var out = [];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (Object.prototype.hasOwnProperty.call(ticket, h)) {
      out.push(ticket[h]);
    } else if (existing) {
      out.push(existing[i]);
    } else {
      out.push('');
    }
  }
  return out;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
