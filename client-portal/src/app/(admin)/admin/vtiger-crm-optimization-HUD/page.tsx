import { getServiceClient } from "@/lib/vault"
import GanttHUD from "@/components/admin/GanttHUD"

// ── Types ─────────────────────────────────────────────────────────────────

export type HUDProject = {
  id: number
  project_no: string
  project_name: string
  slug: string
  project_status: string
  current_phase: number | null
  start_date: string | null
  target_close_date: string | null
  client_name: string | null
}

export type HUDTask = {
  id: number
  task_no: string
  task_name: string
  phase_no: number
  phase_name: string | null
  status: string
  start_date: string | null
  due_date: string | null
  end_date: string | null
  completed_date: string | null
  is_milestone: boolean
  assigned_to: string | null
  priority: string | null
}

export type GridConfig = {
  gridStart: string   // ISO date string (UTC midnight of grid start Monday)
  totalCols: number
  colWidth: "week" | "day"
  todayCol: number
}

// ── Grid computation (server-side) ────────────────────────────────────────

function parseUTCDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function computeGrid(
  project: HUDProject,
  tasks: HUDTask[]
): GridConfig | null {
  if (!project.start_date) return null

  // Normalize grid start to Monday of project's start week
  const gridStart = parseUTCDate(project.start_date)
  const dow = gridStart.getUTCDay()
  const daysToMon = dow === 0 ? -6 : 1 - dow
  gridStart.setUTCDate(gridStart.getUTCDate() + daysToMon)

  // Find furthest date across project + tasks
  const allEnds: Date[] = []
  if (project.target_close_date) allEnds.push(parseUTCDate(project.target_close_date))
  tasks.forEach((t) => {
    const d = t.due_date ?? t.end_date
    if (d) allEnds.push(parseUTCDate(d))
  })

  let gridEnd =
    allEnds.length > 0
      ? new Date(Math.max(...allEnds.map((d) => d.getTime())))
      : new Date()
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 14) // 2-week buffer

  const totalDays = Math.ceil(
    (gridEnd.getTime() - gridStart.getTime()) / 86400000
  )
  const useWeeks = totalDays > 28
  const colWidth: "week" | "day" = useWeeks ? "week" : "day"
  const totalCols = useWeeks ? Math.ceil(totalDays / 7) : totalDays

  // Today's column index
  const now = new Date()
  const todayDelta = (now.getTime() - gridStart.getTime()) / 86400000
  const todayCol =
    colWidth === "week" ? Math.floor(todayDelta / 7) : Math.floor(todayDelta)

  return {
    gridStart: gridStart.toISOString(),
    totalCols,
    colWidth,
    todayCol,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function VtigerCRMHUDPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const params = await searchParams
  const adminClient = getServiceClient() as any

  const { data: projects } = await adminClient
    .from("asi360_projects")
    .select(
      "id, project_no, project_name, slug, project_status, current_phase, start_date, target_close_date, client_name"
    )
    .order("project_no", { ascending: false })

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">No projects found in asi360_projects.</p>
      </div>
    )
  }

  const activeProject: HUDProject =
    (params.project
      ? projects.find((p: HUDProject) => p.project_no === params.project)
      : null) ?? projects[0]

  const { data: tasks } = await adminClient
    .from("asi360_project_tasks")
    .select(
      "id, task_no, task_name, phase_no, phase_name, status, start_date, due_date, end_date, completed_date, is_milestone, assigned_to, priority"
    )
    .eq("project_id", activeProject.id)
    .order("phase_no", { ascending: true })
    .order("id", { ascending: true })

  const grid = computeGrid(activeProject, tasks ?? [])

  return (
    <GanttHUD
      projects={projects}
      activeProjectNo={activeProject.project_no}
      activeProject={activeProject}
      tasks={tasks ?? []}
      grid={grid}
    />
  )
}
