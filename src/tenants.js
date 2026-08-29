// src/tenants.js
// Multi-tenant config for Ticket Inventory.
//
// Each tenant = one password -> one Google Sheet -> one header title.
// Passwords are stored as SHA-256 hashes, never plaintext.
//
// SECURITY NOTE: this is a soft gate, not real auth. Both the hashes and
// the sheet IDs are visible in the built bundle to anyone who opens
// devtools. It keeps casual visitors out. It does NOT wall tenants off
// from each other.
//
// TO ADD A TENANT:
//   1. Make a copy of the Master sheet, delete the data rows (keep row 1).
//   2. Confirm the tab is still named exactly "Master".
//   3. Share it "Anyone with the link -> Viewer".
//   4. Add the sheet ID to .env as VITE_SHEET_ID_<NAME>
//   5. Hash the password:   echo -n 'thepassword' | shasum -a 256
//   6. Add an entry to TENANTS below.
//   7. npm run deploy
//
// Passwords must be unique across tenants -- the password IS the key that
// selects the sheet, so a collision would make one tenant unreachable.

export const TENANTS = {
  gary: {
    hash: '6818edc0e9d3d7b0adbfe40673d320ffdc8ee675b967341e7462bac1dd2674e0',
    sheetId: import.meta.env.VITE_SHEET_ID,
    title: 'Ticket Inventory',
  },
  wendy: {
    hash: 'cabaf612b047646ef48fce81b5a5f764f942439c6e893c2a7723df4ee7f32826',
    sheetId: import.meta.env.VITE_SHEET_ID_WENDY,
    title: "Wendy's Ticket Inventory",
  },
}

const STORAGE_KEY = 'ti_tenant'

async function sha256(str) {
  // crypto.subtle only exists in a secure context (https:// or localhost).
  // Over plain http on a LAN IP it is undefined, so fail loudly instead of
  // throwing an opaque "cannot read properties of undefined".
  if (!globalThis.crypto?.subtle) {
    throw new Error('Login needs https:// or localhost (secure context)')
  }
  const buf = new TextEncoder().encode(str)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Returns the matching tenant id, or null if the password matches nobody.
export async function findTenant(password) {
  const hash = await sha256(password)
  return Object.keys(TENANTS).find(id => TENANTS[id].hash === hash) || null
}

export function getStoredTenantId() {
  const id = sessionStorage.getItem(STORAGE_KEY)
  return id && TENANTS[id] ? id : null
}

export function storeTenantId(id) {
  sessionStorage.setItem(STORAGE_KEY, id)
}

export function clearTenant() {
  sessionStorage.removeItem(STORAGE_KEY)
}
