import { useState, useRef, useEffect } from 'react'

/**
 * ViewControls — View toggle (Gantt/Kanban/List) + Search + Phase/Status filters.
 * Responsive: collapses to stacked on mobile.
 */

const VIEWS = [
  { key: 'gantt',  label: 'Gantt',  icon: '▦' },
  { key: 'kanban', label: 'Kanban', icon: '▨' },
  { key: 'list',   label: 'List',   icon: '☰' },
]

const PHASE_OPTIONS = [
  { value: '', label: 'All Phases' },
  { value: '1', label: 'Phase 1 — Scope & Design' },
  { value: '2', label: 'Phase 2 — Build & Test' },
  { value: '3', label: 'Phase 3 — Ship & Close' },
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

  // Keyboard shortcut: Ctrl+K to focus search
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
    <div className="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden">
      {/* Top bar: view toggle + search */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* View toggle */}
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeView === v.key
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
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
            placeholder="Search tasks... (⌘K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 4l6 6M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filter toggle button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
            hasActiveFilters
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              : showFilters
                ? 'bg-gray-800 text-gray-300 border-gray-600'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center">
              {(searchQuery ? 1 : 0) + (phaseFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Task count */}
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {filteredCount !== taskCount
            ? `${filteredCount} of ${taskCount}`
            : taskCount
          } tasks
        </span>
      </div>

      {/* Expandable filter row */}
      {showFilters && (
        <div className="border-t border-gray-800 px-4 py-3 flex flex-wrap items-center gap-3 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Phase:</label>
            <select
              value={phaseFilter}
              onChange={(e) => onPhaseChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
            >
              {PHASE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
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
              className="text-xs text-gray-500 hover:text-white transition-colors underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
