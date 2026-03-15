import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Open: { bg: "bg-blue-500/20", text: "text-blue-400" },
  "In Progress": { bg: "bg-amber-500/20", text: "text-amber-400" },
  Assigned: { bg: "bg-purple-500/20", text: "text-purple-400" },
  "Wait for customer": { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  "Wait for 3rd party": { bg: "bg-orange-500/20", text: "text-orange-400" },
  Resolved: { bg: "bg-green-500/20", text: "text-green-400" },
  Closed: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: "text-gray-400 dark:text-slate-500",
  Normal: "text-gray-500 dark:text-slate-400",
  Medium: "text-amber-400",
  High: "text-orange-400",
  Urgent: "text-red-400",
}

export default async function AdminCasesPage() {
  const supabase = await createClient()

  // Admin sees ALL cases (RLS admin policy grants full access)
  const { data: cases } = await supabase
    .from("vtiger_cases_cache")
    .select(
      "id, case_no, vtiger_id, title, status, priority, category, sync_status, client_id, project_id, assigned_to, is_billable, created_at, modified_at, resolved_at"
    )
    .order("created_at", { ascending: false })

  // Get client names
  const clientIds = [...new Set(cases?.map((c) => c.client_id).filter(Boolean))]
  let clientMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("client_profiles")
      .select("id, display_name, company_name")
      .in("id", clientIds)
    clients?.forEach((c) => {
      clientMap[c.id] = c.company_name
        ? `${c.display_name} (${c.company_name})`
        : c.display_name
    })
  }

  // Get project names
  const projectIds = [...new Set(cases?.map((c) => c.project_id).filter(Boolean))]
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

  const openCases = cases?.filter(
    (c) => c.status !== "Closed" && c.status !== "Resolved"
  )
  const closedCases = cases?.filter(
    (c) => c.status === "Closed" || c.status === "Resolved"
  )
  const pendingSync = cases?.filter((c) => c.sync_status === "pending_sync")

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Cases</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {openCases?.length || 0} open &bull;{" "}
            {closedCases?.length || 0} resolved
            {pendingSync && pendingSync.length > 0 && (
              <span className="text-red-400 ml-2">
                &bull; {pendingSync.length} pending sync
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Pending Sync Alert */}
      {pendingSync && pendingSync.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400 font-medium">
            {pendingSync.length} case(s) pending VTiger sync
          </p>
          <p className="text-xs text-red-300/60 mt-1">
            These cases were created while the Gateway was unreachable. They will
            sync automatically when connectivity is restored.
          </p>
          <div className="mt-2 space-y-1">
            {pendingSync.map((c) => (
              <p key={c.id} className="text-xs text-red-300/80 font-mono">
                {c.case_no} — {c.title}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Open Cases */}
      {openCases && openCases.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Open Cases ({openCases.length})
          </h2>
          <div className="space-y-2">
            {openCases.map((c) => (
              <AdminCaseRow
                key={c.id}
                caseData={c}
                clientName={c.client_id ? clientMap[c.client_id] : null}
                projectName={c.project_id ? projectMap[c.project_id] : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed Cases */}
      {closedCases && closedCases.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Resolved / Closed ({closedCases.length})
          </h2>
          <div className="space-y-2">
            {closedCases.map((c) => (
              <AdminCaseRow
                key={c.id}
                caseData={c}
                clientName={c.client_id ? clientMap[c.client_id] : null}
                projectName={c.project_id ? projectMap[c.project_id] : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!cases || cases.length === 0) && (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <p className="text-lg">No cases in the system</p>
        </div>
      )}
    </div>
  )
}

function AdminCaseRow({
  caseData,
  clientName,
  projectName,
}: {
  caseData: {
    id: string
    case_no: string
    vtiger_id: string | null
    title: string
    status: string
    priority: string
    category: string
    sync_status: string
    assigned_to: string | null
    is_billable: boolean | null
    created_at: string
  }
  clientName: string | null | undefined
  projectName: string | null | undefined
}) {
  const statusStyle = STATUS_COLORS[caseData.status] || STATUS_COLORS.Open
  const priorityColor = PRIORITY_COLORS[caseData.priority] || "text-gray-500 dark:text-slate-400"

  return (
    <Link
      href={`/portal/cases/${caseData.case_no}`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-gray-400 dark:hover:border-slate-600 transition-colors group"
    >
      {/* Case number + sync status */}
      <div className="shrink-0 w-20">
        <span className="text-xs font-mono text-gray-400 dark:text-slate-500 block">
          {caseData.case_no}
        </span>
        {caseData.sync_status === "pending_sync" && (
          <span className="text-[8px] text-red-400">PENDING</span>
        )}
      </div>

      {/* Title + client + project */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 dark:text-slate-200 group-hover:text-blue-400 transition-colors truncate">
          {caseData.title}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-600">
          {clientName && <span>{clientName}</span>}
          {projectName && (
            <>
              <span>&bull;</span>
              <span>{projectName}</span>
            </>
          )}
          {caseData.assigned_to && (
            <>
              <span>&bull;</span>
              <span className="text-gray-400 dark:text-slate-500">
                Assigned: {caseData.assigned_to}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Category */}
      <span className="text-[10px] text-gray-400 dark:text-slate-600 capitalize shrink-0">
        {caseData.category?.replace(/_/g, " ")}
      </span>

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
      <span className="text-[10px] text-gray-400 dark:text-slate-600 shrink-0 w-16 text-right">
        {new Date(caseData.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>
    </Link>
  )
}
