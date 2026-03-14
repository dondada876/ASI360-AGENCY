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

  useEffect(() => {
    const interval = setInterval(loadData, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadData])

  // ── Toast helper ──
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
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

  // Persist health score to Supabase (debounced, skip if unchanged)
  const lastPersistedScore = useRef(project?.health_score)
  useEffect(() => {
    if (!project?.id || healthScore === lastPersistedScore.current) return
    const timer = setTimeout(() => {
      updateProjectHealth(project.id, { health_score: healthScore }).catch(() => {})
      lastPersistedScore.current = healthScore
    }, 5000)
    return () => clearTimeout(timer)
  }, [healthScore, project?.id])

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
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ── Project Header Card ── */}
        <div className="rounded-xl border p-4 sm:p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
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

              <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Details</h3>
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
              </div>

              {events.length > 0 && (
                <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
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
