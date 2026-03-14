import { formatCurrency } from '../lib/evm'

/**
 * PMTriangle — Project Management Triangle with 3 SVG gauge meters
 * and EVM metric cards. Shows Schedule (SPI), Budget (CPI), and Scope health.
 */
export default function PMTriangle({ evm, health }) {
  if (!evm) return null

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
      {/* Header with health badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          Project Health
        </h3>
        <HealthBadge score={health.score} status={health.status} />
      </div>

      {/* Three gauge meters */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <GaugeMeter
          label="Schedule"
          value={evm.SPI}
          target={1.0}
          unit="SPI"
          color={evm.SPI >= 0.9 ? '#22c55e' : evm.SPI >= 0.7 ? '#eab308' : '#ef4444'}
        />
        <GaugeMeter
          label="Budget"
          value={evm.CPI}
          target={1.0}
          unit="CPI"
          color={evm.CPI >= 0.9 ? '#22c55e' : evm.CPI >= 0.7 ? '#eab308' : '#ef4444'}
        />
        <GaugeMeter
          label="Scope"
          value={100}
          target={100}
          displayValue={`${evm.scopeVariance > 0 ? '+' : ''}${Math.round(evm.scopeVariance)}%`}
          color={Math.abs(evm.scopeVariance) <= 10 ? '#22c55e' : Math.abs(evm.scopeVariance) <= 25 ? '#eab308' : '#ef4444'}
        />
      </div>

      {/* Progress bars: Time vs Completion */}
      <div className="space-y-2 mb-4">
        <ProgressRow
          label="Time Elapsed"
          value={Math.round(evm.timeFraction * 100)}
          color="#3b82f6"
        />
        <ProgressRow
          label="Work Complete"
          value={Math.round(evm.completionFraction * 100)}
          color="#22c55e"
        />
      </div>

      {/* EVM metric cards */}
      {evm.hasData && (
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Budget" value={formatCurrency(evm.budget)} />
          <MetricCard label="Earned Value" value={formatCurrency(evm.EV)} />
          <MetricCard label="Actual Cost" value={formatCurrency(evm.AC)} />
          <MetricCard label="Est. at Compl." value={formatCurrency(evm.EAC)} />
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function GaugeMeter({ label, value, target, unit, displayValue, color }) {
  const radius = 32
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const normalizedValue = Math.min(Math.max(value / (target * 1.5), 0), 1)
  const arcLength = circumference * 0.75 // 270-degree arc
  const filledArc = arcLength * normalizedValue

  return (
    <div className="text-center">
      <svg width="80" height="72" viewBox="0 0 80 72" className="mx-auto">
        {/* Background arc */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(135, 40, 40)"
          style={{ stroke: 'var(--progress-track)' }}
        />
        {/* Filled arc */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filledArc} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(135, 40, 40)"
          className="transition-all duration-700"
        />
        {/* Center value */}
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" fill={color}>
          {displayValue || value.toFixed(2)}
        </text>
      </svg>
      <p className="text-[10px] font-medium -mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {unit && <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</p>}
    </div>
  )
}

function HealthBadge({ score, status }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${status.color}15`, color: status.color }}
    >
      <div
        className={`w-2 h-2 rounded-full ${status.level !== 'green' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: status.color }}
      />
      {score !== null ? `${score}` : ''} {status.label}
    </div>
  )
}

function ProgressRow({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-[10px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
      <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}
