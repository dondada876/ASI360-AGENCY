import { useState, useRef, useEffect } from 'react'

/**
 * ViewControls v3 — View toggle + Search + Phase/Status filters with theme support.
 */

const VIEWS = [
  { key: 'gantt',  label: 'Gantt',  icon: '\u25A6' },
  { key: 'kanban', label: 'Kanban', icon: '\u25A8' },
  { key: 'list',   label: 'List',   icon: '\u2630' },
]

const PHASE_OPTIONS = [
  { value: '', label: 'All Phases' },
  { value: '1', label: 'Phase 1 \u2014 Scope & Design' },
  { value: '2', label: 'Phase 2 \u2014 Build & Test' },
  { value: '3', label: 'Phase 3 \u2014 Ship & Close' },
  { value: '4', label: 'Phase 4' },
  { value: '5', label: 'Phase 5' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
]

export default function ViewControls({
  activeView,
  onViewChange,
  searchQuery,
  onSearchChange,
  phaseFilter,
  onPhaseChange,
  statusFilter,
  onStatusChange,
  taskCount,
  filteredCount,
}) {
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const hasActiveFilters = searchQuery || phaseFilter || statusFilter

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* View toggle */}
        <div className="flex rounded-lg p-0.5" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: activeView === v.key ? 'var(--bg-input)' : 'transparent',
                color: activeView === v.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeView === v.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <span className="text-sm leading-none">{v.icon}</span>
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search tasks... (\u2318K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 4l6 6M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5"
          style={{
            backgroundColor: hasActiveFilters ? 'rgba(59,130,246,0.1)' : 'var(--bg-card-hover)',
            color: hasActiveFilters ? '#3b82f6' : 'var(--text-secondary)',
            borderColor: hasActiveFilters ? 'rgba(59,130,246,0.3)' : 'var(--border-primary)',
          }}
        >
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
              {(searchQuery ? 1 : 0) + (phaseFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Task count */}
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
          {filteredCount !== taskCount
            ? `${filteredCount} of ${taskCount}`
            : taskCount
          } tasks
        </span>
      </div>

      {/* Expandable filter row */}
      {showFilters && (
        <div className="border-t px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Phase:</label>
            <select
              value={phaseFilter}
              onChange={(e) => onPhaseChange(e.target.value)}
              className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500/50"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}
            >
              {PHASE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500/50"
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                onSearchChange('')
                onPhaseChange('')
                onStatusChange('')
              }}
              className="text-xs underline transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
