import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  fetchProjectBySlug,
  fetchTasksForProject,
  fetchProjectEvents,
  updateTaskStatus,
  updateProjectHealth,
  logProjectEvent,
} from '../lib/supabase'
import { buildTimeline, calcCompletion, getCurrentPhase, getPhaseColor } from '../lib/scheduler'
import { calculateEVM, calculateHealthScore, getHealthStatus } from '../lib/evm'
import GanttTimeline from '../components/GanttTimeline'
import KanbanBoard from '../components/KanbanBoard'
import TaskListView from '../components/TaskListView'
import TaskDetailModal from '../components/TaskDetailModal'
import ViewControls from '../components/ViewControls'
import NextSteps from '../components/NextSteps'
import PMTriangle from '../components/PMTriangle'
import OnTargetIndicator from '../components/OnTargetIndicator'
import ThemeToggle from '../components/ThemeToggle'
import HelpButton from '../components/HelpButton'
import { PhaseBadge, PhaseProgressBar } from '../components/PhaseBadge'
import { SkeletonHUD } from '../components/Skeleton'

const AUTO_REFRESH_MS = 60_000

export default function ProjectHUD() {
  const { slugHUD } = useParams()
  const slug = (slugHUD || '').replace(/-HUD$/, '')

  // ── Data state ──
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  // ── UI state ──
  const [activeView, setActiveView] = useState('gantt')
  const [selectedTask, setSelectedTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState(null)

  // ── Project date editing state ──
  const [editingProjectDates, setEditingProjectDates] = useState(false)
  const [projStartDate, setProjStartDate] = useState('')
  const [projEndDate, setProjEndDate] = useState('')
  const [savingDates, setSavingDates] = useState(false)

  // ── Health persistence ref (must be before early returns) ──
  const lastPersistedScore = useRef(null)

  // ── Data loading ──
  const loadData = useCallback(async () => {
    if (!slug) return
    try {
      setLoading(true)
      const proj = await fetchProjectBySlug(slug)
      setProject(proj)

      const [taskData, eventData] = await Promise.all([
        fetchTasksForProject(proj.id),
        fetchProjectEvents(proj.project_no),
      ])
      setTasks(taskData || [])
      setEvents(eventData || [])

      if (taskData && taskData.length > 0) {
        const durations = {}
        taskData.forEach((t) => {
          durations[t.task_no] = t.estimated_days || 2
        })
        setTimeline(buildTimeline(proj, taskData, durations))
      }

      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { loadData() }, [loadData])

  // Sync project date state when project loads
  useEffect(() => {
    if (project) {
      setProjStartDate(project.start_date ? project.start_date.slice(0, 10) : '')
      setProjEndDate(project.target_close_date ? project.target_close_date.slice(0, 10) : '')
    }
  }, [project?.id, project?.start_date, project?.target_close_date])

  useEffect(() => {
    const interval = setInterval(loadData, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadData])

  // ── Persist health score (debounced, must be before early returns) ──
  const healthScoreForEffect = project ? calculateHealthScore(calculateEVM(project, tasks)) : null
  useEffect(() => {
    if (!project?.id || healthScoreForEffect === null || healthScoreForEffect === lastPersistedScore.current) return
    const timer = setTimeout(() => {
      updateProjectHealth(project.id, { health_score: healthScoreForEffect }).catch(() => {})
      lastPersistedScore.current = healthScoreForEffect
    }, 5000)
    return () => clearTimeout(timer)
  }, [healthScoreForEffect, project?.id])

  // ── Toast helper ──
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Save project dates ──
  async function handleSaveProjectDates() {
    if (!project?.id) return
    setSavingDates(true)
    try {
      await updateProjectHealth(project.id, {
        start_date: projStartDate || null,
        target_close_date: projEndDate || null,
      })
      await logProjectEvent(
        project.project_no,
        `Project dates updated: ${projStartDate || 'none'} → ${projEndDate || 'none'}`,
        'project_update',
        'dashboard'
      )
      setEditingProjectDates(false)
      showToast('Project dates saved')
      loadData()
    } catch (err) {
      showToast(`Failed to save dates: ${err.message}`, 'error')
    } finally {
      setSavingDates(false)
    }
  }

  // ── Task click → open detail modal ──
  function handleTaskClick(barTask) {
    const rawTask = tasks.find(t => t.task_no === barTask.task_no)
    if (rawTask) {
      setSelectedTask({ ...barTask, ...rawTask, name: barTask.name || rawTask.task_name })
    } else {
      setSelectedTask(barTask)
    }
  }

  // ── Status change (Kanban drag or detail modal) ──
  async function handleStatusChange(task, newStatus) {
    const taskId = task.id
    const taskNo = task.task_no
    const oldStatus = task.status

    if (!taskId || oldStatus === newStatus) return

    try {
      await updateTaskStatus(taskId, newStatus)
      await logProjectEvent(
        project.project_no,
        `Task ${taskNo} status changed: ${oldStatus} → ${newStatus}`,
        'task_update',
        'dashboard'
      )

      // Optimistic update
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      setTasks(updatedTasks)

      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }))
      }

      // Rebuild timeline
      if (updatedTasks.length > 0 && project) {
        const durations = {}
        updatedTasks.forEach(t => { durations[t.task_no] = t.estimated_days || 2 })
        setTimeline(buildTimeline(project, updatedTasks, durations))
      }

      showToast(`Task "${taskNo}" → ${newStatus.replace(/_/g, ' ')}`)
    } catch (err) {
      showToast(`Failed to update: ${err.message}`, 'error')
    }
  }

  // ── Filter tasks ──
  const filteredTasks = tasks.filter(t => {
    if (phaseFilter && String(t.phase_no) !== phaseFilter) return false
    if (statusFilter && t.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !t.task_name?.toLowerCase().includes(q) &&
        !t.task_no?.toLowerCase().includes(q) &&
        !t.assigned_to?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Loading / Error states ──
  if (loading && !project) {
    return <SkeletonHUD />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
          <p className="font-semibold mb-2">Project not found</p>
          <p className="text-sm text-red-300">{error}</p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 rounded text-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  if (!project) return null

  const completion = calcCompletion(tasks)
  const currentPhase = getCurrentPhase(tasks)
  const phaseColor = getPhaseColor(currentPhase)
  const deliveryDate = timeline?.delivery_date ? new Date(timeline.delivery_date) : null
  const daysUntilDelivery = deliveryDate
    ? Math.ceil((deliveryDate - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // EVM & Health scoring
  const evm = calculateEVM(project, tasks)
  const healthScore = calculateHealthScore(evm)
  const healthStatus = getHealthStatus(healthScore)
  const health = { score: healthScore, status: healthStatus }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── Header ── */}
      <header className="border-b backdrop-blur sticky top-0 z-20" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--modal-header-bg)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="hover:opacity-80 transition-colors text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>
              &larr; <span className="hidden sm:inline">Projects</span>
            </Link>
            <span className="hidden sm:inline" style={{ color: 'var(--border-secondary)' }}>/</span>
            <span className="text-sm font-semibold truncate">{project.project_name || project.project_no}</span>
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            {lastRefresh && (
              <span className="hidden sm:inline">Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
            <button
              onClick={loadData}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="Refresh now"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8a6 6 0 0111.2-3M14 8a6 6 0 01-11.2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M13 2v3h-3M3 14v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <HelpButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ── Project Header Card ── */}
        <div className="rounded-xl border p-4 sm:p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold">{project.project_name}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{project.client_name}</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-mono">{project.project_no}</span>
                {project.contract_value && (
                  <>
                    <span style={{ color: 'var(--border-secondary)' }}>|</span>
                    <span>${Number(project.contract_value).toLocaleString()}</span>
                  </>
                )}
                {project.quote_no && (
                  <>
                    <span className="hidden sm:inline" style={{ color: 'var(--border-secondary)' }}>|</span>
                    <span className="hidden sm:inline">Quote: {project.quote_no}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold" style={{ color: phaseColor }}>
                  {completion}%
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Complete</div>
              </div>
              <div className="text-center">
                <PhaseBadge phase={currentPhase} size="lg" />
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Current</div>
              </div>
              <OnTargetIndicator health={health} />
              {daysUntilDelivery !== null && (
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${daysUntilDelivery > 7 ? '' : daysUntilDelivery > 0 ? 'text-yellow-400' : 'text-green-400'}`} style={daysUntilDelivery > 7 ? { color: 'var(--text-primary)' } : {}}>
                    {daysUntilDelivery > 0 ? daysUntilDelivery : 'Now'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {daysUntilDelivery > 0 ? 'Days left' : 'Due'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <PhaseProgressBar tasks={tasks} />
          </div>
        </div>

        {/* ── View Controls ── */}
        <ViewControls
          activeView={activeView}
          onViewChange={setActiveView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          phaseFilter={phaseFilter}
          onPhaseChange={setPhaseFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          taskCount={tasks.length}
          filteredCount={filteredTasks.length}
        />

        {/* ── Main Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className={activeView === 'gantt' ? 'lg:col-span-2' : 'lg:col-span-3'}>
            {activeView === 'gantt' && (
              timeline ? (
                <GanttTimeline timeline={timeline} onTaskClick={handleTaskClick} searchQuery={searchQuery} />
              ) : (
                <div className="rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}>
                  <p>No tasks scheduled yet</p>
                </div>
              )
            )}

            {activeView === 'kanban' && (
              <KanbanBoard
                tasks={filteredTasks}
                onStatusChange={handleStatusChange}
                onTaskClick={handleTaskClick}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'list' && (
              <TaskListView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                searchQuery={searchQuery}
                dayLabels={timeline?.day_labels}
              />
            )}
          </div>

          {/* Sidebar (Gantt view only) */}
          {activeView === 'gantt' && (
            <div className="space-y-4 sm:space-y-6">
              <NextSteps tasks={tasks} />

              <PMTriangle evm={evm} health={health} />

              <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Details</h3>
                  {!editingProjectDates && (
                    <button
                      onClick={() => setEditingProjectDates(true)}
                      className="text-[10px] px-2 py-0.5 rounded transition-colors"
                      style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-hover)' }}
                      title="Edit project dates"
                    >
                      Edit dates
                    </button>
                  )}
                </div>

                {editingProjectDates ? (
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Project Start</label>
                      <input
                        type="date"
                        value={projStartDate}
                        onChange={e => setProjStartDate(e.target.value)}
                        max={projEndDate || undefined}
                        className="w-full bg-transparent text-xs font-medium outline-none border rounded px-2 py-1.5 transition-colors focus:border-blue-500"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)', colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Contract End</label>
                      <input
                        type="date"
                        value={projEndDate}
                        onChange={e => setProjEndDate(e.target.value)}
                        min={projStartDate || undefined}
                        className="w-full bg-transparent text-xs font-medium outline-none border rounded px-2 py-1.5 transition-colors focus:border-blue-500"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)', colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProjectDates}
                        disabled={savingDates}
                        className="flex-1 px-3 py-1.5 rounded text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                      >
                        {savingDates ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingProjectDates(false)
                          setProjStartDate(project.start_date ? project.start_date.slice(0, 10) : '')
                          setProjEndDate(project.target_close_date ? project.target_close_date.slice(0, 10) : '')
                        }}
                        className="px-3 py-1.5 rounded text-[11px] font-medium transition-colors"
                        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <dl className="space-y-2 text-xs">
                  {project.start_date && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Start</dt>
                      <dd style={{ color: 'var(--text-secondary)' }}>{project.start_date.slice(0, 10)}</dd>
                    </div>
                  )}
                  {timeline?.delivery_date && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Est. Delivery</dt>
                      <dd style={{ color: 'var(--text-secondary)' }}>{timeline.delivery_date}</dd>
                    </div>
                  )}
                  {timeline?.target_close_date && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Target End</dt>
                      <dd style={{ color: timeline.has_overdue ? '#ef4444' : 'var(--text-secondary)' }}>
                        {timeline.target_close_date}
                        {timeline.has_overdue && <span className="ml-1 text-[10px]">OVERDUE</span>}
                      </dd>
                    </div>
                  )}
                  {timeline?.total_days && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Duration</dt>
                      <dd style={{ color: 'var(--text-secondary)' }}>{timeline.total_days} days ({timeline.total_weeks} weeks)</dd>
                    </div>
                  )}
                  {project.business_type && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Type</dt>
                      <dd className="capitalize" style={{ color: 'var(--text-secondary)' }}>{project.business_type.replace(/_/g, ' ')}</dd>
                    </div>
                  )}
                  {project.site_address && (
                    <div className="flex justify-between">
                      <dt style={{ color: 'var(--text-muted)' }}>Site</dt>
                      <dd className="text-right max-w-[60%] truncate" style={{ color: 'var(--text-secondary)' }}>{project.site_address}</dd>
                    </div>
                  )}
                </dl>

                {!project.start_date && !project.target_close_date && !editingProjectDates && (
                  <div className="mt-3 p-2 rounded text-center text-[10px] border border-dashed" style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-muted)' }}>
                    No project dates set — <button onClick={() => setEditingProjectDates(true)} className="underline" style={{ color: 'var(--accent-blue, #3b82f6)' }}>add dates</button>
                  </div>
                )}
              </div>

              {events.length > 0 && (
                <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Activity</h3>
                  </div>
                  <ul className="max-h-80 overflow-y-auto custom-scrollbar">
                    {events.slice(0, 10).map((evt) => (
                      <li key={evt.id} className="px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border-primary)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{evt.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          <span className="capitalize">{evt.event_type}</span>
                          <span>via {evt.event_source}</span>
                          <span>{new Date(evt.created_at).toLocaleDateString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Task Detail Modal ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          project={project}
          dayLabels={timeline?.day_labels || []}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onTaskUpdate={loadData}
        />
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] animate-toast-in">
          <div className={`px-4 py-3 rounded-lg shadow-xl border text-sm font-medium flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
          }`}>
            <span>{toast.type === 'error' ? '\u2715' : '\u2713'}</span>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
