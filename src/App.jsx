import { useState, useEffect, useMemo } from 'react'
import { fetchTickets } from './sheets'

const SORT_FIELDS = ['Date', 'Who 1', 'Where', 'Event Type', 'Amount']
const WHO_FIELDS = ['Who 1', 'Who 2', 'Who 3', 'Who 4', 'Who 5']
const APP_PASSWORD = 'f0r0ur5h0W5!'

function getExternalUrl(ticket) {
  const type = ticket['Event Type']?.toLowerCase()
  const isConcert = type === 'concert'
  const isWrestling = type === 'wrestling'

  if (!isConcert && !isWrestling) return null

  const direct = ticket['Setlist URL']?.trim()
  if (direct) return { href: direct, type: 'direct' }

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
    const href = `https://www.setlist.fm/search?query=${query}&year=${year}&month=${month}&day=${day}`
    return { href, type: 'setlist' }
  }

  if (isWrestling) {
    return { href: 'https://www.cagematch.net/?id=1&view=results', type: 'cagematch' }
  }

  return null
}

function ExternalLink({ ticket }) {
  const link = getExternalUrl(ticket)
  if (!link) return null

  const icons = {
    direct: { emoji: '🎵', title: 'View details' },
    setlist: { emoji: '🔍', title: 'Search setlist.fm' },
    cagematch: { emoji: '🤼', title: 'Search Cagematch' },
  }

  const { emoji, title } = icons[link.type]

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="text-lg hover:scale-110 transition-transform"
    >
      {emoji}
    </a>
  )
}

