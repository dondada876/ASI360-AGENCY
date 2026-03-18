import Link from "next/link"
import { Phone, UserPlus, AlertTriangle, FileText } from "lucide-react"

interface IntercomRequest {
  id: string
  request_type: string
  door_location: string | null
  urgency: string
  description: string
  request_status: string
  vtiger_case_no: string | null
  github_issue_no: number | null
  github_issue_url: string | null
  created_at: string
}

interface IntercomPanelProps {
  projectId: number
  projectSlug: string
  requests: IntercomRequest[]
  accessLevel: string
}

const REQUEST_STATUS: Record<string, { bg: string; text: string }> = {
  submitted:          { bg: "bg-blue-500/20",   text: "text-blue-500 dark:text-blue-400" },
  reviewing:          { bg: "bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
  scheduled:          { bg: "bg-amber-500/20",  text: "text-amber-600 dark:text-amber-400" },
  in_progress:        { bg: "bg-amber-500/20",  text: "text-amber-600 dark:text-amber-400" },
  resolved:           { bg: "bg-green-500/20",  text: "text-green-600 dark:text-green-400" },
  pending_vtiger_sync:{ bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
}

const URGENCY_BADGE: Record<string, { bg: string; text: string }> = {
  low:    { bg: "bg-gray-100 dark:bg-slate-800",   text: "text-gray-500 dark:text-slate-400" },
  normal: { bg: "bg-blue-50 dark:bg-blue-500/10",  text: "text-blue-600 dark:text-blue-400" },
  high:   { bg: "bg-orange-500/20",                text: "text-orange-600 dark:text-orange-400" },
  urgent: { bg: "bg-red-500/20",                   text: "text-red-600 dark:text-red-400" },
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  new_install:  "New Installation",
  add_user:     "Add User",
  remove_user:  "Remove User",
  issue:        "Report Issue",
  quote:        "Request Quote",
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function IntercomPanel({
  projectSlug,
  requests,
  accessLevel,
}: IntercomPanelProps) {
  const canRequest = accessLevel === "commenter" || accessLevel === "admin"
  const newLink = `/portal/projects/${projectSlug}?tab=intercoms&action=new`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Intercom &amp; Door Entry
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Submit and track requests for intercom systems, door entry, and access hardware.
          </p>
        </div>
        {canRequest && (
          <Link
            href={newLink}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New Request
          </Link>
        )}
      </div>

      {/* Content */}
      {requests.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 dark:text-slate-500">
            No requests yet. Choose an option to get started:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href={`/portal/projects/${projectSlug}?tab=intercoms&action=new&type=new_install`}
              className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl p-5 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
            >
              <Phone className="w-7 h-7 text-blue-500 mb-3" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                New Installation
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Install an intercom, video entry, or door access system.
              </p>
            </Link>
            <Link
              href={`/portal/projects/${projectSlug}?tab=intercoms&action=new&type=add_user`}
              className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-800/60 rounded-xl p-5 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors"
            >
              <UserPlus className="w-7 h-7 text-green-500 mb-3" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Add / Remove User
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Grant or revoke door entry access for a staff member or vendor.
              </p>
            </Link>
            <Link
              href={`/portal/projects/${projectSlug}?tab=intercoms&action=new&type=issue`}
              className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors"
            >
              <AlertTriangle className="w-7 h-7 text-amber-500 mb-3" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Report Issue
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Intercom not working, door not unlocking, or entry system offline.
              </p>
            </Link>
            <Link
              href={`/portal/projects/${projectSlug}?tab=intercoms&action=new&type=quote`}
              className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-xl p-5 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
            >
              <FileText className="w-7 h-7 text-purple-500 mb-3" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Request Quote
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Get pricing for a new system, expansion, or upgrade.
              </p>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Date
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Request Type
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3">
                  Door / Detail
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Urgency
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Case #
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  GH Issue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {requests.map((req) => {
                const statusKey = req.request_status?.toLowerCase() || "submitted"
                const statusBadge = REQUEST_STATUS[statusKey] || REQUEST_STATUS.submitted
                const urgencyKey = req.urgency?.toLowerCase() || "normal"
                const urgencyBadge = URGENCY_BADGE[urgencyKey] || URGENCY_BADGE.normal
                const detail = req.door_location
                  ? req.door_location
                  : req.description.length > 60
                  ? req.description.slice(0, 60) + "…"
                  : req.description
                return (
                  <tr
                    key={req.id}
                    className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 max-w-[220px]">
                      {detail}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${urgencyBadge.bg} ${urgencyBadge.text}`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}>
                        {req.request_status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {req.vtiger_case_no ? (
                        <span className="text-sm font-mono text-gray-400 dark:text-slate-500">
                          {req.vtiger_case_no}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {req.github_issue_url ? (
                        <a
                          href={req.github_issue_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          #{req.github_issue_no}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
