"use client"

import { useRouter } from "next/navigation"
import { useMemo } from "react"
import type { HUDProject, HUDTask, GridConfig } from "@/app/(admin)/admin/vtiger-crm-optimization-HUD/page"

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<number, { hex: string; glow: string }> = {
  1: { hex: "#3b82f6", glow: "rgba(59,130,246,0.65)" },
  2: { hex: "#8b5cf6", glow: "rgba(139,92,246,0.65)" },
  3: { hex: "#f59e0b", glow: "rgba(245,158,11,0.65)" },
  4: { hex: "#10b981", glow: "rgba(16,185,129,0.65)" },
  5: { hex: "#06b6d4", glow: "rgba(6,182,212,0.65)" },
}

const PHASE_LABELS: Record<number, string> = {
  1: "Scope & Design",
  2: "Procurement",
  3: "Build & Install",
  4: "Testing & QA",
  5: "Close & Handoff",
}

const COL_PX_WEEK = 64
const COL_PX_DAY = 36
const ROW_H = 34
const PHASE_H = 40
const LABEL_W = 224
const HEADER_PERIOD_H = 28
const HEADER_COL_H = 26

// ── Helpers ────────────────────────────────────────────────────────────────

function parseUTCDate(s: string): Date {
  const datePart = s.split("T")[0]
  const [y, m, d] = datePart.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function dateToCol(
  dateStr: string | null,
  gridStart: Date,
  colWidth: "week" | "day"
): number {
  if (!dateStr) return -1
  const delta =
    (parseUTCDate(dateStr).getTime() - gridStart.getTime()) / 86400000
  return colWidth === "week" ? Math.floor(delta / 7) : Math.floor(delta)
}

function getPeriodLabels(
  gridStart: Date,
  totalCols: number,
  colWidth: "week" | "day"
) {
  const labels: { label: string; startCol: number; span: number }[] = []
  let curLabel = ""
  let spanStart = 0

  for (let i = 0; i < totalCols; i++) {
    const d = new Date(gridStart)
    if (colWidth === "week") d.setUTCDate(d.getUTCDate() + i * 7)
    else d.setUTCDate(d.getUTCDate() + i)

    const label = d.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })

    if (label !== curLabel) {
      if (curLabel) {
        labels.push({ label: curLabel, startCol: spanStart, span: i - spanStart })
      }
      curLabel = label
      spanStart = i
    }
  }
  if (curLabel) {
    labels.push({ label: curLabel, startCol: spanStart, span: totalCols - spanStart })
  }
  return labels
}

function getColLabel(
  i: number,
  gridStart: Date,
  colWidth: "week" | "day"
): string {
  const d = new Date(gridStart)
  if (colWidth === "week") d.setUTCDate(d.getUTCDate() + i * 7)
  else d.setUTCDate(d.getUTCDate() + i)

  if (colWidth === "week") {
    const mo = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    return `${mo}/${day}`
  }
  return ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()]
}

// ── Main Component ────────────────────────────────────────────────────────

