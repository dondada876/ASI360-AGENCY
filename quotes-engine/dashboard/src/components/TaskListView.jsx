import { useState } from 'react'
import { getPhaseColor } from '../lib/scheduler'
import { StatusBadge, PhaseBadge } from './PhaseBadge'

/**
 * TaskListView v3 — Table/list view with theme support.
 */

export default function TaskListView({ tasks, onTaskClick, searchQuery, dayLabels }) {
  const [sortField, setSortField] = useState('task_no')
  const [sortDir, setSortDir] = useState('asc')

  const filtered = searchQuery
    ? tasks.filter(t =>
        t.task_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.task_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal
    switch (sortField) {
      case 'task_no':
        aVal = a.task_no || ''
        bVal = b.task_no || ''
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      case 'task_name':
        aVal = a.task_name || ''
        bVal = b.task_name || ''
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      case 'phase_no':
        aVal = a.phase_no || 0
        bVal = b.phase_no || 0
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      case 'status':
        aVal = a.status || 'open'
        bVal = b.status || 'open'
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      case 'assigned_to':
        aVal = a.assigned_to || 'zzz'
        bVal = b.assigned_to || 'zzz'
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      case 'estimated_days':
        aVal = a.estimated_days || 0
        bVal = b.estimated_days || 0
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      default:
        return 0
    }
  })

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span className="ml-0.5" style={{ color: 'var(--text-muted)' }}>\u2195</span>
    return <span className="text-blue-400 ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--border-primary)' }}>
              {[
                { field: 'task_no', label: '#' },
                { field: 'task_name', label: 'Task' },
                { field: 'phase_no', label: 'Phase' },
                { field: 'status', label: 'Status' },
                { field: 'assigned_to', label: 'Assigned' },
                { field: 'estimated_days', label: 'Days' },
              ].map(col => (
                <th
                  key={col.field}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleSort(col.field)}
                >
                  {col.label} <SortIcon field={col.field} />
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr
                key={task.task_no || task.id}
                onClick={() => onTaskClick?.(task)}
                className="cursor-pointer transition-colors group border-b last:border-b-0"
                style={{ borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-1.5">
                    {task.task_no}
                    {task.is_milestone && <div className="w-2.5 h-2.5 rotate-45 shrink-0" style={{ backgroundColor: '#a855f7' }} title="Milestone" />}
                    {task.risk_level && task.risk_level !== 'normal' && (
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${task.risk_level === 'critical' ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: task.risk_level === 'critical' ? '#ef4444' : task.risk_level === 'high' ? '#f97316' : '#eab308' }}
                        title={`Risk: ${task.risk_level}`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span style={{ color: 'var(--text-primary)' }}>{task.task_name}</span>
                </td>
                <td className="px-4 py-2.5"><PhaseBadge phase={task.phase_no} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-2.5">
                  {task.assigned_to ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center text-[9px] font-bold text-blue-400">
                        {task.assigned_to.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs truncate max-w-[100px]" style={{ color: 'var(--text-secondary)' }}>{task.assigned_to}</span>
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>\u2014</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                  {task.estimated_days || 2}d
                </td>
                <td className="px-4 py-2.5 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {task.notes || '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden">
        {sorted.map((task) => {
          const phaseColor = getPhaseColor(task.phase_no)
          return (
            <div
              key={task.task_no || task.id}
              onClick={() => onTaskClick?.(task)}
              className="px-4 py-3 cursor-pointer border-b last:border-b-0"
              style={{ borderLeftWidth: '3px', borderLeftColor: phaseColor, borderBottomColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.task_name}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.task_no}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <PhaseBadge phase={task.phase_no} />
                {task.assigned_to && (
                  <span className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-blue-600/30 flex items-center justify-center text-[8px] font-bold text-blue-400">
                      {task.assigned_to.charAt(0).toUpperCase()}
                    </div>
                    {task.assigned_to}
                  </span>
                )}
                <span>{task.estimated_days || 2}d</span>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">No tasks match your filters</p>
        </div>
      )}
    </div>
  )
}
