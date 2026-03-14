import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Open: { bg: "bg-blue-500/20", text: "text-blue-400" },
  "In Progress": { bg: "bg-amber-500/20", text: "text-amber-400" },
  Assigned: { bg: "bg-purple-500/20", text: "text-purple-400" },
  "Wait for customer": { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  "Wait for 3rd party": { bg: "bg-orange-500/20", text: "text-orange-400" },
  Resolved: { bg: "bg-green-500/20", text: "text-green-400" },
  Closed: { bg: "bg-slate-700", text: "text-slate-400" },
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-slate-500",
  Normal: "text-slate-400",
  Medium: "text-amber-400",
  High: "text-orange-400",
  Urgent: "text-red-400",
}

export default async function CasesListPage() {
  const supabase = await createClient()

  // RLS-filtered: only cases this client owns
  const { data: cases, error } = await supabase
    .from("vtiger_cases_cache")
    .select(
      "id, case_no, title, status, priority, category, created_at, modified_at, resolved_at, project_id"
    )
    .order("created_at", { ascending: false })

  // Get project names for display
  const projectIds = [
    ...new Set(cases?.map((c) => c.project_id).filter(Boolean)),
  ]
  let projectMap: Record<number, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("asi360_projects")
      .select("id, project_name, project_no")
      .in("id", projectIds)
    projects?.forEach((p) => {
      projectMap[p.id] = p.project_name || p.project_no
    })
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <p className="font-semibold mb-2">Error loading cases</p>
          <p className="text-sm text-red-300">{error.message}</p>
        </div>
      </div>
    )
  }

  const openCases = cases?.filter(
    (c) => c.status !== "Closed" && c.status !== "Resolved"
  )
  const closedCases = cases?.filter(
    (c) => c.status === "Closed" || c.status === "Resolved"
  )

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Cases</h1>
          <p className="text-sm text-slate-400 mt-1">
            {openCases?.length || 0} open &bull;{" "}
            {closedCases?.length || 0} resolved
          </p>
        </div>
        <Link
          href="/portal/cases/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Case
        </Link>
      </div>

      {/* Open Cases */}
      {openCases && openCases.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
            Open Cases
          </h2>
          <div className="space-y-2">
            {openCases.map((c) => (
              <CaseRow
                key={c.id}
                caseData={c}
                projectName={c.project_id ? projectMap[c.project_id] : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed Cases */}
      {closedCases && closedCases.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
            Resolved / Closed
          </h2>
          <div className="space-y-2">
            {closedCases.map((c) => (
              <CaseRow
                key={c.id}
                caseData={c}
                projectName={c.project_id ? projectMap[c.project_id] : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!cases || cases.length === 0) && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">No support cases yet</p>
          <p className="text-sm mt-2">
            Create a new case when you need help with a project.
          </p>
          <Link
            href="/portal/cases/new"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Create Your First Case
          </Link>
        </div>
      )}
    </div>
  )
}

function CaseRow({
  caseData,
  projectName,
}: {
  caseData: {
    id: string
    case_no: string
    title: string
    status: string
    priority: string
    category: string
    created_at: string
    modified_at: string
  }
  projectName: string | null | undefined
}) {
  const statusStyle = STATUS_COLORS[caseData.status] || STATUS_COLORS.Open
  const priorityColor = PRIORITY_COLORS[caseData.priority] || "text-slate-400"

  return (
    <Link
      href={`/portal/cases/${caseData.case_no}`}
      className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors group"
    >
      {/* Case number */}
      <span className="text-xs font-mono text-slate-500 shrink-0 w-16">
        {caseData.case_no}
      </span>

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 group-hover:text-blue-400 transition-colors truncate">
          {caseData.title}
        </p>
        {projectName && (
          <p className="text-xs text-slate-600 truncate">{projectName}</p>
        )}
      </div>

      {/* Priority */}
      <span className={`text-[10px] font-medium shrink-0 ${priorityColor}`}>
        {caseData.priority}
      </span>

      {/* Status badge */}
      <span
        className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${statusStyle.bg} ${statusStyle.text}`}
      >
        {caseData.status}
      </span>

      {/* Date */}
      <span className="text-[10px] text-slate-600 shrink-0 w-20 text-right">
        {new Date(caseData.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>
    </Link>
  )
}