export default function GanttHUD({
  projects,
  activeProjectNo,
  activeProject,
  tasks,
  grid,
}: {
  projects: HUDProject[]
  activeProjectNo: string
  activeProject: HUDProject
  tasks: HUDTask[]
  grid: GridConfig | null
}) {
  const router = useRouter()

  const tasksByPhase = useMemo(() => {
    const g: Record<number, HUDTask[]> = {}
    tasks.forEach((t) => {
      if (!g[t.phase_no]) g[t.phase_no] = []
      g[t.phase_no].push(t)
    })
    return g
  }, [tasks])

  const phases = useMemo(
    () => [...new Set(tasks.map((t) => t.phase_no))].sort((a, b) => a - b),
    [tasks]
  )

  const activePhasesSet = useMemo(() => {
    const s = new Set<number>()
    tasks.forEach((t) => {
      if (t.status === "in progress") s.add(t.phase_no)
    })
    return s
  }, [tasks])

  const onProjectSelect = (projectNo: string) => {
    router.push(`/admin/vtiger-crm-optimization-HUD?project=${projectNo}`)
  }

  if (!grid) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <HUDHeader
          projects={projects}
          activeProjectNo={activeProjectNo}
          onSelect={onProjectSelect}
          activeProject={activeProject}
        />
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          No timeline data — project is missing start or end dates.
        </div>
      </div>
    )
  }

  const gridStart = parseUTCDate(grid.gridStart)
  const { totalCols, colWidth, todayCol } = grid
  const COL_PX = colWidth === "week" ? COL_PX_WEEK : COL_PX_DAY
  const totalGridWidth = totalCols * COL_PX

  const periodLabels = getPeriodLabels(gridStart, totalCols, colWidth)
  const colLabels = Array.from({ length: totalCols }, (_, i) =>
    getColLabel(i, gridStart, colWidth)
  )

  // CSS repeating-gradient for vertical grid lines (no extra DOM elements)
  const gridLineBg: React.CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0px, transparent ${COL_PX - 1}px, rgba(148,163,184,0.07) ${COL_PX - 1}px, rgba(148,163,184,0.07) ${COL_PX}px)`,
    backgroundSize: `${COL_PX}px 100%`,
  }

  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes ganttGlow {
          0%, 100% { box-shadow: 0 0 4px 2px var(--glow-color); opacity: 0.9; }
          50%       { box-shadow: 0 0 18px 7px var(--glow-color); opacity: 1; }
        }
        .gantt-bar-active {
          animation: ganttGlow 2.2s ease-in-out infinite;
        }
        @keyframes todayPulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
        .today-line {
          animation: todayPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 flex flex-col">
        <HUDHeader
          projects={projects}
          activeProjectNo={activeProjectNo}
          onSelect={onProjectSelect}
          activeProject={activeProject}
        />

        {/* ── Gantt scrollable body ── */}
        <div className="flex-1 overflow-auto">
          <div
            className="flex"
            style={{ minWidth: LABEL_W + totalGridWidth }}
          >
            {/* ── Left sticky label column ── */}
            <div
              className="shrink-0 bg-slate-950 border-r border-slate-800 z-20"
              style={{ width: LABEL_W, position: "sticky", left: 0 }}
            >
              {/* Period header spacer */}
              <div
                className="bg-slate-900 border-b border-slate-700 flex items-center px-3"
                style={{ height: HEADER_PERIOD_H }}
              >
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  Task / Phase
                </span>
              </div>
              {/* Column header spacer */}
              <div
                className="bg-slate-900/50 border-b border-slate-800"
                style={{ height: HEADER_COL_H }}
              />

              {/* Phase + task label rows */}
              {phases.map((phaseNo) => {
                const pc = PHASE_COLORS[phaseNo] ?? PHASE_COLORS[1]
                const isActive = activePhasesSet.has(phaseNo)
                const phaseTasks = tasksByPhase[phaseNo] ?? []

                return (
                  <div key={phaseNo}>
                    {/* Phase header label */}
                    <div
                      className={`flex items-center gap-2 px-3 border-b border-slate-800 ${
                        isActive ? "bg-slate-900" : "bg-slate-900/30"
                      }`}
                      style={{
                        height: PHASE_H,
                        borderLeft: `3px solid ${isActive ? pc.hex : "transparent"}`,
                      }}
                    >
                      <span
                        className="text-[11px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0"
                        style={{
                          background: pc.hex + "28",
                          color: pc.hex,
                          border: `1px solid ${pc.hex}44`,
                        }}
                      >
                        {phaseNo}
                      </span>
                      <span className="text-xs font-semibold text-white truncate flex-1">
                        {PHASE_LABELS[phaseNo] ?? `Phase ${phaseNo}`}
                      </span>
                      {isActive && (
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-green-400">
                            LIVE
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Task labels */}
                    {phaseTasks.map((task) => {
                      const isInProgress = task.status === "in progress"
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2 px-3 pl-5 border-b border-slate-800/50 hover:bg-slate-900/40 transition-colors ${
                            isInProgress ? "bg-blue-950/20" : ""
                          }`}
                          style={{ height: ROW_H }}
                          title={`${task.task_no} — ${task.status}${task.assigned_to ? ` · ${task.assigned_to}` : ""}`}
                        >
                          {task.is_milestone ? (
                            <span
                              className="text-[11px] shrink-0"
                              style={{ color: pc.hex }}
                            >
                              ◆
                            </span>
                          ) : (
                            <span
                              className="w-1 h-3 rounded-sm shrink-0"
                              style={{ background: pc.hex + "99" }}
                            />
                          )}
                          <span
                            className={`text-[11px] truncate ${
                              isInProgress
                                ? "text-white font-medium"
                                : "text-slate-400"
                            }`}
                          >
                            {task.task_name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* ── Timeline area ── */}
            <div
              className="relative flex-shrink-0"
              style={{ width: totalGridWidth }}
            >
              {/* Period header (month labels) */}
              <div
                className="flex bg-slate-900 border-b border-slate-700"
                style={{ height: HEADER_PERIOD_H }}
              >
                {periodLabels.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[10px] font-semibold text-slate-400 border-r border-slate-700 shrink-0 overflow-hidden"
                    style={{ width: p.span * COL_PX }}
                  >
                    {p.span * COL_PX > 30 ? p.label : ""}
                  </div>
                ))}
              </div>

              {/* Column header (week/day labels) */}
              <div
                className="flex bg-slate-900/50 border-b border-slate-800"
                style={{ height: HEADER_COL_H }}
              >
                {colLabels.map((lbl, i) => {
                  const isToday = i === todayCol
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-center shrink-0 border-r border-slate-800/30 text-[9px] ${
                        isToday
                          ? "text-red-400 font-bold bg-red-500/10"
                          : "text-slate-600"
                      }`}
                      style={{ width: COL_PX }}
                    >
                      {lbl}
                    </div>
                  )
                })}
              </div>

              {/* Phase + task bar rows */}
              {phases.map((phaseNo) => {
                const pc = PHASE_COLORS[phaseNo] ?? PHASE_COLORS[1]
                const isActive = activePhasesSet.has(phaseNo)
                const phaseTasks = tasksByPhase[phaseNo] ?? []

                // Phase span bar: min start → max end of all tasks with dates
                const starts = phaseTasks
                  .map((t) => dateToCol(t.start_date, gridStart, colWidth))
                  .filter((c) => c >= 0)
                const ends = phaseTasks
                  .map((t) =>
                    dateToCol(t.due_date ?? t.end_date, gridStart, colWidth)
                  )
                  .filter((c) => c >= 0)
                const phaseBarStart = starts.length > 0 ? Math.min(...starts) : -1
                const phaseBarEnd = ends.length > 0 ? Math.max(...ends) + 1 : -1

                return (
                  <div key={phaseNo}>
                    {/* Phase header row */}
                    <div
                      className={`relative border-b border-slate-800 ${
                        isActive ? "bg-slate-900/80" : "bg-slate-900/25"
                      }`}
                      style={{ height: PHASE_H, ...gridLineBg }}
                    >
                      {phaseBarStart >= 0 && phaseBarEnd > phaseBarStart && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded"
                          style={{
                            left: phaseBarStart * COL_PX + 2,
                            width: Math.max(
                              (phaseBarEnd - phaseBarStart) * COL_PX - 4,
                              8
                            ),
                            height: 16,
                            background: pc.hex + "18",
                            border: `1px solid ${pc.hex}33`,
                          }}
                        />
                      )}
                    </div>

                    {/* Task rows */}
                    {phaseTasks.map((task) => {
                      const barStartCol = dateToCol(
                        task.start_date,
                        gridStart,
                        colWidth
                      )
                      const rawEnd = task.due_date ?? task.end_date
                      const barEndCol =
                        rawEnd !== null
                          ? dateToCol(rawEnd, gridStart, colWidth) + 1
                          : barStartCol >= 0
                          ? barStartCol + 1
                          : -1

                      const hasDates = barStartCol >= 0
                      const isInProgress = task.status === "in progress"
                      const isCompleted = task.status === "completed"
                      const barPx = hasDates
                        ? Math.max((barEndCol - barStartCol) * COL_PX - 4, 10)
                        : 0

                      return (
                        <div
                          key={task.id}
                          className={`relative border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors ${
                            isInProgress ? "bg-blue-950/10" : ""
                          }`}
                          style={{ height: ROW_H, ...gridLineBg }}
                        >
                          {hasDates && (
                            <>
                              {task.is_milestone ? (
                                /* Milestone: pulsing diamond */
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 z-10"
                                  style={{
                                    left: barStartCol * COL_PX + COL_PX / 2,
                                    background: pc.hex,
                                    boxShadow: `0 0 8px 3px ${pc.glow}`,
                                  }}
                                />
                              ) : (
                                /* Regular task bar */
                                <div
                                  className={`absolute top-1/2 -translate-y-1/2 rounded-sm flex items-center px-1.5 overflow-hidden ${
                                    isInProgress ? "gantt-bar-active" : ""
                                  }`}
                                  title={`${task.task_name} (${task.status})`}
                                  style={
                                    {
                                      left: barStartCol * COL_PX + 2,
                                      width: barPx,
                                      height: 22,
                                      background: isCompleted
                                        ? pc.hex + "66"
                                        : isInProgress
                                        ? pc.hex
                                        : pc.hex + "55",
                                      border: isInProgress
                                        ? `1px solid rgba(255,255,255,0.3)`
                                        : `1px solid ${pc.hex}44`,
                                      "--glow-color": pc.glow,
                                      zIndex: isInProgress ? 3 : 1,
                                    } as React.CSSProperties
                                  }
                                >
                                  {barPx > 28 && (
                                    <span className="text-[9px] text-white/80 font-medium truncate">
                                      {task.task_no}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* ── Today line ── */}
              {todayCol >= 0 && todayCol < totalCols && (
                <div
                  className="today-line absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{
                    left: todayCol * COL_PX + Math.floor(COL_PX / 2) - 1,
                    width: 2,
                  }}
                >
                  {/* TODAY badge */}
                  <div
                    className="absolute bg-red-500 text-white font-bold rounded whitespace-nowrap"
                    style={{
                      top: HEADER_PERIOD_H + 2,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 8,
                      padding: "1px 4px",
                      lineHeight: 1.4,
                    }}
                  >
                    TODAY
                  </div>
                  {/* Vertical line */}
                  <div
                    className="absolute w-0.5 bg-red-500/70"
                    style={{ top: 0, bottom: 0 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── HUD Header ─────────────────────────────────────────────────────────────

function HUDHeader({
  projects,
  activeProjectNo,
  onSelect,
  activeProject,
}: {
  projects: HUDProject[]
  activeProjectNo: string
  onSelect: (projectNo: string) => void
  activeProject: HUDProject
}) {
  const statusColor: Record<string, string> = {
    active: "text-green-400",
    "in progress": "text-blue-400",
    completed: "text-slate-500",
    on_hold: "text-amber-400",
    cancelled: "text-red-400",
  }

  const pc = PHASE_COLORS[activeProject.current_phase ?? 1] ?? PHASE_COLORS[1]

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center gap-5 shrink-0 flex-wrap">
      {/* Icon + title */}
      <div className="flex items-center gap-2.5">
        <GanttIcon className="w-5 h-5 text-blue-400 shrink-0" />
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">
            CRM Optimization HUD
          </h1>
          <p className="text-[10px] text-slate-500">Project Gantt Timeline</p>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-800 hidden sm:block" />

      {/* Project selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 shrink-0">Project:</span>
        <select
          value={activeProjectNo}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 max-w-xs"
        >
          {projects.map((p) => (
            <option key={p.project_no} value={p.project_no}>
              {p.project_no} — {p.project_name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-px h-8 bg-slate-800 hidden sm:block" />

      {/* Project metadata */}
      <div className="flex items-center gap-5 text-xs flex-wrap">
        {activeProject.client_name && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Client</span>
            <span className="text-slate-200">{activeProject.client_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Status</span>
          <span
            className={
              statusColor[activeProject.project_status] ?? "text-slate-300"
            }
          >
            {activeProject.project_status}
          </span>
        </div>
        {activeProject.current_phase !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Phase</span>
            <span className="font-semibold" style={{ color: pc.hex }}>
              {activeProject.current_phase} —{" "}
              {PHASE_LABELS[activeProject.current_phase] ??
                `Phase ${activeProject.current_phase}`}
            </span>
          </div>
        )}
        {activeProject.target_close_date && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Target Close</span>
            <span className="text-slate-200">
              {new Date(
                activeProject.target_close_date + "T12:00:00Z"
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Gantt Icon SVG ─────────────────────────────────────────────────────────

function GanttIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="10" height="3" rx="0.5" />
      <rect x="5" y="9" width="12" height="3" rx="0.5" />
      <rect x="2" y="15" width="9" height="3" rx="0.5" />
    </svg>
  )
}
