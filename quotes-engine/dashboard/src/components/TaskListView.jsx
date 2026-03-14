import { useState } from 'react'
import { PHASE_COLORS } from '../lib/scheduler'
import { StatusBadge, PhaseBadge } from './PhaseBadge'

/**
 * TaskListView — Table/list view of all tasks.
 * Responsive: table on desktop, stacked cards on mobile.
 * Click any row to open the task detail modal.
 */

export default function TaskListView({ tasks, onTaskClick, searchQuery, dayLabels }) {
  const [sortField, setSortField] = useState('task_no')
  const [sortDir, setSortDir] = useState('asc')

  // Filter
  const filtered = searchQuery
    ? tasks.filter(t =>
        t.task_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.task_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks

  // Sort
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
    if (sortField !== field) return <span className="text-gray-700 ml-0.5">↕</span>
    return <span className="text-blue-400 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('task_no')}>
                # <SortIcon field="task_no" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('task_name')}>
                Task <SortIcon field="task_name" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('phase_no')}>
                Phase <SortIcon field="phase_no" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('assigned_to')}>
                Assigned <SortIcon field="assigned_to" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide cursor-pointer hover:text-gray-300" onClick={() => handleSort('estimated_days')}>
                Days <SortIcon field="estimated_days" />
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {sorted.map((task) => {
              const phaseColor = PHASE_COLORS[task.phase_no] || '#666'
              return (
                <tr
                  key={task.task_no || task.id}
                  onClick={() => onTaskClick?.(task)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{task.task_no}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-200 group-hover:text-white transition-colors">{task.task_name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <PhaseBadge phase={task.phase_no} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {task.assigned_to ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center text-[9px] font-bold text-blue-400">
                          {task.assigned_to.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-400 truncate max-w-[100px]">{task.assigned_to}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 text-center">
                    {task.estimated_days || 2}d
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">
                    {task.notes || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden divide-y divide-gray-800/50">
        {sorted.map((task) => {
          const phaseColor = PHASE_COLORS[task.phase_no] || '#666'
          return (
            <div
              key={task.task_no || task.id}
              onClick={() => onTaskClick?.(task)}
              className="px-4 py-3 active:bg-gray-800/50 cursor-pointer"
              style={{ borderLeftWidth: '3px', borderLeftColor: phaseColor }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 font-medium">{task.task_name}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{task.task_no}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
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
        <div className="text-center py-12 text-gray-600">
          <p className="text-sm">No tasks match your filters</p>
        </div>
      )}
    </div>
  )
}
