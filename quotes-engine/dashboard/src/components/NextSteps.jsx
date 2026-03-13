import { getNextSteps } from '../lib/scheduler'
import { StatusBadge, PhaseBadge } from './PhaseBadge'

export default function NextSteps({ tasks }) {
  const steps = getNextSteps(tasks, 5)

  if (steps.length === 0) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-6 text-center">
        <p className="text-green-400 font-semibold text-lg">All tasks complete</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Next Steps</h3>
      </div>
      <ul className="divide-y divide-gray-800/50">
        {steps.map((t) => (
          <li key={t.task_no || t.id} className="px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono w-8 shrink-0">{t.task_no}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{t.task_name}</p>
              {t.assigned_to && (
                <p className="text-xs text-gray-500 mt-0.5">{t.assigned_to}</p>
              )}
            </div>
            <PhaseBadge phase={t.phase_no} />
            <StatusBadge status={t.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}
