/**
 * Project scheduling algorithm — JavaScript port of generate_timeline.py
 * Transforms Supabase project + tasks into Gantt-ready data structure.
 */

const PHASE_COLORS = {
  1: '#0B5394',
  2: '#45818E',
  3: '#B85B22',
  4: '#38761D',
  5: '#351C75',
  0: '#434343',
}

/**
 * Get phase color from CSS custom property (theme-aware).
 * Falls back to static PHASE_COLORS map.
 */
export function getPhaseColor(phaseNo) {
  if (typeof document === 'undefined') return PHASE_COLORS[phaseNo] || '#666'
  const val = getComputedStyle(document.documentElement).getPropertyValue(`--phase-${phaseNo}`).trim()
  return val || PHASE_COLORS[phaseNo] || '#666'
}

/**
 * Add business days to a Date (skipping weekends).
 */
function addBusinessDays(startDate, days) {
  const d = new Date(startDate)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

/**
 * Skip to next Monday if date is on a weekend.
 */
function skipWeekend(d) {
  const date = new Date(d)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1)
  }
  return date
}

/**
 * Count business days between two dates.
 */
function businessDaysBetween(start, end) {
  let count = 0
  const d = new Date(start)
  while (d < end) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
  }
  return count
}

/**
 * Sequential scheduler — assigns tasks back-to-back by phase order.
 */
function sequentialSchedule(tasks, durations) {
  const schedule = {}
  let currentDay = 0
  for (const t of tasks) {
    const duration = durations[t.task_no] || 2
    schedule[t.task_no] = [currentDay, currentDay + duration - 1]
    currentDay += duration
  }
  return schedule
}

/**
 * Critical path scheduler with dependency resolution.
 */
function criticalPathSchedule(tasks, durations, dependencies) {
  const scheduled = {}

  function scheduleTask(taskNo) {
    if (scheduled[taskNo]) return scheduled[taskNo]

    const deps = dependencies[taskNo] || []
    let start = 0

    for (const dep of deps) {
      const [, depEnd] = scheduleTask(dep)
      start = Math.max(start, depEnd + 1)
    }

    const duration = durations[taskNo] || 2
    const end = start + duration - 1
    scheduled[taskNo] = [start, end]
    return [start, end]
  }

  for (const t of tasks) {
    scheduleTask(t.task_no)
  }

  return scheduled
}

/**
 * Transform Supabase project data into timeline-ready structure.
 *
 * @param {Object} proj - Project record from asi360_projects
 * @param {Array} tasks - Task records from asi360_project_tasks
 * @param {Object} durations - Map of task_no → days (default 2)
 * @param {Object} dependencies - Map of task_no → [dep_task_nos]
 * @returns {Object} Timeline data for rendering
 */
