import { useEffect, useRef } from 'react'
import { StatusBadge, PhaseBadge } from './PhaseBadge'
import { getPhaseColor } from '../lib/scheduler'

/**
 * TaskDetailModal v3 — Slide-over drawer with theme support.
 */
export default function TaskDetailModal({ task, project, dayLabels, onClose, onStatusChange }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!task) return null

  const startLabel = dayLabels?.[task.bar_start]?.full || ''
  const endLabel = dayLabels?.[task.bar_end]?.full || ''
  const duration = task.bar_end - task.bar_start + 1
  const phaseColor = getPhaseColor(task.phase_no)
  const estimatedHours = task.estimated_hours || (duration * 8)
  const taskBudget = task.budget || task.task_budget || null
  const statusOptions = ['open', 'in_progress', 'blocked', 'waiting', 'completed']

  function formatDate(dateStr) {
    if (!dateStr) return '\u2014'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 animate-fade-in"
        style={{ backgroundColor: 'var(--bg-overlay)' }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className="relative w-full sm:w-[420px] max-w-full border-l shadow-2xl overflow-y-auto animate-slide-in"
        style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border-secondary)' }}
      >
        {/* Header */}
        <div className="sticky top-0 backdrop-blur border-b px-5 py-4 z-10" style={{ backgroundColor: 'var(--modal-header-bg)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{task.task_no}</p>
              <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{task.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors shrink-0"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

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

          {/* Schedule Section */}
          <Section title="Schedule" icon="calendar">
            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Start Date" value={formatDate(startLabel)} />
              <DetailCard label="End Date" value={formatDate(endLabel)} />
              <DetailCard label="Duration" value={`${duration} business day${duration !== 1 ? 's' : ''}`} />
              <DetailCard label="Est. Hours" value={`${estimatedHours}h`} />
            </div>
            <div className="mt-3 rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: task.status === 'completed' ? '100%' : task.status === 'in_progress' ? '50%' : '0%',
                  backgroundColor: phaseColor,
                }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {task.status === 'completed' ? 'Task completed' : task.status === 'in_progress' ? 'In progress' : 'Not started'}
            </p>
          </Section>

          {/* People & Assignment */}
          <Section title="People" icon="users">
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-sm font-bold text-blue-400">
                  {task.assigned_to ? task.assigned_to.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {task.assigned_to || 'Unassigned'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Assigned to</p>
                </div>
              </div>
              {project?.client_name && (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                  <div className="w-9 h-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-sm font-bold text-emerald-400">
                    {project.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{project.client_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Client</p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Budget & Cost */}
          <Section title="Budget & Time" icon="dollar">
            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                label="Task Budget"
                value={taskBudget ? `$${Number(taskBudget).toLocaleString()}` : '\u2014'}
              />
              <DetailCard
                label="Contract Value"
                value={project?.contract_value ? `$${Number(project.contract_value).toLocaleString()}` : '\u2014'}
              />
              <DetailCard
                label="Hours Scheduled"
                value={`${estimatedHours}h`}
              />
              <DetailCard
                label="Rate"
                value={taskBudget && estimatedHours ? `$${Math.round(taskBudget / estimatedHours)}/hr` : '\u2014'}
              />
            </div>
          </Section>

          {/* Resources */}
          <Section title="Resources" icon="box">
            {task.resources && task.resources.length > 0 ? (
              <div className="space-y-2">
                {task.resources.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.name || r}</span>
                    {r.quantity && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x{r.quantity}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                <p>No resources listed</p>
                <p className="text-xs mt-1">Resources can be added via Supabase</p>
              </div>
            )}
          </Section>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <Section title="Dependencies" icon="link">
              <div className="space-y-1">
                {task.dependencies.map((dep, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>depends on</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{dep}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Notes */}
          <Section title="Notes" icon="note">
            {task.notes ? (
              <div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.notes}</p>
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No notes added</p>
            )}
          </Section>

          {/* Quick Actions */}
          <Section title="Update Status" icon="status">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange?.(task, s)}
                  disabled={task.status === s}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    task.status === s
                      ? 'cursor-default ring-2 ring-blue-500/30'
                      : 'cursor-pointer hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: task.status === s ? 'var(--bg-badge)' : 'var(--bg-card-hover)',
                    color: task.status === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderColor: task.status === s ? 'var(--border-secondary)' : 'var(--border-primary)',
                  }}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </Section>

          {/* Project Context */}
          {project && (
            <Section title="Project" icon="folder">
              <div className="space-y-2 text-xs">
                <DetailRow label="Project" value={project.project_name} />
                <DetailRow label="Number" value={project.project_no} mono />
                <DetailRow label="Type" value={project.business_type?.replace(/_/g, ' ')} />
                {project.site_address && <DetailRow label="Site" value={project.site_address} />}
                <DetailRow label="Phase" value={`Phase ${task.phase_no} \u2014 ${task.phase_name || ''}`} />
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 backdrop-blur border-t px-5 py-3 flex gap-2" style={{ backgroundColor: 'var(--modal-header-bg)', borderColor: 'var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
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
    calendar: '\uD83D\uDCC5',
    users: '\uD83D\uDC65',
    dollar: '\uD83D\uDCB0',
    box: '\uD83D\uDCE6',
    link: '\uD83D\uDD17',
    note: '\uD83D\uDCDD',
    status: '\uD83D\uDD04',
    folder: '\uD83D\uDCC1',
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span>{icons[icon] || ''}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-right max-w-[60%] truncate ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-secondary)' }}>
        {value || '\u2014'}
      </span>
    </div>
  )
}
