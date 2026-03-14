import { useEffect, useRef } from 'react'
import { StatusBadge, PhaseBadge } from './PhaseBadge'
import { PHASE_COLORS } from '../lib/scheduler'

/**
 * TaskDetailModal — Slide-over drawer from the right edge.
 * Shows full task details: people, schedule, budget, resources, notes.
 * Responsive: full-width on mobile, 420px on desktop.
 */
export default function TaskDetailModal({ task, project, dayLabels, onClose, onStatusChange }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!task) return null

  const startLabel = dayLabels?.[task.bar_start]?.full || ''
  const endLabel = dayLabels?.[task.bar_end]?.full || ''
  const duration = task.bar_end - task.bar_start + 1
  const phaseColor = PHASE_COLORS[task.phase_no] || '#666'

  // Estimated hours (2 hrs per business day if not specified)
  const estimatedHours = task.estimated_hours || (duration * 8)
  // Budget (proportional to contract value if not set)
  const taskBudget = task.budget || null

  const statusOptions = ['open', 'in_progress', 'blocked', 'waiting', 'completed']

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="relative w-full sm:w-[420px] max-w-full bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto animate-slide-in"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-mono mb-1">{task.task_no}</p>
              <h2 className="text-lg font-bold text-white leading-tight">{task.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors shrink-0"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Status + Phase badges */}
          <div className="flex items-center gap-2 mt-3">
            <StatusBadge status={task.status} />
            <PhaseBadge phase={task.phase_no} />
            {task.is_milestone && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                Milestone
              </span>
            )}
          </div>
        </div>

        {/* Body sections */}
        <div className="px-5 py-4 space-y-5">

          {/* ── Schedule Section ── */}
          <Section title="Schedule" icon="calendar">
            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Start Date" value={formatDate(startLabel)} />
              <DetailCard label="End Date" value={formatDate(endLabel)} />
              <DetailCard label="Duration" value={`${duration} business day${duration !== 1 ? 's' : ''}`} />
              <DetailCard label="Est. Hours" value={`${estimatedHours}h`} />
            </div>
            {/* Timeline mini-bar */}
            <div className="mt-3 rounded-full h-2.5 bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: task.status === 'completed' ? '100%' : task.status === 'in_progress' ? '50%' : '0%',
                  backgroundColor: phaseColor,
                }}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              {task.status === 'completed' ? 'Task completed' : task.status === 'in_progress' ? 'In progress' : 'Not started'}
            </p>
          </Section>

          {/* ── People & Assignment ── */}
          <Section title="People" icon="users">
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-sm font-bold text-blue-400">
                  {task.assigned_to ? task.assigned_to.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {task.assigned_to || 'Unassigned'}
                  </p>
                  <p className="text-xs text-gray-500">Assigned to</p>
                </div>
              </div>
              {project?.client_name && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                  <div className="w-9 h-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-sm font-bold text-emerald-400">
                    {project.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{project.client_name}</p>
                    <p className="text-xs text-gray-500">Client</p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ── Budget & Cost ── */}
          <Section title="Budget & Time" icon="dollar">
            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                label="Task Budget"
                value={taskBudget ? `$${Number(taskBudget).toLocaleString()}` : '—'}
              />
              <DetailCard
                label="Contract Value"
                value={project?.contract_value ? `$${Number(project.contract_value).toLocaleString()}` : '—'}
              />
              <DetailCard
                label="Hours Scheduled"
                value={`${estimatedHours}h`}
              />
              <DetailCard
                label="Rate"
                value={taskBudget && estimatedHours ? `$${Math.round(taskBudget / estimatedHours)}/hr` : '—'}
              />
            </div>
          </Section>

          {/* ── Resources ── */}
          <Section title="Resources" icon="box">
            {task.resources && task.resources.length > 0 ? (
              <div className="space-y-2">
                {task.resources.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/50 text-sm">
                    <span className="text-gray-300">{r.name || r}</span>
                    {r.quantity && <span className="text-xs text-gray-500">x{r.quantity}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-600 text-sm">
                <p>No resources listed</p>
                <p className="text-xs mt-1">Resources can be added via Supabase</p>
              </div>
            )}
          </Section>

          {/* ── Dependencies ── */}
          {task.dependencies && task.dependencies.length > 0 && (
            <Section title="Dependencies" icon="link">
              <div className="space-y-1">
                {task.dependencies.map((dep, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400 p-2 rounded bg-gray-800/30">
                    <span className="text-gray-600">depends on</span>
                    <span className="font-mono text-xs text-gray-300">{dep}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Notes ── */}
          <Section title="Notes" icon="note">
            {task.notes ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{task.notes}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">No notes added</p>
            )}
          </Section>

          {/* ── Quick Actions ── */}
          <Section title="Update Status" icon="status">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange?.(task, s)}
                  disabled={task.status === s}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    task.status === s
                      ? 'bg-white/10 text-white border-white/20 cursor-default ring-2 ring-white/20'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white cursor-pointer'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Project Context ── */}
          {project && (
            <Section title="Project" icon="folder">
              <div className="space-y-2 text-xs">
                <DetailRow label="Project" value={project.project_name} />
                <DetailRow label="Number" value={project.project_no} mono />
                <DetailRow label="Type" value={project.business_type?.replace(/_/g, ' ')} />
                {project.site_address && <DetailRow label="Site" value={project.site_address} />}
                <DetailRow label="Phase" value={`Phase ${task.phase_no} — ${task.phase_name || ''}`} />
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Section({ title, icon, children }) {
  const icons = {
    calendar: '📅',
    users: '👥',
    dollar: '💰',
    box: '📦',
    link: '🔗',
    note: '📝',
    status: '🔄',
    folder: '📁',
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span>{icons[icon] || ''}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-800/50 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-300 text-right max-w-[60%] truncate ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}