export function buildTimeline(proj, tasks, durations = {}, dependencies = {}) {
  // Parse start date
  const startStr = proj.start_date
  let startDate = startStr ? new Date(startStr) : new Date()
  startDate = skipWeekend(startDate)

  // Run scheduler
  const hasDeps = Object.values(dependencies).some((v) => v && v.length > 0)
  const schedule = hasDeps
    ? criticalPathSchedule(tasks, durations, dependencies)
    : sequentialSchedule(tasks, durations)

  // Override schedule with manual dates where tasks have explicit start_date/end_date
  for (const t of tasks) {
    if (t.start_date || t.end_date) {
      const manualStart = t.start_date ? skipWeekend(new Date(t.start_date)) : null
      const manualEnd = t.end_date ? skipWeekend(new Date(t.end_date)) : null

      if (manualStart && manualEnd) {
        const startDay = businessDaysBetween(startDate, manualStart)
        const endDay = businessDaysBetween(startDate, manualEnd)
        schedule[t.task_no] = [startDay, Math.max(startDay, endDay)]
      } else if (manualStart) {
        const startDay = businessDaysBetween(startDate, manualStart)
        const duration = durations[t.task_no] || 2
        schedule[t.task_no] = [startDay, startDay + duration - 1]
      } else if (manualEnd) {
        const endDay = businessDaysBetween(startDate, manualEnd)
        const duration = durations[t.task_no] || 2
        schedule[t.task_no] = [Math.max(0, endDay - duration + 1), endDay]
      }
    }
  }

  // Group tasks by phase
  const phaseGroups = {}
  const phaseNames = {}
  for (const t of tasks) {
    const pno = t.phase_no
    if (!phaseGroups[pno]) {
      phaseGroups[pno] = []
      phaseNames[pno] = t.phase_name
    }
    phaseGroups[pno].push(t)
  }

  // Parse target close date for enforcement
  const endDateStr = proj.target_close_date
  const endDate = endDateStr ? skipWeekend(new Date(endDateStr)) : null
  const endDateDay = endDate ? businessDaysBetween(startDate, endDate) : null

  // Find total working days (enforce end date boundary if set)
  const allEnds = Object.values(schedule).map(([, end]) => end)
  const maxEndDay = allEnds.length > 0 ? Math.max(...allEnds) : 0
  const totalDays = endDateDay ? Math.max(maxEndDay + 1, endDateDay) : maxEndDay + 1

  // Build phase data
  const phases = []
  for (const pno of Object.keys(phaseGroups).sort((a, b) => a - b)) {
    const phaseTasks = phaseGroups[pno]
    const taskBars = phaseTasks.map((t) => {
      // Strip project prefix from task name
      let displayName = t.task_name || ''
      if (displayName.includes('-') && displayName.includes(' ')) {
        const parts = displayName.split(' ', 2)
        if (parts[0].includes('-') && parts[0].includes('.')) {
          displayName = parts[1] || displayName
        }
      }

      const [barStart, barEnd] = schedule[t.task_no] || [0, 1]

      // Short label for the bar
      const words = displayName.split(' ')
      let barLabel = words.length > 3 ? words.slice(0, 3).join(' ') : displayName
      if (barLabel.length > 20) barLabel = barLabel.slice(0, 18) + '..'

      // Task progress (0-100)
      const progress = t.status === 'completed' ? 100
        : t.status === 'in_progress'
          ? (t.actual_hours && t.estimated_hours
              ? Math.min(100, Math.round((Number(t.actual_hours) / Number(t.estimated_hours)) * 100))
              : 50)
          : 0

      return {
        name: displayName,
        task_no: t.task_no,
        phase_no: Number(pno),
        bar_start: barStart,
        bar_end: barEnd,
        bar_color: PHASE_COLORS[pno] || '#666',
        bar_label: barLabel,
        is_milestone: t.is_milestone || false,
        is_overdue: endDateDay !== null && barEnd >= endDateDay,
        has_manual_dates: !!(t.start_date || t.end_date),
        status: t.status || 'open',
        progress,
        notes: t.notes || '',
        assigned_to: t.assigned_to || '',
        estimated_hours: t.estimated_hours,
        budget: t.task_budget || t.budget,
        risk_level: t.risk_level || 'normal',
      }
    })

    phases.push({
      number: Number(pno),
      name: phaseNames[pno],
      tasks: taskBars,
    })
  }

  // Add PROJECT COMPLETE milestone
  phases.push({
    number: 0,
    name: 'PROJECT COMPLETE',
    is_milestone: true,
    tasks: [
      {
        name: 'Project Complete',
        bar_start: maxEndDay,
        bar_end: maxEndDay,
        bar_color: PHASE_COLORS[0],
        bar_label: 'COMPLETE',
        is_milestone: true,
        status: 'open',
      },
    ],
  })

  const totalWeeks = Math.ceil(totalDays / 5)

  // Build day labels (Mon–Fri business days)
  const dayLabels = []
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  let calDate = new Date(startDate)
  for (let i = 0; i < totalDays; i++) {
    while (calDate.getDay() === 0 || calDate.getDay() === 6) {
      calDate.setDate(calDate.getDate() + 1)
    }
    const mm = String(calDate.getMonth() + 1).padStart(2, '0')
    const dd = String(calDate.getDate()).padStart(2, '0')
    dayLabels.push({
      day: dayNames[calDate.getDay()],
      date: `${mm}/${dd}`,
      full: calDate.toISOString().slice(0, 10),
    })
    calDate.setDate(calDate.getDate() + 1)
  }

  // Build week period headers
  const periods = []
  for (let w = 0; w < totalWeeks; w++) {
    const daysInWeek = Math.min(5, totalDays - w * 5)
    periods.push({ label: `WEEK ${w + 1}`, span: daysInWeek })
  }

  // Expected delivery date
  const deliveryDate = addBusinessDays(startDate, totalDays)

  return {
    title: proj.project_name || proj.project_no || 'Project',
    client: proj.client_name || '',
    project_no: proj.project_no || '',
    contract_value: proj.contract_value,
    quote_no: proj.quote_no || '',
    start_date: startDate.toISOString().slice(0, 10),
    delivery_date: deliveryDate.toISOString().slice(0, 10),
    target_close_date: endDate ? endDate.toISOString().slice(0, 10) : null,
    end_date_col: endDateDay,
    has_overdue: phases.some(p => p.tasks.some(t => t.is_overdue)),
    total_days: totalDays,
    total_weeks: totalWeeks,
    periods,
    day_labels: dayLabels,
    phases,
  }
}

/**
 * Calculate completion percentage from tasks.
 */
export function calcCompletion(tasks) {
  if (!tasks || tasks.length === 0) return 0
  const completed = tasks.filter((t) => t.status === 'completed').length
  return Math.round((completed / tasks.length) * 100)
}

/**
 * Get the current phase from tasks.
 */
export function getCurrentPhase(tasks) {
  if (!tasks || tasks.length === 0) return 1
  // Find the lowest phase that has incomplete tasks
  const phases = [...new Set(tasks.map((t) => t.phase_no))].sort((a, b) => a - b)
  for (const p of phases) {
    const phaseTasks = tasks.filter((t) => t.phase_no === p)
    const allDone = phaseTasks.every((t) => t.status === 'completed')
    if (!allDone) return p
  }
  return phases[phases.length - 1] // All done — return last phase
}

/**
 * Get next actionable tasks (incomplete, lowest phase first).
 */
export function getNextSteps(tasks, limit = 5) {
  if (!tasks) return []
  return tasks
    .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => {
      if (a.phase_no !== b.phase_no) return a.phase_no - b.phase_no
      return (a.task_no || '').localeCompare(b.task_no || '')
    })
    .slice(0, limit)
}

export { PHASE_COLORS }
