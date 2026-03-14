import { useState, useEffect, useRef } from 'react'
import { StatusBadge, PhaseBadge } from './PhaseBadge'
import { getPhaseColor } from '../lib/scheduler'
import { updateTaskDetails } from '../lib/supabase'

/**
 * TaskDetailModal v3 — Slide-over drawer with theme support.
 */
export default function TaskDetailModal({ task, project, dayLabels, onClose, onStatusChange, onTaskUpdate }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  // Editable fields state
  const [editIsMilestone, setEditIsMilestone] = useState(task?.is_milestone || false)
  const [editEstHours, setEditEstHours] = useState(task?.estimated_hours || '')
  const [editActHours, setEditActHours] = useState(task?.actual_hours || '')
  const [editTaskBudget, setEditTaskBudget] = useState(task?.task_budget || task?.budget || '')
  const [editCostActual, setEditCostActual] = useState(task?.cost_actual || '')
  const [editRiskLevel, setEditRiskLevel] = useState(task?.risk_level || 'normal')
  const [editDeps, setEditDeps] = useState((task?.dependencies || []).join(', '))
  const [editStartDate, setEditStartDate] = useState(task?.start_date ? task.start_date.slice(0, 10) : '')
  const [editEndDate, setEditEndDate] = useState(task?.end_date ? task.end_date.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  // Project date constraints for min/max on date pickers
  const projectStartDate = project?.start_date ? project.start_date.slice(0, 10) : ''
  const projectEndDate = project?.target_close_date ? project.target_close_date.slice(0, 10) : ''
  const hasManualDates = !!(editStartDate || editEndDate)

  async function handleSaveDetails() {
    if (!task?.id) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const updates = {
        is_milestone: editIsMilestone,
        estimated_hours: editEstHours ? Number(editEstHours) : null,
        actual_hours: editActHours ? Number(editActHours) : 0,
        task_budget: editTaskBudget ? Number(editTaskBudget) : null,
        cost_actual: editCostActual ? Number(editCostActual) : 0,
        risk_level: editRiskLevel,
        dependencies: editDeps ? editDeps.split(',').map(s => s.trim()).filter(Boolean) : [],
        start_date: editStartDate || null,
        end_date: editEndDate || null,
      }
      await updateTaskDetails(task.id, updates)
      setSaveMsg('Saved')
      onTaskUpdate?.()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err) {
      setSaveMsg(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

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
              <DetailCard label="Scheduled Start" value={formatDate(startLabel)} />
              <DetailCard label="Scheduled End" value={formatDate(endLabel)} />
              <DetailCard label="Duration" value={`${duration} business day${duration !== 1 ? 's' : ''}`} />
              <DetailCard label="Est. Hours" value={`${estimatedHours}h`} />
            </div>

            {/* Manual Date Overrides */}
            <div className="mt-3 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: hasManualDates ? 'var(--accent-blue, #3b82f6)' : 'var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {hasManualDates && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--accent-blue, #3b82f6)' }}>
                      <path d="M6 1v5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  )}
                  <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: hasManualDates ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)' }}>
                    {hasManualDates ? 'Manually Scheduled' : 'Set Manual Dates'}
                  </p>
                </div>
                {hasManualDates && (
                  <button
                    onClick={() => { setEditStartDate(''); setEditEndDate('') }}
                    className="text-[10px] px-2 py-0.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)' }}
                    title="Clear manual dates — task reverts to auto-scheduled position"
                  >
                    Clear dates
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    min={projectStartDate || undefined}
                    max={editEndDate || projectEndDate || undefined}
                    className="w-full bg-transparent text-sm font-medium outline-none border-b transition-colors focus:border-blue-500"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)', colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={e => setEditEndDate(e.target.value)}
                    min={editStartDate || projectStartDate || undefined}
                    max={projectEndDate || undefined}
                    className="w-full bg-transparent text-sm font-medium outline-none border-b transition-colors focus:border-blue-500"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)', colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
                  />
                </div>
              </div>
              {projectStartDate && projectEndDate && (
                <p className="text-[9px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Contract window: {formatDate(projectStartDate)} — {formatDate(projectEndDate)}
                </p>
              )}
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

          {/* Budget & Time — Editable */}
          <Section title="Budget & Time" icon="dollar">
            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Est. Hours" value={editEstHours} onChange={setEditEstHours} type="number" placeholder="0" />
              <EditableField label="Actual Hours" value={editActHours} onChange={setEditActHours} type="number" placeholder="0" />
              <EditableField label="Task Budget ($)" value={editTaskBudget} onChange={setEditTaskBudget} type="number" placeholder="0" />
              <EditableField label="Cost Actual ($)" value={editCostActual} onChange={setEditCostActual} type="number" placeholder="0" />
            </div>
            {editEstHours > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Hours Progress</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                    {editActHours || 0} / {editEstHours}h ({Math.min(100, Math.round(((editActHours || 0) / editEstHours) * 100))}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((editActHours || 0) / editEstHours) * 100))}%`,
                      backgroundColor: ((editActHours || 0) / editEstHours) > 1 ? '#ef4444' : phaseColor,
                    }}
                  />
                </div>
              </div>
            )}
            {editTaskBudget > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Budget Burn</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                    ${Number(editCostActual || 0).toLocaleString()} / ${Number(editTaskBudget).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((editCostActual || 0) / editTaskBudget) * 100))}%`,
                      backgroundColor: ((editCostActual || 0) / editTaskBudget) > 1 ? '#ef4444' : '#3b82f6',
                    }}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* Risk & Milestone — Editable */}
          <Section title="Risk & Milestone" icon="status">
            <div className="space-y-3">
              {/* Milestone toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Milestone</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Mark as project milestone</p>
                </div>
                <button
                  onClick={() => setEditIsMilestone(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${editIsMilestone ? 'bg-purple-500' : ''}`}
                  style={!editIsMilestone ? { backgroundColor: 'var(--progress-track)' } : {}}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
                    style={{ left: editIsMilestone ? '22px' : '2px' }}
                  />
                </button>
              </div>

              {/* Risk level */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Risk Level</p>
                <div className="flex gap-2">
                  {['normal', 'medium', 'high', 'critical'].map(level => (
                    <button
                      key={level}
                      onClick={() => setEditRiskLevel(level)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-all capitalize ${editRiskLevel === level ? 'ring-1' : ''}`}
                      style={{
                        backgroundColor: editRiskLevel === level
                          ? level === 'critical' ? 'rgba(239,68,68,0.15)' : level === 'high' ? 'rgba(249,115,22,0.15)' : level === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)'
                          : 'var(--bg-card)',
                        color: editRiskLevel === level
                          ? level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'medium' ? '#eab308' : '#22c55e'
                          : 'var(--text-muted)',
                        borderColor: editRiskLevel === level
                          ? level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'medium' ? '#eab308' : '#22c55e'
                          : 'var(--border-primary)',
                        ...(editRiskLevel === level ? { '--tw-ring-color': level === 'critical' ? '#ef444440' : level === 'high' ? '#f9731640' : level === 'medium' ? '#eab30840' : '#22c55e40' } : {}),
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dependencies */}
              <EditableField
                label="Dependencies (comma-separated task numbers)"
                value={editDeps}
                onChange={setEditDeps}
                placeholder="e.g. 1.1, 1.2"
              />
            </div>
          </Section>

          {/* Save button for editable fields */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDetails}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saveMsg && (
              <span className={`text-xs font-medium ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {saveMsg}
              </span>
            )}
          </div>

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

function EditableField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
      <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-medium outline-none border-b transition-colors focus:border-blue-500"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--border-primary)' }}
      />
    </div>
  )
}
