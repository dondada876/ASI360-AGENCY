import { PHASE_COLORS } from '../lib/scheduler'
import GanttBar from './GanttBar'

export default function GanttTimeline({ timeline }) {
  if (!timeline) return null

  const { periods, day_labels, phases, total_days } = timeline

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
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}>
            {day_labels.map((d, i) => (
              <div key={i} className="text-center text-[10px] text-gray-500 py-1 border-r border-gray-800/30">
                <div className="font-medium">{d.day}</div>
                <div>{d.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase rows */}
        {phases.map((phase) => (
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
              <div className="flex-1" />
            </div>

            {/* Task bars */}
            {phase.tasks.map((task, ti) => (
              <div key={ti} className="flex items-center group hover:bg-gray-800/30">
                <div className="w-52 shrink-0 px-3 py-1.5 text-xs text-gray-300 truncate border-r border-gray-800/50 pl-6">
                  {task.task_no && <span className="text-gray-600 mr-1.5 font-mono">{task.task_no}</span>}
                  {task.name}
                </div>
                <div
                  className="flex-1 grid items-center py-1 px-0.5"
                  style={{ gridTemplateColumns: `repeat(${total_days}, 1fr)` }}
                >
                  <GanttBar task={task} totalDays={total_days} dayLabels={day_labels} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
