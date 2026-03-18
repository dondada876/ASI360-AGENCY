"use client"

import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { useTheme } from "next-themes"
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
  0: "Pre-Start",
  1: "Scope & Design",
  2: "Procurement",
  3: "Build & Install",
  4: "Testing & QA",
  5: "Close & Handoff",
}

const VTIGER_TASK_URL = (id: string) =>
  `https://allsysinc.od1.vtiger.com/index.php?module=ProjectTask&action=DetailView&record=${id}`

const COL_PX_WEEK = 64
const COL_PX_DAY = 36
const ROW_H = 34
const PHASE_H = 40
const LABEL_W = 240
const HEADER_PERIOD_H = 28
const HEADER_COL_H = 26

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().trim()
}

function cleanTaskName(taskName: string, projectNo: string): string {
  let name = taskName
  name = name.replace(new RegExp(`^${projectNo}-[\\d.]+\\s+`), "")
  name = name.replace(/^PROJ\d+-[\d.]+\s+/, "")
  name = name.replace(/^J\.\d+[a-z]?\s+/i, "")
  name = name.replace(/\s+\d+\.\d+$/, "")
  return name.trim() || taskName
}

function parseUTCDate(s: string): Date {
  const datePart = s.split("T")[0]
  const [y, m, d] = datePart.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function dateToCol(dateStr: string | null, gridStart: Date, colWidth: "week" | "day"): number {
  if (!dateStr) return -1
  const delta = (parseUTCDate(dateStr).getTime() - gridStart.getTime()) / 86400000
  return colWidth === "week" ? Math.floor(delta / 7) : Math.floor(delta)
}

function getPeriodLabels(gridStart: Date, totalCols: number, colWidth: "week" | "day") {
  const labels: { label: string; startCol: number; span: number }[] = []
  let curLabel = ""
  let spanStart = 0
  for (let i = 0; i < totalCols; i++) {
    const d = new Date(gridStart)
    if (colWidth === "week") d.setUTCDate(d.getUTCDate() + i * 7)
    else d.setUTCDate(d.getUTCDate() + i)
    const label = d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
    if (label !== curLabel) {
      if (curLabel) labels.push({ label: curLabel, startCol: spanStart, span: i - spanStart })
      curLabel = label
      spanStart = i
    }
  }
  if (curLabel) labels.push({ label: curLabel, startCol: spanStart, span: totalCols - spanStart })
  return labels
}

function getColLabel(i: number, gridStart: Date, colWidth: "week" | "day"): string {
  const d = new Date(gridStart)
  if (colWidth === "week") d.setUTCDate(d.getUTCDate() + i * 7)
  else d.setUTCDate(d.getUTCDate() + i)
  if (colWidth === "week") return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return ["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()]
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source || source === "manual") return null
  const map: Record<string, { label: string; color: string }> = {
    vtiger: { label: "VT", color: "#f97316" },
    airtable: { label: "AT", color: "#eab308" },
    airtable_sync: { label: "AT", color: "#eab308" },
    gateway: { label: "GW", color: "#6366f1" },
    mcp: { label: "MC", color: "#8b5cf6" },
  }
  const badge = map[source.toLowerCase()]
  if (!badge) return null
  return (
    <span
      className="text-[8px] font-bold px-1 rounded shrink-0"
      style={{ background: badge.color + "33", color: badge.color, border: `1px solid ${badge.color}44` }}
    >
      {badge.label}
    </span>
  )
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

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
      if (normalizeStatus(t.status) === "in progress") s.add(t.phase_no)
    })
    return s
  }, [tasks])

  const onProjectSelect = (projectNo: string) => {
    router.push(`/admin/vtiger-crm-optimization-HUD?project=${projectNo}`)
  }

  const onTaskClick = (task: HUDTask) => {
    if (task.vtiger_task_id) {
      window.open(VTIGER_TASK_URL(task.vtiger_task_id), "_blank", "noopener")
    } else {
      router.push(`/portal/projects/${activeProject.slug ?? activeProjectNo}`)
    }
  }

  if (!grid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
        <HUDHeader projects={projects} activeProjectNo={activeProjectNo} onSelect={onProjectSelect} activeProject={activeProject} />
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
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
  const colLabels = Array.from({ length: totalCols }, (_, i) => getColLabel(i, gridStart, colWidth))

  // Grid line colour adapts to theme
  const gridLineColor = isDark ? "rgba(148,163,184,0.07)" : "rgba(0,0,0,0.06)"
  const gridLineBg: React.CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0px, transparent ${COL_PX - 1}px, ${gridLineColor} ${COL_PX - 1}px, ${gridLineColor} ${COL_PX}px)`,
    backgroundSize: `${COL_PX}px 100%`,
  }

  return (
    <>
      <style>{`
        @keyframes ganttGlow {
          0%, 100% { box-shadow: 0 0 4px 2px var(--glow-color); opacity: 0.9; }
          50%       { box-shadow: 0 0 18px 7px var(--glow-color); opacity: 1; }
        }
        .gantt-bar-active { animation: ganttGlow 2.2s ease-in-out infinite; }
        @keyframes todayPulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
        .today-line { animation: todayPulse 2s ease-in-out infinite; }
        .gantt-task-row:hover .gantt-bar-fill { filter: brightness(1.2); }
      `}</style>

      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
        <HUDHeader projects={projects} activeProjectNo={activeProjectNo} onSelect={onProjectSelect} activeProject={activeProject} />

        <div className="flex-1 overflow-auto">
          <div className="flex" style={{ minWidth: LABEL_W + totalGridWidth }}>

            {/* ── Sticky left label column ── */}
            <div
              className="shrink-0 bg-gray-50 dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 z-20"
              style={{ width: LABEL_W, position: "sticky", left: 0 }}
            >
              {/* Period header spacer */}
              <div
                className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center px-3"
                style={{ height: HEADER_PERIOD_H }}
              >
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  Task / Phase
                </span>
              </div>
              {/* Col header spacer */}
              <div className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-800" style={{ height: HEADER_COL_H }} />

              {phases.map((phaseNo) => {
                const pc = PHASE_COLORS[phaseNo] ?? PHASE_COLORS[1]
                const isActive = activePhasesSet.has(phaseNo)
                const phaseTasks = tasksByPhase[phaseNo] ?? []
                const phaseLabel =
                  phaseTasks[0]?.phase_name?.replace(/^Phase \d+:\s*/, "") ||
                  PHASE_LABELS[phaseNo] ||
                  `Phase ${phaseNo}`

                return (
                  <div key={phaseNo}>
                    {/* Phase header label */}
                    <div
                      className={`flex items-center gap-2 px-3 border-b border-gray-200 dark:border-slate-800 ${
                        isActive
                          ? "bg-white dark:bg-slate-900"
                          : "bg-gray-50/50 dark:bg-slate-900/30"
                      }`}
                      style={{ height: PHASE_H, borderLeft: `3px solid ${isActive ? pc.hex : "transparent"}` }}
                    >
                      <span
                        className="text-[11px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0"
                        style={{ background: pc.hex + "28", color: pc.hex, border: `1px solid ${pc.hex}44` }}
                      >
                        {phaseNo}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white truncate flex-1">{phaseLabel}</span>
                      {isActive && (
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-green-500 dark:text-green-400">LIVE</span>
                        </span>
                      )}
                    </div>

                    {/* Task label rows */}
                    {phaseTasks.map((task) => {
                      const ns = normalizeStatus(task.status)
                      const isInProgress = ns === "in progress"
                      const displayName = cleanTaskName(task.task_name, activeProjectNo)

                      return (
                        <div
                          key={task.id}
                          className={`gantt-task-row flex items-center gap-1.5 px-2 pl-4 border-b border-gray-100 dark:border-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-900/50 transition-colors cursor-pointer ${
                            isInProgress ? "bg-blue-50 dark:bg-blue-950/20" : ""
                          }`}
                          style={{ height: ROW_H }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.task_no} — ${task.task_name}\nStatus: ${task.status}${task.assigned_to ? `\nAssigned: ${task.assigned_to}` : ""}${task.vtiger_task_id ? "\n↗ Click to open in VTiger" : ""}`}
                        >
                          {/* task_no pill — always bound before name */}
                          <span
                            className="text-[9px] font-mono font-bold px-1 rounded shrink-0 tabular-nums"
                            style={{
                              background: pc.hex + "22",
                              color: pc.hex,
                              border: `1px solid ${pc.hex}33`,
                              minWidth: 26,
                              textAlign: "center",
                            }}
                          >
                            {task.task_no}
                          </span>

                          {task.is_milestone && (
                            <span className="text-[10px] shrink-0" style={{ color: pc.hex }}>◆</span>
                          )}

                          <span
                            className={`text-[11px] truncate flex-1 ${
                              isInProgress
                                ? "text-gray-900 dark:text-white font-medium"
                                : "text-gray-500 dark:text-slate-400"
                            }`}
                          >
                            {displayName}
                          </span>

                          <SourceBadge source={task.modified_source} />

                          {task.vtiger_task_id && (
                            <span className="text-[9px] text-orange-400/60 shrink-0">↗</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* ── Timeline area ── */}
            <div className="relative flex-shrink-0" style={{ width: totalGridWidth }}>

              {/* Period header */}
              <div className="flex bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700" style={{ height: HEADER_PERIOD_H }}>
                {periodLabels.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-slate-400 border-r border-gray-200 dark:border-slate-700 shrink-0 overflow-hidden"
                    style={{ width: p.span * COL_PX }}
                  >
                    {p.span * COL_PX > 30 ? p.label : ""}
                  </div>
                ))}
              </div>

              {/* Column header */}
              <div className="flex bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-800" style={{ height: HEADER_COL_H }}>
                {colLabels.map((lbl, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center shrink-0 border-r border-gray-100 dark:border-slate-800/30 text-[9px] ${
                      i === todayCol
                        ? "text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10"
                        : "text-gray-400 dark:text-slate-600"
                    }`}
                    style={{ width: COL_PX }}
                  >
                    {lbl}
                  </div>
                ))}
              </div>

              {/* Phase + task rows */}
              {phases.map((phaseNo) => {
                const pc = PHASE_COLORS[phaseNo] ?? PHASE_COLORS[1]
                const isActive = activePhasesSet.has(phaseNo)
                const phaseTasks = tasksByPhase[phaseNo] ?? []

                const starts = phaseTasks.map((t) => dateToCol(t.start_date, gridStart, colWidth)).filter((c) => c >= 0)
                const ends = phaseTasks.map((t) => dateToCol(t.due_date ?? t.end_date, gridStart, colWidth)).filter((c) => c >= 0)
                const phaseBarStart = starts.length > 0 ? Math.min(...starts) : -1
                const phaseBarEnd = ends.length > 0 ? Math.max(...ends) + 1 : -1

                return (
                  <div key={phaseNo}>
                    {/* Phase span row */}
                    <div
                      className={`relative border-b border-gray-200 dark:border-slate-800 ${
                        isActive ? "bg-white dark:bg-slate-900/80" : "bg-gray-50/30 dark:bg-slate-900/25"
                      }`}
                      style={{ height: PHASE_H, ...gridLineBg }}
                    >
                      {phaseBarStart >= 0 && phaseBarEnd > phaseBarStart && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded"
                          style={{
                            left: phaseBarStart * COL_PX + 2,
                            width: Math.max((phaseBarEnd - phaseBarStart) * COL_PX - 4, 8),
                            height: 16,
                            background: pc.hex + "18",
                            border: `1px solid ${pc.hex}33`,
                          }}
                        />
                      )}
                    </div>

                    {/* Task rows */}
                    {phaseTasks.map((task) => {
                      const ns = normalizeStatus(task.status)
                      const isInProgress = ns === "in progress"
                      const isCompleted = ns === "completed"
                      const isDeferred = ns === "deferred" || ns === "cancelled"
                      const hasNoDate = !task.start_date && !task.due_date && !task.end_date

                      const barStartCol = dateToCol(task.start_date, gridStart, colWidth)
                      const rawEnd = task.due_date ?? task.end_date
                      const barEndCol =
                        rawEnd !== null
                          ? dateToCol(rawEnd, gridStart, colWidth) + 1
                          : barStartCol >= 0
                          ? barStartCol + 1
                          : -1
                      const hasDates = barStartCol >= 0
                      const barPx = hasDates ? Math.max((barEndCol - barStartCol) * COL_PX - 4, 10) : 0
                      const barColor = isCompleted
                        ? pc.hex + "88"
                        : isInProgress
                        ? pc.hex
                        : isDeferred
                        ? (isDark ? "#475569" : "#94a3b8")
                        : pc.hex + "55"

                      return (
                        <div
                          key={task.id}
                          className={`gantt-task-row relative border-b border-gray-100 dark:border-slate-800/40 hover:bg-gray-50 dark:hover:bg-slate-900/20 transition-colors cursor-pointer ${
                            isInProgress ? "bg-blue-50/50 dark:bg-blue-950/10" : ""
                          }`}
                          style={{ height: ROW_H, ...gridLineBg }}
                          onClick={() => onTaskClick(task)}
                        >
                          {/* Undated placeholder */}
                          {hasNoDate && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 rounded-sm"
                              style={{
                                left: 2,
                                right: 2,
                                height: 4,
                                backgroundImage: `repeating-linear-gradient(90deg, ${pc.hex}33 0px, ${pc.hex}33 6px, transparent 6px, transparent 12px)`,
                              }}
                            />
                          )}

                          {hasDates && (
                            <>
                              {task.is_milestone ? (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 z-10"
                                  style={{
                                    left: barStartCol * COL_PX + COL_PX / 2,
                                    background: pc.hex,
                                    boxShadow: `0 0 8px 3px ${pc.glow}`,
                                  }}
                                />
                              ) : (
                                <div
                                  className={`gantt-bar-fill absolute top-1/2 -translate-y-1/2 rounded-sm flex items-center px-1.5 overflow-hidden ${
                                    isInProgress ? "gantt-bar-active" : ""
                                  }`}
                                  style={
                                    {
                                      left: barStartCol * COL_PX + 2,
                                      width: barPx,
                                      height: 22,
                                      background: barColor,
                                      border: isInProgress
                                        ? `1px solid rgba(255,255,255,0.3)`
                                        : `1px solid ${pc.hex}44`,
                                      "--glow-color": pc.glow,
                                      zIndex: isInProgress ? 3 : 1,
                                      opacity: isDeferred ? 0.5 : 1,
                                    } as React.CSSProperties
                                  }
                                >
                                  {barPx > 28 && (
                                    <span className="text-[9px] text-white font-mono font-medium truncate">
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
                  style={{ left: todayCol * COL_PX + Math.floor(COL_PX / 2) - 1, width: 2 }}
                >
                  <div
                    className="absolute bg-red-500 text-white font-bold rounded whitespace-nowrap"
                    style={{ top: HEADER_PERIOD_H + 2, left: "50%", transform: "translateX(-50%)", fontSize: 8, padding: "1px 4px", lineHeight: 1.4 }}
                  >
                    TODAY
                  </div>
                  <div className="absolute w-0.5 bg-red-500/70" style={{ top: 0, bottom: 0 }} />
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
    active: "text-green-600 dark:text-green-400",
    "in progress": "text-blue-600 dark:text-blue-400",
    in_progress: "text-blue-600 dark:text-blue-400",
    completed: "text-gray-400 dark:text-slate-500",
    on_hold: "text-amber-600 dark:text-amber-400",
    cancelled: "text-red-500 dark:text-red-400",
  }

  const pc = PHASE_COLORS[activeProject.current_phase ?? 1] ?? PHASE_COLORS[1]

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-5 py-3 flex items-center gap-5 shrink-0 flex-wrap">
      <div className="flex items-center gap-2.5">
        <GanttIcon className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />
        <div>
          <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">CRM Optimization HUD</h1>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">Project Gantt Timeline</p>
        </div>
      </div>

      <div className="w-px h-8 bg-gray-200 dark:bg-slate-800 hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 dark:text-slate-400 shrink-0">Project:</span>
        <select
          value={activeProjectNo}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 max-w-xs"
        >
          {projects.map((p) => (
            <option key={p.project_no} value={p.project_no}>
              {p.project_no} — {p.project_name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-px h-8 bg-gray-200 dark:bg-slate-800 hidden sm:block" />

      <div className="flex items-center gap-5 text-xs flex-wrap">
        {activeProject.client_name && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-slate-500">Client</span>
            <span className="text-gray-700 dark:text-slate-200">{activeProject.client_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 dark:text-slate-500">Status</span>
          <span className={statusColor[activeProject.project_status] ?? "text-gray-700 dark:text-slate-300"}>
            {activeProject.project_status}
          </span>
        </div>
        {activeProject.current_phase !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-slate-500">Phase</span>
            <span className="font-semibold" style={{ color: pc.hex }}>
              {activeProject.current_phase} —{" "}
              {PHASE_LABELS[activeProject.current_phase] ?? `Phase ${activeProject.current_phase}`}
            </span>
          </div>
        )}
        {activeProject.target_close_date && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-slate-500">Target Close</span>
            <span className="text-gray-700 dark:text-slate-200">
              {new Date(activeProject.target_close_date + "T12:00:00Z").toLocaleDateString("en-US", {
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

function GanttIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="10" height="3" rx="0.5" />
      <rect x="5" y="9" width="12" height="3" rx="0.5" />
      <rect x="2" y="15" width="9" height="3" rx="0.5" />
    </svg>
  )
}
