/**
 * Earned Value Management (EVM) calculations for project health scoring.
 *
 * Terminology:
 * - PV (Planned Value) = Budget * (elapsed time / total time)
 * - EV (Earned Value) = Budget * (% work completed)
 * - AC (Actual Cost) = Sum of actual costs incurred
 * - SPI = EV / PV (>1 = ahead of schedule, <1 = behind)
 * - CPI = EV / AC (>1 = under budget, <1 = over budget)
 * - EAC (Estimate at Completion) = Budget / CPI
 */

/**
 * Calculate EVM metrics from project and task data.
 */
export function calculateEVM(project, tasks, today = new Date()) {
  const budget = Number(project.target_budget || project.contract_value || 0)
  const startDate = project.start_date ? new Date(project.start_date) : null
  const endDate = project.target_close_date ? new Date(project.target_close_date) : null

  // If no dates, return defaults
  if (!startDate) {
    return {
      PV: 0, EV: 0, AC: 0,
      SPI: 1, CPI: 1,
      SV: 0, CV: 0,
      EAC: budget, budget,
      completionFraction: 0,
      timeFraction: 0,
      scopeVariance: 0,
      hasData: false,
    }
  }

  // Time fractions
  const totalDuration = (endDate || today) - startDate
  const elapsed = Math.max(0, Math.min(today - startDate, totalDuration))
  const timeFraction = totalDuration > 0 ? elapsed / totalDuration : 0

  // Planned Value
  const PV = budget * Math.min(timeFraction, 1)

  // Earned Value (weighted by task budget or hours, fallback to equal weight)
  const totalWeight = tasks.reduce((sum, t) =>
    sum + (Number(t.task_budget) || Number(t.estimated_hours) || 1), 0)
  const earnedWeight = tasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) =>
      sum + (Number(t.task_budget) || Number(t.estimated_hours) || 1), 0)
  const completionFraction = totalWeight > 0 ? earnedWeight / totalWeight : 0
  const EV = budget * completionFraction

  // Actual Cost
  const AC = tasks.reduce((sum, t) => sum + (Number(t.cost_actual) || 0), 0)

  // Performance indices (guard against zero division)
  const SPI = PV > 0 ? EV / PV : (EV > 0 ? 1.5 : 1)
  const CPI = AC > 0 ? EV / AC : (budget > 0 ? 1 : 1)

  // Variances
  const SV = EV - PV
  const CV = EV - AC

  // Estimate at Completion
  const EAC = CPI > 0 ? budget / CPI : budget

  // Scope metrics
  const originalCount = project.original_task_count || tasks.length
  const scopeVariance = originalCount > 0
    ? ((tasks.length - originalCount) / originalCount) * 100
    : 0

  return {
    PV, EV, AC,
    SPI, CPI,
    SV, CV,
    EAC, budget,
    completionFraction,
    timeFraction,
    scopeVariance,
    hasData: budget > 0 || AC > 0,
  }
}

/**
 * Compute a 0-100 health score from EVM metrics.
 * Weighted: 40% schedule, 40% budget, 20% scope.
 */
export function calculateHealthScore(evm) {
  // Schedule score: SPI of 1.0 = 100, 0.5 = 50, 1.5+ = 100
  const scheduleScore = Math.min(100, Math.max(0, Math.min(evm.SPI, 1.5) / 1.5 * 100))

  // Budget score: CPI of 1.0 = 100, 0.5 = 50, 1.5+ = 100
  const budgetScore = Math.min(100, Math.max(0, Math.min(evm.CPI, 1.5) / 1.5 * 100))

  // Scope score: 0% variance = 100, 50% variance = 0
  const scopeScore = Math.max(0, 100 - Math.abs(evm.scopeVariance) * 2)

  return Math.round(scheduleScore * 0.4 + budgetScore * 0.4 + scopeScore * 0.2)
}

/**
 * Get traffic-light status from a health score.
 */
export function getHealthStatus(score) {
  if (score === null || score === undefined) {
    return { label: 'No Data', color: '#6b7280', level: 'gray' }
  }
  if (score >= 80) return { label: 'On Track', color: '#22c55e', level: 'green' }
  if (score >= 60) return { label: 'At Risk', color: '#eab308', level: 'yellow' }
  return { label: 'Off Track', color: '#ef4444', level: 'red' }
}

/**
 * Format large numbers as $1.2K, $45K, $1.2M
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '\u2014'
  const num = Number(value)
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${Math.round(num).toLocaleString()}`
}
