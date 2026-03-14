import { useState, useRef, useEffect } from 'react'
import { getPhaseColor } from '../lib/scheduler'
import { StatusBadge } from './PhaseBadge'

/**
 * GanttBar v3 — Enhanced task bar with rich hover tooltip, theme support, progress overlay.
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
    if (!dateStr) return '\u2014'
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

  // Milestone diamond rendering
  if (task.is_milestone) {
    return (
      <div
        ref={barRef}
        style={{ gridColumn: `${colStart} / span 1` }}
        className="flex items-center justify-center cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div
          className="w-5 h-5 rotate-45 hover:scale-125 transition-transform"
          style={{ backgroundColor: task.bar_color }}
        />
      </div>
    )
  }

  // Task progress for progress bar overlay
  const progress = task.progress || (task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0)

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
          outline: task.is_overdue ? '2px solid #ef4444' : 'none',
          outlineOffset: '1px',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {statusIcon && <span className="mr-1 text-sm">{statusIcon}</span>}
        {colSpan >= 2 ? task.bar_label : ''}

        {/* Progress bar overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15 rounded-b">
          <div
            className="h-full bg-white/50 rounded-b transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Rich Floating Tooltip */}
      {showTooltip && (
        <div
          className="fixed z-[100] w-72 rounded-xl shadow-2xl overflow-hidden pointer-events-auto animate-tooltip-in"
          style={{
            backgroundColor: 'var(--tooltip-bg)',
            border: `1px solid var(--tooltip-border)`,
            left: tooltipPos.align === 'right' ? 'auto' : `${barRef.current?.getBoundingClientRect().left || 0}px`,
            right: tooltipPos.align === 'right' ? `${window.innerWidth - (barRef.current?.getBoundingClientRect().right || 0)}px` : 'auto',
            top: tooltipPos.vAlign === 'above' ? 'auto' : `${(barRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
            bottom: tooltipPos.vAlign === 'above' ? `${window.innerHeight - (barRef.current?.getBoundingClientRect().top || 0) + 4}px` : 'auto',
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b" style={{ backgroundColor: `${task.bar_color}15`, borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{task.task_no}</p>
                <p className="text-sm font-semibold mt-0.5 leading-tight" style={{ color: 'var(--text-primary)' }}>{task.name}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-2.5">
            <TooltipRow label="Schedule" value={`${formatDate(startLabel)} \u2192 ${formatDate(endLabel)}`} />
            <TooltipRow label="Duration" value={`${duration} day${duration !== 1 ? 's' : ''} \u00B7 ${estimatedHours}h est.`} />
            <TooltipRow label="Assigned" custom>
              {task.assigned_to ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-[9px] font-bold text-blue-400">
                    {task.assigned_to.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>{task.assigned_to}</span>
                </div>
              ) : (
                <span className="italic" style={{ color: 'var(--text-muted)' }}>Unassigned</span>
              )}
            </TooltipRow>
            <TooltipRow label="Phase">
              <span className="font-medium" style={{ color: task.bar_color }}>
                Phase {task.phase_no} {task.phase_name ? `\u2014 ${task.phase_name}` : ''}
              </span>
            </TooltipRow>
            {task.budget && <TooltipRow label="Budget" value={`$${Number(task.budget).toLocaleString()}`} />}
            {task.notes && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
                <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{task.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t text-center" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-primary)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Click for full details</p>
          </div>
        </div>
      )}
    </>
  )
}

function TooltipRow({ label, value, custom, children }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {custom || children ? (
        <div className="flex-1">{children}</div>
      ) : (
        <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{value}</span>
      )}
    </div>
  )
}
