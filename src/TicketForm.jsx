// src/TicketForm.jsx
// Add/edit modal for a single ticket. Payload keys are literal sheet header
// names so the Apps Script can map them to columns without knowing order.

import { useEffect, useMemo, useRef, useState } from 'react'
import { addTicket, updateTicket } from './sheets'

const EMPTY_FORM = {
  date: '',
  who1: '', who2: '', who3: '', who4: '', who5: '',
  where: '',
  eventType: '',
  admissionType: '',
  amount: '',
  sectionRow: '',
  tags: '',
  setlistUrl: '',
  notes: '',
}

// ---------------------------------------------------------------------------
// Format conversion.
//
// The sheet stores dates as M/D/YYYY and amounts as $X.XX. HTML inputs want
// YYYY-MM-DD and a bare number. These convert both directions — skipping the
// reverse would silently corrupt any row opened for editing.
//
// Deliberately string-only: routing through `new Date()` applies a timezone
// offset that can shift the date by a day.
// ---------------------------------------------------------------------------

function sheetDateToInput(s) {
  if (!s) return ''
  const parts = String(s).trim().split('/')
  if (parts.length !== 3) return ''
  const [m, d, y] = parts
  if (y.length !== 4) return ''
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function inputDateToSheet(s) {
  if (!s) return ''
  const parts = String(s).split('-')
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  // Strip leading zeros to match how existing rows are stored.
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
}

function sheetAmountToInput(s) {
  if (!s) return ''
  const n = parseFloat(String(s).replace(/[$,]/g, ''))
  return Number.isNaN(n) ? '' : String(n)
}

function inputAmountToSheet(s) {
  if (s === '' || s === null || s === undefined) return ''
  const n = parseFloat(s)
  return Number.isNaN(n) ? '' : `$${n.toFixed(2)}`
}

// Sheet header -> form field, plus an optional converter used when writing.
// Single source of truth, so each header string appears exactly once.
const FIELD_MAP = [
  ['Date',             'date',          inputDateToSheet],
  ['Who 1',            'who1'],
  ['Who 2',            'who2'],
  ['Who 3',            'who3'],
  ['Who 4',            'who4'],
  ['Who 5',            'who5'],
  ['Where',            'where'],
  ['Event Type',       'eventType'],
  ['Admission Type',   'admissionType'],
  ['Amount',           'amount',        inputAmountToSheet],
  ['Section-Row-Seat', 'sectionRow'],
  ['Notes',            'notes'],
  ['Tags',             'tags'],
  ['Setlist URL',      'setlistUrl'],
]

// REQUIRED in apps-script/Code.gs, so these go on every save even when
// unchanged — otherwise the server rejects the update as missing fields.
const ALWAYS_SEND = ['Date', 'Who 1', 'Where', 'Event Type']

function ticketToForm(t) {
  return {
    date:          sheetDateToInput(t['Date']),
    who1:          t['Who 1'] ?? '',
    who2:          t['Who 2'] ?? '',
    who3:          t['Who 3'] ?? '',
    who4:          t['Who 4'] ?? '',
    who5:          t['Who 5'] ?? '',
    where:         t['Where'] ?? '',
    eventType:     t['Event Type'] ?? '',
    admissionType: t['Admission Type'] ?? '',
    amount:        sheetAmountToInput(t['Amount']),
    sectionRow:    t['Section-Row-Seat'] ?? '',
    tags:          t['Tags'] ?? '',
    setlistUrl:    t['Setlist URL'] ?? '',
    notes:         t['Notes'] ?? '',
  }
}

export default function TicketForm({
  mode, ticket, tenantId,
  knownTypes = [], knownVenues = [], knownArtists = [], knownAdmissions = [],
  onClose, onSaved,
}) {
  const isEdit = mode === 'edit'

  const initial = useMemo(
    () => (isEdit && ticket ? ticketToForm(ticket) : EMPTY_FORM),
    [isEdit, ticket]
  )

  const [form, setForm]         = useState(initial)
  const [showExtra, setExtra]   = useState(
    isEdit && ticket ? Boolean(ticket['Who 2'] || ticket['Who 3'] || ticket['Who 4'] || ticket['Who 5']) : false
  )
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [typeMode, setTypeMode] = useState(
    isEdit && ticket && ticket['Event Type'] && !knownTypes.includes(ticket['Event Type'])
      ? 'custom' : 'select'
  )

  const initialRef = useRef(initial)
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialRef.current),
    [form]
  )

  // Mirrors the REQUIRED list in apps-script/Code.gs. If they drift, the
  // server rejects a save the client thought was valid.
  const errors = {}
  if (!form.date)                errors.date      = 'Required'
  if (!form.who1.trim())         errors.who1      = 'Required'
  if (!form.where.trim())        errors.where     = 'Required'
  if (!form.eventType.trim())    errors.eventType = 'Required'
  const isValid = Object.keys(errors).length === 0

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') attemptClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function attemptClose() {
    if (saving) return
    if (dirty && !confirm('Discard changes?')) return
    onClose()
  }

  async function handleSave() {
    if (!isValid || saving) return
    setError(null)
    setSaving(true)
    try {
      // On edit, send only the fields the user actually changed. Anything
      // omitted keeps its current value in the sheet, so a save can't wipe an
      // edit made directly in Google Sheets since this page last loaded.
      const payload = {}
      for (const [header, key, convert] of FIELD_MAP) {
        const value = form[key]
        const unchanged = isEdit && value === initialRef.current[key]
        if (unchanged && !ALWAYS_SEND.includes(header)) continue
        payload[header] = convert ? convert(value) : String(value).trim()
      }
      if (isEdit) {
        await updateTicket(tenantId, ticket._row, payload)
      } else {
        await addTicket(tenantId, payload)
      }
      onSaved()
    } catch (ex) {
      setError(ex.message || 'Failed to save')
      setSaving(false)
    }
  }

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white ' +
    'focus:outline-none focus:border-emerald-500'

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) attemptClose() }}
    >
      <div className="w-full sm:max-w-lg bg-gray-900 sm:rounded-2xl border border-gray-800 flex flex-col max-h-screen sm:max-h-[90vh]">

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-bold text-emerald-400">
            {isEdit ? 'Edit event' : 'Add an event'}
          </h2>
          <button
            onClick={attemptClose}
            disabled={saving}
            className="text-gray-500 hover:text-gray-300 text-xl disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">

          <Field label="Date" required error={errors.date}>
            <input type="date" value={form.date}
              onChange={e => update('date', e.target.value)}
              className={inputCls} autoFocus={!isEdit} />
          </Field>

          <Field label="Event Type" required error={errors.eventType}>
            {typeMode === 'select' ? (
              <select
                value={form.eventType}
                onChange={e => {
                  if (e.target.value === '__other__') {
                    setTypeMode('custom')
                    update('eventType', '')
                  } else {
                    update('eventType', e.target.value)
                  }
                }}
                className={inputCls}
              >
                <option value="">— Select —</option>
                {knownTypes.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__other__">Other…</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={form.eventType}
                  onChange={e => update('eventType', e.target.value)}
                  placeholder="New event type"
                  className={inputCls} />
                <button type="button"
                  onClick={() => { setTypeMode('select'); update('eventType', '') }}
                  className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-400 text-sm shrink-0">
                  ↩ List
                </button>
              </div>
            )}
          </Field>

          <Field label="Who 1" required error={errors.who1}
                 hint="Headliner, team, or promotion">
            <input type="text" list="ti-artists" value={form.who1}
              onChange={e => update('who1', e.target.value)}
              className={inputCls} />
          </Field>

          <div>
            <button type="button" onClick={() => setExtra(s => !s)}
              className="text-sm font-semibold text-emerald-500 hover:text-emerald-400">
              {showExtra ? '− Hide' : '+ Add'} supporting acts
            </button>
            {showExtra && (
              <div className="space-y-2 mt-2">
                {[2, 3, 4, 5].map(n => (
                  <input key={n} type="text" list="ti-artists"
                    value={form[`who${n}`]}
                    onChange={e => update(`who${n}`, e.target.value)}
                    placeholder={`Who ${n}`}
                    className={inputCls} />
                ))}
              </div>
            )}
          </div>

          <Field label="Where" required error={errors.where}>
            <input type="text" list="ti-venues" value={form.where}
              onChange={e => update('where', e.target.value)}
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" hint="Numbers only">
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => update('amount', e.target.value)}
                placeholder="0.00"
                className={inputCls} />
            </Field>
            <Field label="Admission Type">
              <input type="text" list="ti-admissions" value={form.admissionType}
                onChange={e => update('admissionType', e.target.value)}
                className={inputCls} />
            </Field>
          </div>

          <Field label="Section-Row-Seat">
            <input type="text" value={form.sectionRow}
              onChange={e => update('sectionRow', e.target.value)}
              placeholder="e.g. 102-S-148"
              className={inputCls} />
          </Field>

          <Field label="Tags" hint="Space-separated, e.g. #aew #zack">
            <input type="text" value={form.tags}
              onChange={e => update('tags', e.target.value)}
              placeholder="#tag1 #tag2"
              className={inputCls} />
          </Field>

          <Field label="Setlist / Cagematch URL">
            <input type="url" value={form.setlistUrl}
              onChange={e => update('setlistUrl', e.target.value)}
              placeholder="https://…"
              className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} rows={3}
              onChange={e => update('notes', e.target.value)}
              className={inputCls + ' resize-none'} />
          </Field>

          {error && (
            <div className="px-3 py-2 rounded bg-red-950 border border-red-900 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 shrink-0">
          <button onClick={attemptClose} disabled={saving}
            className="px-4 py-2 rounded bg-gray-800 text-gray-300 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:bg-gray-700 disabled:text-gray-500">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add event')}
          </button>
        </div>

        {/* Suggestion lists. A datalist only suggests — any typed value is
            accepted, so new venues and artists need no special handling. */}
        <datalist id="ti-artists">
          {knownArtists.map(a => <option key={a} value={a} />)}
        </datalist>
        <datalist id="ti-venues">
          {knownVenues.map(v => <option key={v} value={v} />)}
        </datalist>
        <datalist id="ti-admissions">
          {knownAdmissions.map(a => <option key={a} value={a} />)}
        </datalist>
      </div>
    </div>
  )
}

function Field({ label, hint, required, error, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-gray-400">
          {label}{required && <span className="text-red-500"> *</span>}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {children}
      {hint && !error && (
        <span className="block text-xs text-gray-600 mt-1">{hint}</span>
      )}
    </label>
  )
}
