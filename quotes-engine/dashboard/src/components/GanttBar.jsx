import { useState } from 'react'

export default function GanttBar({ task, totalDays, dayLabels }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const colStart = task.bar_start + 1 // CSS grid is 1-indexed
  const colSpan = task.bar_end - task.bar_start + 1

  const statusIcon = {
    completed: '\u2713',
    in_progress: '\u25B6',
    blocked: '\u26A0',
  }[task.status] || ''

  const startLabel = dayLabels[task.bar_start]?.date || ''
  const endLabel = dayLabels[task.bar_end]?.date || ''

  return (
    <div
      className="relative h-7 rounded cursor-pointer transition-opacity hover:opacity-90 flex items-center px-2 text-xs font-medium text-white/90 overflow-hidden whitespace-nowrap"
      style={{
        gridColumn: `${colStart} / span ${colSpan}`,
        backgroundColor: task.bar_color,
        opacity: task.status === 'completed' ? 0.6 : 1,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {statusIcon && <span className="mr-1">{statusIcon}</span>}
      {colSpan >= 2 ? task.bar_label : ''}

      {showTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 text-left pointer-events-none">
          <p className="font-semibold text-sm text-white mb-1">{task.name}</p>
          <div className="space-y-1 text-xs text-gray-400">
            <p>Status: <span className="text-gray-200">{task.status}</span></p>
            <p>Duration: <span className="text-gray-200">{colSpan} day{colSpan !== 1 ? 's' : ''}</span></p>
            <p>Period: <span className="text-gray-200">{startLabel} — {endLabel}</span></p>
            {task.assigned_to && <p>Assigned: <span className="text-gray-200">{task.assigned_to}</span></p>}
            {task.notes && <p className="text-gray-300 mt-1 border-t border-gray-700 pt-1">{task.notes}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
