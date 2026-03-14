import { useState, useRef } from 'react'
import { PHASE_COLORS } from '../lib/scheduler'
import { StatusBadge, PhaseBadge } from './PhaseBadge'

/**
 * KanbanBoard — Drag-and-drop task board with status columns.
 * HTML5 DnD API (zero dependencies). Touch-friendly with tap-to-move fallback.
 */

const COLUMNS = [
  { key: 'open',        label: 'To Do',       color: '#6b7280', emptyText: 'No open tasks' },
  { key: 'in_progress', label: 'In Progress', color: '#3b82f6', emptyText: 'Nothing in progress' },
  { key: 'blocked',     label: 'Blocked',     color: '#ef4444', emptyText: 'Nothing blocked' },
  { key: 'waiting',     label: 'Waiting',     color: '#eab308', emptyText: 'Nothing waiting' },
  { key: 'completed',   label: 'Done',        color: '#22c55e', emptyText: 'Nothing completed yet' },
]

export default function KanbanBoard({ tasks, onStatusChange, onTaskClick, searchQuery }) {
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragNode = useRef(null)

  // Filter tasks by search query
  const filteredTasks = searchQuery
    ? tasks.filter(t =>
        t.task_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.task_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks

  // Group tasks by status
  const columns = COLUMNS.map(col => ({
    ...col,
    tasks: filteredTasks
      .filter(t => normalizeStatus(t.status) === col.key)
      .sort((a, b) => {
        if (a.phase_no !== b.phase_no) return a.phase_no - b.phase_no
        return (a.task_no || '').localeCompare(b.task_no || '')
      }),
  }))

  function normalizeStatus(s) {
    const norm = (s || 'open').toLowerCase().replace(/\s+/g, '_')
    if (COLUMNS.find(c => c.key === norm)) return norm
    return 'open'
  }

  // ── Drag handlers ──
  function handleDragStart(e, task) {
    dragNode.current = e.target
    setDragging(task)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image slightly transparent
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = '0.4'
    }, 0)
  }

  function handleDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = '1'
    setDragging(null)
    setDragOver(null)
    dragNode.current = null
  }

  function handleDragOver(e, colKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colKey)
  }

  function handleDragLeave(e, colKey) {
    // Only clear if actually leaving the column
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null)
    }
  }

  function handleDrop(e, colKey) {
    e.preventDefault()
    if (dragging && normalizeStatus(dragging.status) !== colKey) {
      onStatusChange?.(dragging, colKey)
    }
    setDragOver(null)
  }

  // ── Touch fallback: tap a card, then tap a column ──
  const [touchSelected, setTouchSelected] = useState(null)

  function handleTouchSelect(task) {
    if (touchSelected?.task_no === task.task_no) {
      setTouchSelected(null) // Deselect
    } else {
      setTouchSelected(task)
    }
  }

  function handleColumnTap(colKey) {
    if (touchSelected && normalizeStatus(touchSelected.status) !== colKey) {
      onStatusChange?.(touchSelected, colKey)
      setTouchSelected(null)
    }
  }

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
      {/* Touch instructions */}
      {touchSelected && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 flex items-center gap-2">
          <span>Moving:</span>
          <span className="font-semibold">{touchSelected.task_name}</span>
          <span className="text-blue-500">— tap a column to move</span>
          <button
            onClick={() => setTouchSelected(null)}
            className="ml-auto text-blue-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {columns.map((col) => (
          <div
            key={col.key}
            className={`rounded-lg border transition-all min-h-[200px] ${
              dragOver === col.key
                ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
                : touchSelected && normalizeStatus(touchSelected.status) !== col.key
                  ? 'border-blue-500/30 bg-gray-800/30 cursor-pointer'
                  : 'border-gray-800 bg-gray-800/20'
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={(e) => handleDragLeave(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            onClick={() => handleColumnTap(col.key)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{col.label}</span>
              </div>
              <span className="text-xs text-gray-600 font-mono">{col.tasks.length}</span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2">
              {col.tasks.length === 0 ? (
                <p className="text-[10px] text-gray-600 text-center py-6">{col.emptyText}</p>
              ) : (
                col.tasks.map((task) => (
                  <KanbanCard
                    key={task.task_no || task.id}
                    task={task}
                    isDragging={dragging?.task_no === task.task_no}
                    isSelected={touchSelected?.task_no === task.task_no}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onTouchSelect={handleTouchSelect}
                    onTaskClick={onTaskClick}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Kanban Card ── */
function KanbanCard({ task, isDragging, isSelected, onDragStart, onDragEnd, onTouchSelect, onTaskClick }) {
  const phaseColor = PHASE_COLORS[task.phase_no] || '#666'

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      className={`rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all group ${
        isDragging
          ? 'opacity-40 scale-95'
          : isSelected
            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
            : 'border-gray-700/50 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
      }`}
      style={{ borderLeftWidth: '3px', borderLeftColor: phaseColor }}
    >
      {/* Task number + phase */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 font-mono">{task.task_no}</span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${phaseColor}25`, color: phaseColor }}
        >
          P{task.phase_no}
        </span>
      </div>

      {/* Task name */}
      <p className="text-xs text-gray-200 font-medium leading-snug line-clamp-2 mb-2">
        {task.task_name}
      </p>

      {/* Footer: assignee + actions */}
      <div className="flex items-center justify-between">
        {task.assigned_to ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center text-[9px] font-bold text-blue-400">
              {task.assigned_to.charAt(0).toUpperCase()}
            </div>
            <span className="text-[10px] text-gray-500 truncate max-w-[80px]">{task.assigned_to}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-600">Unassigned</span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Detail button */}
          <button
            onClick={(e) => { e.stopPropagation(); onTaskClick?.(task) }}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
            title="View details"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 5v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Move button (touch) */}
          <button
            onClick={(e) => { e.stopPropagation(); onTouchSelect?.(task) }}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white sm:hidden"
            title="Move task"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10M4.5 4.5L7 2l2.5 2.5M4.5 9.5L7 12l2.5-2.5M2 7l2.5-2.5M12 7l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Estimated days indicator */}
      {task.estimated_days && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
          <span>{task.estimated_days}d</span>
          {task.notes && <span title={task.notes}>📝</span>}
        </div>
      )}
    </div>
  )
}
