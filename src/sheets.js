const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SHEET_NAME = 'Master';

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
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}
