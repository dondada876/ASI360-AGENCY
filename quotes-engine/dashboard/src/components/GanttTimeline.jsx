import { PHASE_COLORS } from '../lib/scheduler'
import GanttBar from './GanttBar'

/**
 * GanttTimeline v2 — CSS grid Gantt chart with click-to-detail support.
 * Accepts onTaskClick to open the TaskDetailModal from any bar.
 */
export default function GanttTimeline({ timeline, onTaskClick, searchQuery }) {
  if (!timeline) return null

  const { periods, day_labels, phases, total_days } = timeline

  // Filter tasks by search query while preserving phase structure
  const filteredPhases = searchQuery
    ? phases.map(phase => ({
        ...phase,
        tasks: phase.tasks.filter(t =>
          t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.task_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(phase => phase.tasks.length > 0)
    : phases

  // Today marker position
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayIndex = day_labels.findIndex(d => d.full === todayStr)

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Week period headers */}
        <div className="flex border-b border-gray-800">
          <div className="w-52 shrink-0 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-r border-gray-800">
            Task
          </div>
          <div className="flex-1 flex">
            {periods.map((p, i) => (
              <div
                key={i}
                className="text-center text-xs font-bold text-gray-400 py-2 border-r border-gray-800/50"
                style={{ width: `${(p.span / total_days) * 100}%` }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Day labels row */}
        <div className="flex border-b border-gray-700">
          <div className="w-52 shrink-0 bg-gray-900 border-r border-gray-800" />
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}>
            {day_labels.map((d, i) => (
              <div
                key={i}
                className={`text-center text-[10px] py-1 border-r border-gray-800/30 ${
                  i === todayIndex ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500'
                }`}
              >
                <div className="font-medium">{d.day}</div>
                <div>{d.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase rows */}
        {filteredPhases.map((phase) => (
          <div key={phase.number} className="border-b border-gray-800/50 last:border-b-0">
            {/* Phase header */}
            <div className="flex items-center border-b border-gray-800/30">
              <div
                className="w-52 shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white border-r border-gray-800"
                style={{
                  backgroundColor: (PHASE_COLORS[phase.number] || '#434343') + '40',
                  borderLeft: `3px solid ${PHASE_COLORS[phase.number] || '#434343'}`,
                }}
              >
                {phase.is_milestone ? phase.name : `Phase ${phase.number} — ${phase.name}`}
              </div>
              <div className="flex-1 relative">
                {/* Today line in phase header */}
                {todayIndex >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-blue-500/30"
                    style={{ left: `${((todayIndex + 0.5) / total_days) * 100}%` }}
                  />
                )}
              </div>
            </div>

            {/* Task bars */}
            {phase.tasks.map((task, ti) => (
              <div
                key={ti}
                className="flex items-center group hover:bg-gray-800/30 cursor-pointer"
                onClick={() => onTaskClick?.(task)}
              >
                <div className="w-52 shrink-0 px-3 py-1.5 text-xs text-gray-300 truncate border-r border-gray-800/50 pl-6 group-hover:text-white transition-colors">
                  {task.task_no && <span className="text-gray-600 mr-1.5 font-mono">{task.task_no}</span>}
                  {task.name}
                </div>
                <div
                  className="flex-1 grid items-center py-1 px-0.5 relative"
                  style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}
                >
                  {/* Today vertical line */}
                  {todayIndex >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-blue-500/20 pointer-events-none z-0"
                      style={{ left: `${((todayIndex + 0.5) / total_days) * 100}%` }}
                    />
                  )}
                  <GanttBar task={task} totalDays={total_days} dayLabels={day_labels} onTaskClick={onTaskClick} />
                </div>
              </div>
            ))}
          </div>
        ))}

        {filteredPhases.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-600 text-sm">
            No tasks match "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  )
}
