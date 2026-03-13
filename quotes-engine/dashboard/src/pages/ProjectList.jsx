import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchProjects } from '../lib/supabase'
import { calcCompletion, getCurrentPhase, PHASE_COLORS } from '../lib/scheduler'
import { PhaseProgressBar } from '../components/PhaseBadge'

const STATUS_DOTS = {
  initiated: 'bg-gray-400',
  'in progress': 'bg-blue-400',
  'on hold': 'bg-yellow-400',
  completed: 'bg-green-400',
  delivered: 'bg-emerald-400',
}

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      setLoading(true)
      const data = await fetchProjects()
      setProjects(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading projects...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
          <p className="font-semibold mb-2">Error loading projects</p>
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadProjects} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-sm font-bold">A</div>
            <div>
              <h1 className="text-lg font-bold">ASI 360 — Projects</h1>
              <p className="text-xs text-gray-500">Allied Systems Integrations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{projects.length} projects</span>
            <button
              onClick={loadProjects}
              className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm"
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Project grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const slug = proj.slug
            const status = (proj.project_status || proj.cf_project_phasestatus || 'initiated').toLowerCase()
            const dotClass = STATUS_DOTS[status] || STATUS_DOTS.initiated
            const phase = proj.current_phase || 1
            const phaseColor = PHASE_COLORS[phase] || '#666'

            return (
              <Link
                key={proj.id}
                to={slug ? `/${slug}-HUD` : '#'}
                className="group block rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition-all p-5"
              >
                {/* Top row: status dot + project no */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                    <span className="text-xs text-gray-500 font-mono">{proj.project_no}</span>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${phaseColor}33`, color: phaseColor }}
                  >
                    Phase {phase}
                  </span>
                </div>

                {/* Project name + client */}
                <h2 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                  {proj.project_name || proj.project_no}
                </h2>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {proj.client_name || 'No client'}
                </p>

                {/* Meta row */}
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  {proj.contract_value && (
                    <span>${Number(proj.contract_value).toLocaleString()}</span>
                  )}
                  {proj.business_type && (
                    <span className="capitalize">{proj.business_type.replace(/_/g, ' ')}</span>
                  )}
                </div>

                {/* Phase progress placeholder — needs tasks */}
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(phase * 20, 100)}%`,
                        backgroundColor: phaseColor,
                      }}
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No active projects</p>
          </div>
        )}
      </main>
    </div>
  )
}
