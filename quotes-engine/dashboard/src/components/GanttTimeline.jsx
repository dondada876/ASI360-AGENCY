import { getPhaseColor } from '../lib/scheduler'
import GanttBar from './GanttBar'

/**
 * GanttTimeline v3 — CSS grid Gantt chart with theme support, click-to-detail, today marker.
 */
export default function GanttTimeline({ timeline, onTaskClick, searchQuery }) {
  if (!timeline) return null

  const { periods, day_labels, phases, total_days, end_date_col } = timeline

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

  // End date boundary position (for target close date enforcement)
  const endDateIndex = typeof end_date_col === 'number' ? end_date_col : -1

  return (
    <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
      <div className="min-w-[800px]">
        {/* Week period headers */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="w-52 shrink-0 px-3 py-2 text-xs font-semibold uppercase border-r" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' }}>
            Task
          </div>
          <div className="flex-1 flex">
            {periods.map((p, i) => (
              <div
                key={i}
                className="text-center text-xs font-bold py-2 border-r"
                style={{ width: `${(p.span / total_days) * 100}%`, color: 'var(--text-secondary)', borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Day labels row */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-secondary)' }}>
          <div className="w-52 shrink-0 border-r" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }} />
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}>
            {day_labels.map((d, i) => (
              <div
                key={i}
                className="text-center text-[10px] py-1 border-r"
                style={{
                  borderColor: 'color-mix(in srgb, var(--border-primary) 30%, transparent)',
                  backgroundColor: i === todayIndex ? 'var(--gantt-today-bg)' : i === endDateIndex ? 'rgba(239,68,68,0.08)' : 'transparent',
                  color: i === todayIndex ? '#3b82f6' : i === endDateIndex ? '#ef4444' : 'var(--text-muted)',
                }}
              >
                <div className="font-medium">{d.day}</div>
                <div>{d.date}</div>
              </div>
            ))}
            {/* End-date boundary marker */}
            {endDateIndex >= 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
                style={{
                  left: `${((endDateIndex + 0.5) / total_days) * 100}%`,
                  background: 'repeating-linear-gradient(180deg, #ef4444 0px, #ef4444 4px, transparent 4px, transparent 8px)',
                }}
              >
                <div className="absolute -top-0 left-1 whitespace-nowrap text-[8px] font-bold text-red-500 uppercase tracking-wider">
                  TARGET END
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase rows */}
        {filteredPhases.map((phase) => {
          const phaseColor = getPhaseColor(phase.number)
          return (
            <div key={phase.number} className="border-b last:border-b-0" style={{ borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}>
              {/* Phase header */}
              <div className="flex items-center border-b" style={{ borderColor: 'color-mix(in srgb, var(--border-primary) 30%, transparent)' }}>
                <div
                  className="w-52 shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide border-r"
                  style={{
                    backgroundColor: phaseColor + '40',
                    borderLeft: `3px solid ${phaseColor}`,
                    color: 'var(--text-primary)',
                    borderRightColor: 'var(--border-primary)',
                  }}
                >
                  {phase.is_milestone ? phase.name : `Phase ${phase.number} — ${phase.name}`}
                </div>
                <div className="flex-1 relative">
                  {todayIndex >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px"
                      style={{ left: `${((todayIndex + 0.5) / total_days) * 100}%`, backgroundColor: 'var(--gantt-today-line)' }}
                    />
                  )}
                  {endDateIndex >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{
                        left: `${((endDateIndex + 0.5) / total_days) * 100}%`,
                        background: 'repeating-linear-gradient(180deg, #ef4444 0px, #ef4444 4px, transparent 4px, transparent 8px)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Task bars */}
              {phase.tasks.map((task, ti) => (
                <div
                  key={ti}
                  className="flex items-center group cursor-pointer transition-colors"
                  onClick={() => onTaskClick?.(task)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-52 shrink-0 px-3 py-1.5 text-xs truncate border-r pl-6 transition-colors" style={{ color: 'var(--text-secondary)', borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}>
                    {task.task_no && <span className="mr-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{task.task_no}</span>}
                    {task.name}
                  </div>
                  <div
                    className="flex-1 grid items-center py-1 px-0.5 relative"
                    style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}
                  >
                    {todayIndex >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-px pointer-events-none z-0"
                        style={{ left: `${((todayIndex + 0.5) / total_days) * 100}%`, backgroundColor: 'color-mix(in srgb, var(--gantt-today-line) 60%, transparent)' }}
                      />
                    )}
                    {endDateIndex >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-0"
                        style={{
                          left: `${((endDateIndex + 0.5) / total_days) * 100}%`,
                          background: 'repeating-linear-gradient(180deg, rgba(239,68,68,0.5) 0px, rgba(239,68,68,0.5) 4px, transparent 4px, transparent 8px)',
                        }}
                      />
                    )}
                    <GanttBar task={task} totalDays={total_days} dayLabels={day_labels} onTaskClick={onTaskClick} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {filteredPhases.length === 0 && searchQuery && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tasks match "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  )
}
