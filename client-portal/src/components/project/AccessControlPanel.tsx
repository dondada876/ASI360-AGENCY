import Link from "next/link"
import { KeyRound } from "lucide-react"

interface Submission {
  id: string
  entry_count: number
  submission_status: string
  vtiger_case_no: string | null
  created_at: string
}

interface AccessControlPanelProps {
  projectId: number
  projectSlug: string
  submissions: Submission[]
  accessLevel: string
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: {
    bg: "bg-gray-200 dark:bg-slate-700",
    text: "text-gray-600 dark:text-slate-300",
    label: "Pending",
  },
  processing: {
    bg: "bg-blue-500/20",
    text: "text-blue-500 dark:text-blue-400",
    label: "Processing",
  },
  issued: {
    bg: "bg-green-500/20",
    text: "text-green-600 dark:text-green-400",
    label: "Issued",
  },
  pending_vtiger_sync: {
    bg: "bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    label: "Syncing",
  },
  failed: {
    bg: "bg-red-500/20",
    text: "text-red-500 dark:text-red-400",
    label: "Failed",
  },
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function AccessControlPanel({
  projectSlug,
  submissions,
  accessLevel,
}: AccessControlPanelProps) {
  const canRequest = accessLevel === "commenter" || accessLevel === "admin"
  const newLink = `/portal/projects/${projectSlug}?tab=access-control&action=new`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Access Control
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Manage Keri access control credential requests for your team.
          </p>
        </div>
        {canRequest && (
          <Link
            href={newLink}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Request Credentials
          </Link>
        )}
      </div>

      {/* Content */}
      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-12 flex flex-col items-center text-center">
          <KeyRound className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            No credential requests yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mb-6">
            Submit a credential request to get your team enrolled in the Keri
            access control system. Each request is processed within 2–3
            business days.
          </p>
          {canRequest ? (
            <Link
              href={newLink}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Request Door Access
            </Link>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic">
              Contact your ASI 360 project manager to enable credential access.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Date Submitted
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Staff Members
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-4 py-3 whitespace-nowrap">
                  Case #
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {submissions.map((sub) => {
                const statusKey = sub.submission_status?.toLowerCase() || "pending"
                const badge = STATUS_BADGE[statusKey] || STATUS_BADGE.pending
                return (
                  <tr
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {sub.entry_count} {sub.entry_count === 1 ? "staff member" : "staff members"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub.vtiger_case_no ? (
                        <span className="text-sm font-mono text-gray-400 dark:text-slate-500">
                          {sub.vtiger_case_no}
                        </span>
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
