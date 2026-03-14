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
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Next Steps</h3>
      </div>
      <ul>
        {steps.map((t) => (
          <li key={t.task_no || t.id} className="px-4 py-3 flex items-center gap-3 border-b last:border-b-0" style={{ borderColor: 'color-mix(in srgb, var(--border-primary) 50%, transparent)' }}>
            <span className="text-xs font-mono w-8 shrink-0" style={{ color: 'var(--text-muted)' }}>{t.task_no}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{t.task_name}</p>
              {t.assigned_to && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.assigned_to}</p>
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
