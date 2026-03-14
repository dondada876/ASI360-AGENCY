/**
 * OnTargetIndicator — Traffic light status indicator for project health.
 * Compact mode: colored dot + label (for project cards).
 * Full mode: score number + label (for HUD header).
 */
export default function OnTargetIndicator({ health, compact = false }) {
  if (!health || health.score === null) return null

  const { label, color, level } = health.status

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2.5 h-2.5 rounded-full ${level !== 'green' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="text-xl sm:text-2xl font-bold" style={{ color }}>
        {health.score}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  )
}