function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = () => {
    if (input === APP_PASSWORD) {
      sessionStorage.setItem('ti_auth', '1')
      onUnlock()
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🎟</div>
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Ticket Inventory</h1>
        <p className="text-gray-500 text-sm mb-6">Enter password to continue</p>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password"
          autoFocus
          className={`w-full bg-gray-800 border rounded px-4 py-3 text-center text-white focus:outline-none mb-4 transition-colors ${
            error ? 'border-red-500' : 'border-gray-700 focus:border-emerald-500'
          }`}
        />
        {error && <p className="text-red-400 text-sm mb-3">Incorrect password</p>}
        <button
          onClick={handleSubmit}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded transition-colors">
          Enter
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ti_auth') === '1')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortField, setSortField] = useState('Date')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [statsFilterType, setStatsFilterType] = useState('All')
  const [view, setView] = useState('list')
  const [expanded, setExpanded] = useState({})

  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    if (!authed) return
    fetchTickets()
      .then(setTickets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [authed])

  const eventTypes = useMemo(() => {
    const types = [...new Set(tickets.map(t => t['Event Type']).filter(Boolean))]
    return ['All', ...types.sort()]
  }, [tickets])

  const filtered = useMemo(() => {
    let data = [...tickets]
    if (filterType !== 'All') data = data.filter(t => t['Event Type'] === filterType)
    if (search) {
      const s = search.toLowerCase()
      data = data.filter(t =>
        [...WHO_FIELDS, 'Where', 'Event Type'].some(f => t[f]?.toLowerCase().includes(s))
      )
    }
    data.sort((a, b) => {
      let av = a[sortField] || ''
      let bv = b[sortField] || ''
      if (sortField === 'Date') {
        av = new Date(av); bv = new Date(bv)
      } else if (sortField === 'Amount') {
        av = parseFloat(av.replace(/[$,]/g,'')) || 0
        bv = parseFloat(bv.replace(/[$,]/g,'')) || 0
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [tickets, sortField, sortDir, search, filterType])

  const stats = useMemo(() => {
    if (!tickets.length) return null
    let data = [...tickets]
    if (statsFilterType !== 'All') data = data.filter(t => t['Event Type'] === statsFilterType)
    const artists = {}, venues = {}, years = {}, types = {}
    const priced = []

    data.forEach(t => {
      WHO_FIELDS.forEach(f => {
        const a = t[f]?.trim()
        if (a) artists[a] = (artists[a] || 0) + 1
      })
      const v = t['Where']?.trim()
      if (v) venues[v] = (venues[v] || 0) + 1
      const y = t['Date']?.split('/')?.[2]?.substring(0,4) || t['Date']?.substring(0,4)
      if (y && y.length === 4) years[y] = (years[y] || 0) + 1
      const type = t['Event Type']?.trim()
      if (type) types[type] = (types[type] || 0) + 1
      const amt = parseFloat((t['Amount'] || '').replace(/[$,]/g,'')) || 0
      if (amt > 0) priced.push({ amt, ticket: t })
    })

    priced.sort((a, b) => b.amt - a.amt)

    const allArtists = Object.entries(artists).sort((a,b) => b[1]-a[1])
    const allVenues = Object.entries(venues).sort((a,b) => b[1]-a[1])
    const allYears = Object.entries(years).sort((a,b) => b[1]-a[1])
    const allTypes = Object.entries(types).sort((a,b) => b[1]-a[1])

    return { allArtists, allVenues, allYears, allTypes, priced, total: data.length }
  }, [tickets, statsFilterType])

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-emerald-400 text-xl animate-pulse">Loading your ticket history...</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-red-400 text-xl">Error: {error}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-emerald-400">🎟 Ticket Inventory</h1>
            <p className="text-gray-400 text-sm">{tickets.length} events tracked</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${view==='list' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
              List
            </button>
            <button onClick={() => setView('stats')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${view==='stats' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
              Stats
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {view === 'list' && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text" placeholder="Search artist, venue..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                {eventTypes.map(t => <option key={t}>{t}</option>)}
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

            <p className="text-gray-500 text-sm mb-3">Showing {filtered.length} of {tickets.length}</p>

            <div className="grid gap-3">
              {filtered.map((t, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-emerald-800 transition-colors">
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
                      <ExternalLink ticket={t} />
                    </div>
                  </div>
                  {t['Notes'] && <div className="text-gray-500 text-xs mt-1 italic">{t['Notes']}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'stats' && stats && (
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
                subtitle="Counts all appearances (headliner + opener)"
                items={stats.allArtists}
                expandKey="artists"
                expanded={expanded}
                onToggle={toggleExpand}
              />

              <ExpandableList
                title="🏟 Top Venues"
                items={stats.allVenues}
                expandKey="venues"
                expanded={expanded}
                onToggle={toggleExpand}
              />

              <ExpandableList
                title="📅 Shows Per Year"
                items={stats.allYears}
                expandKey="years"
                expanded={expanded}
                onToggle={toggleExpand}
                valueSuffix=" shows"
              />

              <ExpandableList
                title="🎭 Event Breakdown"
                items={stats.allTypes}
                expandKey="types"
                expanded={expanded}
                onToggle={toggleExpand}
                valueSuffix=""
              />

              {/* Top Ticket Prices */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-gray-400 text-sm">💰 Top Ticket Prices</h3>
                  <button
                    onClick={() => toggleExpand('prices')}
                    className="text-emerald-500 text-xs hover:text-emerald-300 transition-colors">
                    {expanded['prices'] ? '▲ Show less' : `▼ All ${stats.priced.length}`}
                  </button>
                </div>
                <div className={expanded['prices'] ? 'max-h-96 overflow-y-auto pr-1' : ''}>
                  {(expanded['prices'] ? stats.priced : stats.priced.slice(0, 5)).map(({ amt, ticket }, i) => (
                    <div key={i} className="py-1.5 border-b border-gray-800 last:border-0">
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

function ExpandableList({ title, subtitle, items, expandKey, expanded, onToggle, valueSuffix = 'x' }) {
  const isExpanded = expanded[expandKey]
  const visible = isExpanded ? items : items.slice(0, 5)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-gray-400 text-sm">{title}</h3>
        <button
          onClick={() => onToggle(expandKey)}
          className="text-emerald-500 text-xs hover:text-emerald-300 transition-colors">
          {isExpanded ? '▲ Show less' : `▼ All ${items.length}`}
        </button>
      </div>
      {subtitle && <p className="text-gray-600 text-xs mb-2 italic">{subtitle}</p>}
      <div className={isExpanded ? 'max-h-96 overflow-y-auto pr-1' : ''}>
        {visible.map(([name, count], i) => (
          <div key={name} className="flex justify-between py-1 border-b border-gray-800 last:border-0">
            <span className="text-white text-sm">
              <span className="text-gray-600 text-xs mr-2">{i + 1}.</span>
              {name}
            </span>
            <span className="text-emerald-400 text-sm font-bold shrink-0 ml-2">
              {count}{valueSuffix}
            </span>
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
