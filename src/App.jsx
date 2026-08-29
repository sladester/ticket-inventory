import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchTickets } from './sheets'
import { TENANTS, findTenant, getStoredTenantId, storeTenantId } from './tenants'
import TicketForm from './TicketForm'

const SORT_FIELDS = ['Date', 'Who 1', 'Where', 'Event Type', 'Amount']
const WHO_FIELDS = ['Who 1', 'Who 2', 'Who 3', 'Who 4', 'Who 5']

function getExternalUrl(ticket) {
  const type = ticket['Event Type']?.toLowerCase()
  const isConcert = type === 'concert'
  const isWrestling = type === 'wrestling'
  if (!isConcert && !isWrestling) return null
  const direct = ticket['Setlist URL']?.trim()
  if (direct) return { href: direct, type: isWrestling ? 'cagematch-direct' : 'direct' }
  const date = ticket['Date']?.trim()
  if (!date) return null
  const parts = date.split('/')
  if (parts.length !== 3) return null
  const month = parts[0].padStart(2, '0')
  const day = parts[1].padStart(2, '0')
  const year = parts[2]
  if (isConcert) {
    const artist = ticket['Who 1']?.trim()
    if (!artist) return null
    const query = encodeURIComponent(artist)
    return { href: `https://www.setlist.fm/search?query=${query}&year=${year}&month=${month}&day=${day}`, type: 'setlist' }
  }
  if (isWrestling) {
    return { href: 'https://www.cagematch.net/?id=1&view=results', type: 'cagematch' }
  }
  return null
}

function parseTags(tagStr) {
  if (!tagStr) return []
  return tagStr.trim().split(/\s+/).filter(t => t.startsWith('#'))
}

function DetailContent({ ticket, onClose, onEdit }) {
  const link = getExternalUrl(ticket)
  const supporters = WHO_FIELDS.slice(1).map(f => ticket[f]?.trim()).filter(Boolean)
  const tags = parseTags(ticket['Tags'])
  const linkLabels = {
    direct: { label: '🎵 View Setlist', color: 'bg-emerald-600 hover:bg-emerald-500' },
    setlist: { label: '🔍 Search Setlist.fm', color: 'bg-emerald-600 hover:bg-emerald-500' },
    cagematch: { label: '🤼 Search Cagematch', color: 'bg-red-700 hover:bg-red-600' },
    'cagematch-direct': { label: '🤼 View on Cagematch', color: 'bg-red-700 hover:bg-red-600' },
  }
  return (
    <div className="pt-3 pb-1 px-1">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-white font-bold text-lg">{ticket['Who 1']}</div>
          {supporters.length > 0 && (
            <div className="text-gray-400 text-sm mt-0.5">with {supporters.join(', ')}</div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl ml-4">✕</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs mb-1">Date</div>
          <div className="text-white text-sm">{ticket['Date']}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs mb-1">Type</div>
          <div className="text-white text-sm">{ticket['Event Type']}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 col-span-2">
          <div className="text-gray-500 text-xs mb-1">Venue</div>
          <div className="text-white text-sm">{ticket['Where']}</div>
        </div>
        {ticket['Amount'] && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">Price</div>
            <div className="text-emerald-400 text-sm font-bold">{ticket['Amount']}</div>
          </div>
        )}
        {ticket['Section-Row-Seat'] && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">Section-Row-Seat</div>
            <div className="text-white text-sm">{ticket['Section-Row-Seat']}</div>
          </div>
        )}
        {ticket['Admission Type'] && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">Admission</div>
            <div className="text-white text-sm">{ticket['Admission Type']}</div>
          </div>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {tags.map(tag => (
            <span key={tag} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      )}
      {ticket['Notes'] && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="text-gray-500 text-xs mb-1">Notes</div>
          <div className="text-gray-300 text-sm italic">{ticket['Notes']}</div>
        </div>
      )}
      <div className="flex gap-2">
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(ticket) }}
            className="shrink-0 px-4 text-center text-gray-200 font-medium py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
            ✏️ Edit
          </button>
        )}
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`flex-1 block text-center text-white font-medium py-3 rounded-lg transition-colors ${linkLabels[link.type].color}`}>
            {linkLabels[link.type].label}
          </a>
        )}
      </div>
    </div>
  )
}

