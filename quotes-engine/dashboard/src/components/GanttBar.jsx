import { useState, useRef, useEffect } from 'react'
import { PHASE_COLORS } from '../lib/scheduler'
import { StatusBadge } from './PhaseBadge'

/**
 * GanttBar v2 — Enhanced task bar with rich hover tooltip + click-to-open detail.
 *
 * Hover: Shows rich floating tooltip with task details, people, dates, budget.
 * Click: Opens the TaskDetailModal via onTaskClick callback.
 * Touch: Tap shows tooltip, second tap opens modal.
 */
export default function GanttBar({ task, totalDays, dayLabels, onTaskClick }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ align: 'left', vAlign: 'below' })
  const barRef = useRef(null)
  const hideTimeout = useRef(null)

  const colStart = task.bar_start + 1 // CSS grid is 1-indexed
  const colSpan = task.bar_end - task.bar_start + 1

  const statusIcon = {
    completed: '\u2713',
    in_progress: '\u25B6',
    blocked: '\u26A0',
    waiting: '\u23F3',
  }[task.status] || ''

  const startLabel = dayLabels[task.bar_start]?.full || ''
  const endLabel = dayLabels[task.bar_end]?.full || ''
  const duration = colSpan
  const estimatedHours = task.estimated_hours || (duration * 8)

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Position tooltip to avoid viewport edges
  function updateTooltipPosition() {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    setTooltipPos({
      align: rect.left > viewW / 2 ? 'right' : 'left',
      vAlign: rect.bottom > viewH - 280 ? 'above' : 'below',
    })
  }

  function handleMouseEnter() {
    clearTimeout(hideTimeout.current)
    updateTooltipPosition()
    setShowTooltip(true)
  }

  function handleMouseLeave() {
    hideTimeout.current = setTimeout(() => setShowTooltip(false), 150)
  }

  function handleTooltipEnter() {
    clearTimeout(hideTimeout.current)
  }

  function handleTooltipLeave() {
    hideTimeout.current = setTimeout(() => setShowTooltip(false), 100)
  }

  function handleClick(e) {
    e.stopPropagation()
    onTaskClick?.(task)
  }

  useEffect(() => {
    return () => clearTimeout(hideTimeout.current)
  }, [])

  return (
    <>
      <div
        ref={barRef}
        className="relative h-8 rounded cursor-pointer transition-all hover:brightness-110 hover:scale-y-110 flex items-center px-2 text-xs font-medium text-white/90 overflow-hidden whitespace-nowrap select-none"
        style={{
          gridColumn: `${colStart} / span ${colSpan}`,
          backgroundColor: task.bar_color,
          opacity: task.status === 'completed' ? 0.55 : 1,
          boxShadow: showTooltip ? `0 0 0 2px ${task.bar_color}88, 0 4px 12px ${task.bar_color}40` : 'none',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {statusIcon && <span className="mr-1 text-sm">{statusIcon}</span>}
        {colSpan >= 2 ? task.bar_label : ''}

        {/* Progress indicator for in-progress tasks */}
        {task.status === 'in_progress' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full bg-white/60 w-1/2 animate-pulse" />
          </div>
        )}
      </div>

      {/* Rich Floating Tooltip */}
      {showTooltip && (
        <div
          className="fixed z-[100] w-72 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
          style={{
            left: tooltipPos.align === 'right' ? 'auto' : `${barRef.current?.getBoundingClientRect().left || 0}px`,
            right: tooltipPos.align === 'right' ? `${window.innerWidth - (barRef.current?.getBoundingClientRect().right || 0)}px` : 'auto',
            top: tooltipPos.vAlign === 'above' ? 'auto' : `${(barRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
            bottom: tooltipPos.vAlign === 'above' ? `${window.innerHeight - (barRef.current?.getBoundingClientRect().top || 0) + 4}px` : 'auto',
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700/50" style={{ backgroundColor: `${task.bar_color}15` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-mono">{task.task_no}</p>
                <p className="text-sm font-semibold text-white mt-0.5 leading-tight">{task.name}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-2.5">
            <TooltipRow label="Schedule" value={`${formatDate(startLabel)} → ${formatDate(endLabel)}`} />
            <TooltipRow label="Duration" value={`${duration} day${duration !== 1 ? 's' : ''} · ${estimatedHours}h est.`} />
            <TooltipRow label="Assigned" custom>
              {task.assigned_to ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-[9px] font-bold text-blue-400">
                    {task.assigned_to.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-300">{task.assigned_to}</span>
                </div>
              ) : (
                <span className="text-gray-600 italic">Unassigned</span>
              )}
            </TooltipRow>
            <TooltipRow label="Phase">
              <span className="font-medium" style={{ color: task.bar_color }}>
                Phase {task.phase_no} {task.phase_name ? `— ${task.phase_name}` : ''}
              </span>
            </TooltipRow>
            {task.budget && <TooltipRow label="Budget" value={`$${Number(task.budget).toLocaleString()}`} />}
            {task.notes && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{task.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-800 text-center">
            <p className="text-[10px] text-gray-500">Click for full details</p>
          </div>
        </div>
      )}
    </>
  )
}

function TooltipRow({ label, value, custom, children }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      {custom || children ? (
        <div className="flex-1">{children}</div>
      ) : (
        <span className="text-gray-300 flex-1">{value}</span>
      )}
    </div>
  )
}
