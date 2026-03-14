import { getPhaseColor } from '../lib/scheduler'

const STATUS_STYLES = {
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  open: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

export function PhaseBadge({ phase, size = 'sm' }) {
  const color = getPhaseColor(phase)
  const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold ${sizeClass}`}
      style={{ backgroundColor: `${color}33`, color, border: `1px solid ${color}55` }}
    >
      Phase {phase}
    </span>
  )
}

export function StatusBadge({ status }) {
  const normalized = (status || 'open').replace(/\s+/g, '_').toLowerCase()
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.open

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${style}`}>
      {status || 'open'}
    </span>
  )
}

export function PhaseProgressBar({ tasks }) {
  if (!tasks || tasks.length === 0) return null

  const phaseNums = [...new Set(tasks.map((t) => t.phase_no))].sort((a, b) => a - b)
  const totalTasks = tasks.length

  return (
    <div className="flex gap-0.5 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
      {phaseNums.map((pno) => {
        const phaseTasks = tasks.filter((t) => t.phase_no === pno)
        const completed = phaseTasks.filter((t) => t.status === 'completed').length
        const widthPct = (phaseTasks.length / totalTasks) * 100
        const fillPct = phaseTasks.length > 0 ? (completed / phaseTasks.length) * 100 : 0
        const color = getPhaseColor(pno)

        return (
          <div
            key={pno}
            className="relative h-full"
            style={{ width: `${widthPct}%`, backgroundColor: `${color}33` }}
            title={`Phase ${pno}: ${completed}/${phaseTasks.length} complete`}
          >
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{ width: `${fillPct}%`, backgroundColor: color }}
            />
          </div>
        )
      })}
    </div>
  )
}