function MobileDrawer({ ticket, onClose, onEdit }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl px-4 pb-8 pt-2 max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-1 bg-gray-600 rounded mx-auto mb-2" />
        <DetailContent ticket={ticket} onClose={onClose} onEdit={onEdit} />
      </div>
    </div>
  )
}

function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const handleSubmit = async () => {
    if (checking || !input) return
    setChecking(true)
    try {
      const tenantId = await findTenant(input)
      if (tenantId) {
        storeTenantId(tenantId)
        onUnlock(tenantId)
        return
      }
      setChecking(false)
      setError('Incorrect password')
      setInput('')
      setTimeout(() => setError(''), 2000)
    } catch (e) {
      setChecking(false)
      setError(e.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🎟</div>
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Ticket Inventory</h1>
        <p className="text-gray-500 text-sm mb-6">Enter password to continue</p>
        <input type="password" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password" autoFocus
          className={`w-full bg-gray-800 border rounded px-4 py-3 text-center text-white focus:outline-none mb-4 transition-colors ${error ? 'border-red-500' : 'border-gray-700 focus:border-emerald-500'}`}
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button onClick={handleSubmit} disabled={checking}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium py-3 rounded transition-colors">
          {checking ? 'Checking…' : 'Enter'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [tenantId, setTenantId] = useState(() => getStoredTenantId())
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [sortField, setSortField] = useState('Date')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterTag, setFilterTag] = useState('All')
  const [statsFilterType, setStatsFilterType] = useState('Concert')
  const [view, setView] = useState('stats')
  const [expanded, setExpanded] = useState({})
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [formMode, setFormMode] = useState(null)      // 'add' | 'edit' | null
  const [formTicket, setFormTicket] = useState(null)

  const tenant = tenantId ? TENANTS[tenantId] : null

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const handleRowClick = useCallback((ticket) => {
    if (isMobile) {
      setSelectedTicket(ticket)
    } else {
      setExpandedRow(prev => prev === ticket ? null : ticket)
    }
  }, [isMobile])

  const handleEdit = useCallback((ticket) => {
    setFormTicket(ticket)
    setFormMode('edit')
  }, [])

  const handleAdd = useCallback(() => {
    setFormTicket(null)
    setFormMode('add')
  }, [])

  const handleSaved = useCallback(() => {
    setFormMode(null)
    setFormTicket(null)
    setSelectedTicket(null)
    setExpandedRow(null)
    setReloadKey(k => k + 1)
  }, [])

  const goToList = useCallback((searchTerm, type = 'All') => {
    setSearch(searchTerm)
    setFilterType(type)
    setFilterTag('All')
    setView('list')
    setExpandedRow(null)
    setSelectedTicket(null)
  }, [])

  const handleStatArtistClick = useCallback((artist) => goToList(artist), [goToList])
  const handleStatVenueClick = useCallback((venue) => goToList(venue), [goToList])

  const handleStatYearClick = useCallback((year) => {
    setSearch(year)
    setFilterType('All')
    setFilterTag('All')
    setSortField('Date')
    setSortDir('asc')
    setView('list')
    setExpandedRow(null)
    setSelectedTicket(null)
  }, [])

  const handleStatTypeClick = useCallback((type) => {
    setSearch('')
    setFilterType(type)
    setFilterTag('All')
    setView('list')
    setExpandedRow(null)
    setSelectedTicket(null)
  }, [])

  const handlePriceTicketClick = useCallback((ticket) => {
    setView('list')
    setSearch(ticket['Who 1'])
    setFilterType('All')
    setFilterTag('All')
    setExpandedRow(null)
    setSelectedTicket(null)
    setTimeout(() => {
      if (isMobile) {
        setSelectedTicket(ticket)
      } else {
        setExpandedRow(ticket)
      }
    }, 100)
  }, [isMobile])

  useEffect(() => {
    if (!tenantId) return
    const sheetId = TENANTS[tenantId].sheetId
    setLoading(true)
    setError(null)
    fetchTickets(sheetId)
      .then(setTickets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tenantId, reloadKey])

  // Distinct values pulled from the loaded data, used to populate the form's
  // dropdown and datalist suggestions.
  const knownTypes = useMemo(
    () => [...new Set(tickets.map(t => t['Event Type']).filter(Boolean))].sort(),
    [tickets]
  )
  const knownVenues = useMemo(
    () => [...new Set(tickets.map(t => t['Where']).filter(Boolean))].sort(),
    [tickets]
  )
  const knownAdmissions = useMemo(
    () => [...new Set(tickets.map(t => t['Admission Type']).filter(Boolean))].sort(),
    [tickets]
  )
  const knownArtists = useMemo(() => {
    const set = new Set()
    tickets.forEach(t => WHO_FIELDS.forEach(f => {
      const v = t[f]?.trim()
      if (v) set.add(v)
    }))
    return [...set].sort()
  }, [tickets])

  const eventTypes = useMemo(() => ['All', ...knownTypes], [knownTypes])

  const allTags = useMemo(() => {
    const tagSet = new Set()
    tickets.forEach(t => parseTags(t['Tags']).forEach(tag => tagSet.add(tag)))
    return ['All', ...Array.from(tagSet).sort()]
  }, [tickets])

  const filtered = useMemo(() => {
    let data = [...tickets]
    if (filterType !== 'All') data = data.filter(t => t['Event Type'] === filterType)
    if (filterTag !== 'All') data = data.filter(t => parseTags(t['Tags']).includes(filterTag))
    if (search) {
      const s = search.toLowerCase()
      data = data.filter(t =>
        [...WHO_FIELDS, 'Where', 'Event Type', 'Date'].some(f => t[f]?.toLowerCase().includes(s))
      )
    }
    data.sort((a, b) => {
      let av = a[sortField] || ''
      let bv = b[sortField] || ''
      if (sortField === 'Date') { av = new Date(av); bv = new Date(bv) }
      else if (sortField === 'Amount') {
        av = parseFloat(av.replace(/[$,]/g,'')) || 0
        bv = parseFloat(bv.replace(/[$,]/g,'')) || 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [tickets, sortField, sortDir, search, filterType, filterTag])

  const stats = useMemo(() => {
    if (!tickets.length) return null
    let data = [...tickets]
    if (statsFilterType !== 'All') data = data.filter(t => t['Event Type'] === statsFilterType)
    const artists = {}, venues = {}, years = {}, types = {}
    const priced = []
    data.forEach(t => {
      WHO_FIELDS.forEach(f => { const a = t[f]?.trim(); if (a) artists[a] = (artists[a] || 0) + 1 })
      const v = t['Where']?.trim(); if (v) venues[v] = (venues[v] || 0) + 1
      const y = t['Date']?.split('/')?.[2]?.substring(0,4) || t['Date']?.substring(0,4)
      if (y && y.length === 4) years[y] = (years[y] || 0) + 1
      const type = t['Event Type']?.trim(); if (type) types[type] = (types[type] || 0) + 1
      const amt = parseFloat((t['Amount'] || '').replace(/[$,]/g,'')) || 0
      if (amt > 0) priced.push({ amt, ticket: t })
    })
    priced.sort((a, b) => b.amt - a.amt)
    return {
      allArtists: Object.entries(artists).sort((a,b) => b[1]-a[1]),
      allVenues: Object.entries(venues).sort((a,b) => b[1]-a[1]),
      allYears: Object.entries(years).sort((a,b) => b[1]-a[1]),
      allTypes: Object.entries(types).sort((a,b) => b[1]-a[1]),
      priced, total: data.length
    }
  }, [tickets, statsFilterType])

  if (!tenant) return <PasswordGate onUnlock={setTenantId} />
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-emerald-400 text-xl animate-pulse">Loading your ticket history...</div>
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-red-400 text-xl text-center">Error: {error}</div>
    </div>
  )

  const isEmpty = tickets.length === 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {selectedTicket && isMobile && (
        <MobileDrawer
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onEdit={handleEdit}
        />
      )}

      {formMode && (
        <TicketForm
          mode={formMode}
          ticket={formTicket}
          tenantId={tenantId}
          knownTypes={knownTypes}
          knownVenues={knownVenues}
          knownArtists={knownArtists}
          knownAdmissions={knownAdmissions}
          onClose={() => { setFormMode(null); setFormTicket(null) }}
          onSaved={handleSaved}
        />
      )}

      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-emerald-400">🎟 {tenant.title}</h1>
            <p className="text-gray-400 text-sm">{tickets.length} events tracked</p>
          </div>
          <div className="flex gap-2">
            {!isEmpty && (
              <>
                <button onClick={() => setView('list')}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${view==='list' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                  List
                </button>
                <button onClick={() => setView('stats')}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${view==='stats' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                  Stats
                </button>
              </>
            )}
            <button onClick={handleAdd}
              className="px-3 py-1.5 rounded text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white">
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {isEmpty && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎟</div>
            <h2 className="text-xl font-bold text-white mb-2">No events yet</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
              Add your first event and it'll show up here.
            </p>
            <button onClick={handleAdd}
              className="px-5 py-3 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white">
              + Add an event
            </button>
          </div>
        )}

        {!isEmpty && view === 'list' && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input type="text" placeholder="Search artist, venue..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                {eventTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                {allTags.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={sortField} onChange={e => setSortField(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                {SORT_FIELDS.map(f => <option key={f}>{f}</option>)}
              </select>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm hover:bg-gray-700">
                {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>

            <p className="text-gray-500 text-sm mb-3">Showing {filtered.length} of {tickets.length} — tap a row for details</p>

            <div className="grid gap-3">
              {filtered.map((t, i) => {
                const isExpRow = expandedRow === t
                return (
                  <div key={t._row ?? i}
                    className={`bg-gray-900 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${isExpRow ? 'border-emerald-600' : 'border-gray-800 hover:border-emerald-800'}`}
                    onClick={() => handleRowClick(t)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <div className="text-emerald-400 text-sm font-mono w-24 shrink-0">{t['Date']}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{t['Who 1']}</div>
                        {(t['Who 2'] || t['Who 3'] || t['Who 4'] || t['Who 5']) && (
                          <div className="text-gray-400 text-sm">
                            with {[t['Who 2'],t['Who 3'],t['Who 4'],t['Who 5']].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-300 text-sm">{t['Where']}</div>
                      <div className="flex items-center gap-3">
                        {t['Amount'] && <div className="text-emerald-300 text-sm font-mono">{t['Amount']}</div>}
                        <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">{t['Event Type']}</span>
                      </div>
                    </div>
                    {isExpRow && !isMobile && (
                      <div className="mt-3 border-t border-gray-800">
                        <DetailContent ticket={t} onEdit={handleEdit} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!isEmpty && view === 'stats' && stats && (
          <>
            <div className="flex gap-3 mb-6">
              <select value={statsFilterType} onChange={e => setStatsFilterType(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                {eventTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              <span className="text-gray-500 text-sm self-center">
                Showing stats for {stats.total} event{stats.total !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title="Total Events" value={stats.total} icon="🎟" />

              <ExpandableList
                title="🎸 Top Artists"
                subtitle="Click to see all their shows"
                items={stats.allArtists}
                expandKey="artists"
                expanded={expanded}
                onToggle={toggleExpand}
                onItemClick={handleStatArtistClick}
              />

              <ExpandableList
                title="🏟 Top Venues"
                subtitle="Click to see all shows at this venue"
                items={stats.allVenues}
                expandKey="venues"
                expanded={expanded}
                onToggle={toggleExpand}
                onItemClick={handleStatVenueClick}
              />

              <ExpandableList
                title="📅 Shows Per Year"
                subtitle="Click a year to see all shows"
                items={stats.allYears}
                expandKey="years"
                expanded={expanded}
                onToggle={toggleExpand}
                valueSuffix=" shows"
                onItemClick={handleStatYearClick}
              />

              <ExpandableList
                title="🎭 Event Breakdown"
                subtitle="Click a type to see all shows"
                items={stats.allTypes}
                expandKey="types"
                expanded={expanded}
                onToggle={toggleExpand}
                valueSuffix=""
                onItemClick={handleStatTypeClick}
              />

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-gray-400 text-sm">💰 Top Ticket Prices</h3>
                  <button onClick={() => toggleExpand('prices')}
                    className="text-emerald-500 text-xs hover:text-emerald-300 transition-colors">
                    {expanded['prices'] ? '▲ Show less' : `▼ All ${stats.priced.length}`}
                  </button>
                </div>
                <p className="text-gray-600 text-xs mb-2 italic">Click a show to see details</p>
                <div className={expanded['prices'] ? 'max-h-96 overflow-y-auto pr-1' : ''}>
                  {(expanded['prices'] ? stats.priced : stats.priced.slice(0, 5)).map(({ amt, ticket }, i) => (
                    <div key={i}
                      className="py-1.5 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-gray-800 rounded px-1 -mx-1 transition-colors"
                      onClick={() => handlePriceTicketClick(ticket)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 mr-2">
                          <span className="text-gray-600 text-xs mr-2">{i + 1}.</span>
                          <span className="text-white text-sm">{ticket['Who 1']}</span>
                          <span className="text-gray-500 text-xs ml-2">{ticket['Event Type']}</span>
                        </div>
                        <span className="text-emerald-400 text-sm font-bold shrink-0">{ticket['Amount']}</span>
                      </div>
                      <div className="text-gray-600 text-xs ml-4">{ticket['Where']} · {ticket['Date']}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExpandableList({ title, subtitle, items, expandKey, expanded, onToggle, valueSuffix = 'x', onItemClick }) {
  const isExpanded = expanded[expandKey]
  const visible = isExpanded ? items : items.slice(0, 5)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-gray-400 text-sm">{title}</h3>
        <button onClick={() => onToggle(expandKey)}
          className="text-emerald-500 text-xs hover:text-emerald-300 transition-colors">
          {isExpanded ? '▲ Show less' : `▼ All ${items.length}`}
        </button>
      </div>
      {subtitle && <p className="text-gray-600 text-xs mb-2 italic">{subtitle}</p>}
      <div className={isExpanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
        {visible.map(([name, count], i) => (
          <div key={name}
            className={`flex justify-between py-1 border-b border-gray-800 last:border-0 ${onItemClick ? 'cursor-pointer hover:bg-gray-800 rounded px-1 -mx-1 transition-colors' : ''}`}
            onClick={() => onItemClick?.(name)}
          >
            <span className="text-white text-sm">
              <span className="text-gray-600 text-xs mr-2">{i + 1}.</span>
              {name}
              {onItemClick && <span className="text-gray-600 text-xs ml-1">↗</span>}
            </span>
            <span className="text-emerald-400 text-sm font-bold shrink-0 ml-2">{count}{valueSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="text-gray-400 text-sm">{title}</div>
        <div className="text-white text-3xl font-bold">{value}</div>
      </div>
    </div>
  )
}
