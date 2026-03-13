import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchProjectBySlug, fetchTasksForProject, fetchProjectEvents } from '../lib/supabase'
import { buildTimeline, calcCompletion, getCurrentPhase, PHASE_COLORS } from '../lib/scheduler'
import GanttTimeline from '../components/GanttTimeline'
import NextSteps from '../components/NextSteps'
import { PhaseBadge, PhaseProgressBar, StatusBadge } from '../components/PhaseBadge'

const AUTO_REFRESH_MS = 60_000

export default function ProjectHUD() {
  const { slugHUD } = useParams()
  // Route is /:slugHUD — URLs like /goldman-HUD → slug = "goldman"
  const slug = (slugHUD || '').replace(/-HUD$/, '')

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

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

      // Build timeline from tasks
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

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadData])

  if (loading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading project...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
          <p className="font-semibold mb-2">Project not found</p>
          <p className="text-sm text-red-300">{error}</p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  if (!project) return null

  const completion = calcCompletion(tasks)
  const currentPhase = getCurrentPhase(tasks)
  const phaseColor = PHASE_COLORS[currentPhase] || '#666'

  // Delivery countdown
  const deliveryDate = timeline?.delivery_date ? new Date(timeline.delivery_date) : null
  const daysUntilDelivery = deliveryDate
    ? Math.ceil((deliveryDate - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-500 hover:text-white transition-colors text-sm">
              &larr; Projects
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-sm font-semibold">{project.project_name || project.project_no}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {lastRefresh && (
              <span>Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
            <button
              onClick={loadData}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Refresh now"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Project header card */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{project.project_name}</h1>
              <p className="text-sm text-gray-400 mt-1">{project.client_name}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span className="font-mono">{project.project_no}</span>
                {project.contract_value && (
                  <>
                    <span className="text-gray-700">|</span>
                    <span>${Number(project.contract_value).toLocaleString()}</span>
                  </>
                )}
                {project.quote_no && (
                  <>
                    <span className="text-gray-700">|</span>
                    <span>Quote: {project.quote_no}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right side stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: phaseColor }}>
                  {completion}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Complete</div>
              </div>
              <div className="text-center">
                <PhaseBadge phase={currentPhase} size="lg" />
                <div className="text-xs text-gray-500 mt-1">Current</div>
              </div>
              {daysUntilDelivery !== null && (
                <div className="text-center">
                  <div className={`text-2xl font-bold ${daysUntilDelivery > 7 ? 'text-gray-300' : daysUntilDelivery > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {daysUntilDelivery > 0 ? daysUntilDelivery : 'Now'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {daysUntilDelivery > 0 ? 'Days left' : 'Due'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phase progress bar */}
          <div className="mt-4">
            <PhaseProgressBar tasks={tasks} />
          </div>
        </div>

        {/* Two-column layout: Gantt + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gantt timeline (2 cols) */}
          <div className="lg:col-span-2">
            {timeline ? (
              <GanttTimeline timeline={timeline} />
            ) : (
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-8 text-center text-gray-500">
                <p>No tasks scheduled yet</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Next Steps */}
            <NextSteps tasks={tasks} />

            {/* Project details */}
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Details</h3>
              <dl className="space-y-2 text-xs">
                {project.start_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Start</dt>
                    <dd className="text-gray-300">{project.start_date.slice(0, 10)}</dd>
                  </div>
                )}
                {timeline?.delivery_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Est. Delivery</dt>
                    <dd className="text-gray-300">{timeline.delivery_date}</dd>
                  </div>
                )}
                {timeline?.total_days && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="text-gray-300">{timeline.total_days} days ({timeline.total_weeks} weeks)</dd>
                  </div>
                )}
                {project.business_type && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="text-gray-300 capitalize">{project.business_type.replace(/_/g, ' ')}</dd>
                  </div>
                )}
                {project.site_address && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Site</dt>
                    <dd className="text-gray-300 text-right max-w-[60%] truncate">{project.site_address}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Recent events */}
            {events.length > 0 && (
              <div className="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Activity</h3>
                </div>
                <ul className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
                  {events.slice(0, 10).map((evt) => (
                    <li key={evt.id} className="px-4 py-2.5">
                      <p className="text-xs text-gray-300">{evt.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
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
        </div>
      </main>
    </div>
  )
}
