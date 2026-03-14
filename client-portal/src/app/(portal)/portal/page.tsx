import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

const PHASE_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#8b5cf6",
  3: "#f59e0b",
  4: "#10b981",
  5: "#06b6d4",
}

const STATUS_DOTS: Record<string, string> = {
  initiated: "bg-gray-400",
  "in progress": "bg-blue-400",
  "on hold": "bg-yellow-400",
  completed: "bg-green-400",
  delivered: "bg-emerald-400",
}

export default async function PortalHomePage() {
  const supabase = await createClient()

  // RLS-filtered: only projects this client has access to
  const { data: projects, error } = await supabase
    .from("asi360_projects")
    .select("id, project_no, project_name, slug, client_name, project_status, current_phase, start_date, target_close_date, contract_value, business_type, health_score")
    .order("created_at", { ascending: false })

  // Get ticket counts per project (for badge)
  const { data: ticketCounts } = await supabase
    .from("vtiger_tickets_ref")
    .select("project_id")
    .neq("status", "Closed")

  const ticketsByProject: Record<string, number> = {}
  ticketCounts?.forEach((t) => {
    if (t.project_id) {
      ticketsByProject[t.project_id] = (ticketsByProject[t.project_id] || 0) + 1
    }
  })

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <p className="font-semibold mb-2">Error loading projects</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Your Projects</h1>
        <p className="text-sm text-slate-400 mt-1">
          {projects?.length || 0} active project{(projects?.length || 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Project Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((proj) => {
          const status = (proj.project_status || "initiated").toLowerCase()
          const dotClass = STATUS_DOTS[status] || STATUS_DOTS.initiated
          const phase = proj.current_phase || 1
          const phaseColor = PHASE_COLORS[phase] || "#3b82f6"
          const tickets = ticketsByProject[proj.id] || 0

          return (
            <Link
              key={proj.id}
              href={`/portal/projects/${proj.slug || proj.project_no}`}
              className="group block rounded-xl border border-slate-800 bg-slate-900 p-5 transition-all hover:border-slate-600"
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                  <span className="text-xs font-mono text-slate-500">{proj.project_no}</span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${phaseColor}22`, color: phaseColor }}
                >
                  Phase {phase}
                </span>
              </div>

              {/* Project name */}
              <h2 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                {proj.project_name || proj.project_no}
              </h2>
              <p className="text-xs text-slate-500 mt-1 truncate">
                {proj.client_name || "No client"}
              </p>

              {/* Meta row */}
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                {proj.business_type && (
                  <span className="capitalize">{proj.business_type.replace(/_/g, " ")}</span>
                )}
                {tickets > 0 && (
                  <span className="text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {tickets} ticket{tickets !== 1 ? "s" : ""} in progress
                  </span>
                )}
              </div>

              {/* Phase progress bar */}
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
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

      {(!projects || projects.length === 0) && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">No projects assigned yet</p>
          <p className="text-sm mt-2">
            Your project manager will grant you access to your projects.
          </p>
        </div>
      )}
    </div>
  )
}
