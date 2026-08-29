const API_KEY         = import.meta.env.VITE_GOOGLE_API_KEY;
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const SHEET_NAME      = 'Master';

export async function fetchTickets(sheetId) {
  if (!sheetId) {
    throw new Error('No sheet configured for this login — check your .env file')
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  // Surface the real Google error instead of dying on the destructure below.
  // Common causes: sheet not shared "Anyone with the link", tab not named
  // "Master", or the API key's referrer restriction rejecting the origin.
  if (data.error) {
    throw new Error(data.error.message || 'Google Sheets API error');
  }

  // A brand-new tenant sheet has headers only (or nothing at all).
  if (!data.values || data.values.length < 2) {
    return [];
  }

  const [headers, ...rows] = data.values;
  return rows.map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j] || '');
    // Sheet row number: +1 for the header row, +1 because sheets are 1-indexed.
    // The Apps Script needs this to know which row an edit targets.
    obj._row = i + 2;
    return obj;
  });
}

/**
 * Append a new ticket. `ticket` is keyed by literal sheet header names
 * ("Who 1", "Setlist URL"), so no column-order knowledge is needed here.
 * Returns { ok, row }.
 */
export async function addTicket(tenantId, ticket) {
  return postToScript({ op: 'add', tenant: tenantId, ticket });
}

/**
 * Overwrite an existing ticket by sheet row number. Headers not present in
 * `ticket` keep their current values. Returns { ok, row }.
 */
export async function updateTicket(tenantId, rowNum, ticket) {
  return postToScript({ op: 'update', tenant: tenantId, row: rowNum, ticket });
}

async function postToScript(body) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Missing VITE_APPS_SCRIPT_URL in .env');
  }

  // Apps Script web apps never answer a CORS preflight, so any request that
  // triggers one fails. Sending text/plain keeps this a "simple" request and
  // avoids the preflight entirely — the body is still JSON, and the script
  // reads it via e.postData.contents.
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Apps Script returned ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error saving to sheet');
  }
  return data;
}
