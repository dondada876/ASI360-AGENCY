import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
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

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ case_no: string }>
}) {
  const { case_no } = await params
  const supabase = await createClient()

  // Fetch case (RLS-filtered)
  const { data: caseData } = await supabase
    .from("vtiger_cases_cache")
    .select(
      "id, case_no, title, description, status, priority, category, resolution, created_at, modified_at, resolved_at, project_id, contact_name, organization_name"
    )
    .eq("case_no", case_no)
    .single()

  if (!caseData) notFound()

  // Fetch linked project name
  let projectName: string | null = null
  if (caseData.project_id) {
    const { data: proj } = await supabase
      .from("asi360_projects")
      .select("project_name, project_no")
      .eq("id", caseData.project_id)
      .single()
    projectName = proj?.project_name || proj?.project_no || null
  }

  // Fetch activity log (external only, via RLS)
  const { data: activities } = await supabase
    .from("case_activity_log")
    .select("id, author_name, author_role, action, content, created_at")
    .eq("case_no", case_no)
    .order("created_at", { ascending: true })

  const statusStyle =
    STATUS_COLORS[caseData.status] || STATUS_COLORS.Open
  const priorityColor =
    PRIORITY_COLORS[caseData.priority] || "text-slate-400"

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/portal/cases"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          &larr; All Cases
        </Link>
      </div>

      {/* Case Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono text-slate-500">
            {caseData.case_no}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}
          >
            {caseData.status}
          </span>
          <span className={`text-xs font-medium ${priorityColor}`}>
            {caseData.priority} Priority
          </span>
        </div>
        <h1 className="text-xl font-bold text-white">{caseData.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          {projectName && <span>Project: {projectName}</span>}
          {caseData.category && (
            <span className="capitalize">
              {caseData.category.replace(/_/g, " ")}
            </span>
          )}
          <span>
            Opened{" "}
            {new Date(caseData.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Case Description */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
          Description
        </h2>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {caseData.description}
        </p>
      </div>

      {/* Resolution (if available) */}
      {caseData.resolution && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-green-500 mb-3">
            Resolution
          </h2>
          <p className="text-sm text-green-300 whitespace-pre-wrap leading-relaxed">
            {caseData.resolution}
          </p>
          {caseData.resolved_at && (
            <p className="text-xs text-green-600 mt-3">
              Resolved on{" "}
              {new Date(caseData.resolved_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      <div className="mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
          Activity
        </h2>
        {activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((a) => (
              <div
                key={a.id}
                className="flex gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg"
              >
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0 mt-0.5">
                  {a.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300">
                      {a.author_name}
                    </span>
                    <span className="text-[10px] text-slate-600 capitalize">
                      {a.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-slate-700">
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {a.content && (
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">
                      {a.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 py-4">
            No activity recorded yet.
          </p>
        )}
      </div>

      {/* Case Meta */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-600 mb-0.5">Case ID</p>
            <p className="text-slate-300 font-mono">{caseData.case_no}</p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Status</p>
            <p className="text-slate-300">{caseData.status}</p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Last Updated</p>
            <p className="text-slate-300">
              {new Date(caseData.modified_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Contact</p>
            <p className="text-slate-300">
              {caseData.contact_name || caseData.organization_name || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
