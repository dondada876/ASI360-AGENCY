import Link from "next/link"
import { Camera, AlertTriangle, FileText } from "lucide-react"

interface CameraItem {
  id: string
  camera_label: string
  camera_model: string | null
  location: string | null
  status: string
  nvr_channel: number | null
  install_date: string | null
}

interface CameraRequest {
  id: string
  request_type: string
  description: string
  urgency: string
  request_status: string
  vtiger_case_no: string | null
  github_issue_no: number | null
  github_issue_url: string | null
  created_at: string
}

interface CameraSystemsPanelProps {
  projectId: number
  projectSlug: string
  cameras: CameraItem[]
  requests: CameraRequest[]
  accessLevel: string
}

const CAMERA_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  planned: {
    bg: "bg-gray-200 dark:bg-slate-700",
    text: "text-gray-600 dark:text-slate-300",
    label: "Planned",
  },
  installed: {
    bg: "bg-blue-500/20",
    text: "text-blue-500 dark:text-blue-400",
    label: "Installed",
  },
  active: {
    bg: "bg-green-500/20",
    text: "text-green-600 dark:text-green-400",
    label: "Active",
  },
  offline: {
    bg: "bg-red-500/20",
    text: "text-red-500 dark:text-red-400",
    label: "Offline",
  },
  decommissioned: {
    bg: "bg-gray-100 dark:bg-slate-800",
    text: "text-gray-400 dark:text-slate-500",
    label: "Decommissioned",
  },
}

const REQUEST_STATUS: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-blue-500/20", text: "text-blue-500 dark:text-blue-400" },
  in_progress: { bg: "bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  resolved: { bg: "bg-green-500/20", text: "text-green-600 dark:text-green-400" },
  closed: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
}

const URGENCY_BADGE: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-500 dark:text-slate-400" },
  normal: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  high: { bg: "bg-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
  urgent: { bg: "bg-red-500/20", text: "text-red-600 dark:text-red-400" },
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function CameraSystemsPanel({
  projectSlug,
  cameras,
  requests,
  accessLevel,
}: CameraSystemsPanelProps) {
  const canRequest = accessLevel === "commenter" || accessLevel === "admin"
  const newLink = `/portal/projects/${projectSlug}?tab=cameras&action=new`

  return (
    <div className="space-y-10">
      {/* Section A: Camera Inventory */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Your Cameras
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Camera inventory for this project site.
        </p>

        {cameras.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-10 flex flex-col items-center text-center">
            <Camera className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              No cameras installed yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm">
              The NVR upgrade is in progress. Camera inventory will appear here
              once installation milestones are completed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cameras.map((cam) => {
              const statusKey = cam.status?.toLowerCase() || "planned"
              const badge = CAMERA_STATUS[statusKey] || CAMERA_STATUS.planned
              return (
                <div
                  key={cam.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
                      {cam.camera_label}
                    </p>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {cam.camera_model && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {cam.camera_model}
                    </p>
                  )}
                  {cam.location && (
                    <p className="text-xs text-gray-600 dark:text-slate-300 truncate">
                      {cam.location}
                    </p>
                  )}
                  {cam.nvr_channel != null && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">
                      NVR Ch. {cam.nvr_channel}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section B: Camera Service Requests */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Service Requests
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Submit and track camera service requests.
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

        {requests.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 dark:text-slate-500">
              No service requests yet. Choose an option to get started:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link
                href={`/portal/projects/${projectSlug}?tab=cameras&action=new&type=add`}
                className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl p-5 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group"
              >
                <Camera className="w-7 h-7 text-blue-500 mb-3" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Add a Camera
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Request installation of a new camera at a specific location.
                </p>
              </Link>
              <Link
                href={`/portal/projects/${projectSlug}?tab=cameras&action=new&type=issue`}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors group"
              >
                <AlertTriangle className="w-7 h-7 text-amber-500 mb-3" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Report an Issue
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Camera offline, poor image quality, or angle adjustment
                  needed.
                </p>
              </Link>
              <Link
                href={`/portal/projects/${projectSlug}?tab=cameras&action=new&type=quote`}
                className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-xl p-5 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors group"
              >
                <FileText className="w-7 h-7 text-purple-500 mb-3" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Request Quote
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Get pricing for additional cameras or system expansion.
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
                    Detail
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
                  const statusKey = req.request_status?.toLowerCase() || "open"
                  const statusBadge = REQUEST_STATUS[statusKey] || REQUEST_STATUS.open
                  const urgencyKey = req.urgency?.toLowerCase() || "normal"
                  const urgencyBadge = URGENCY_BADGE[urgencyKey] || URGENCY_BADGE.normal
                  const detail = req.description
                    ? req.description.length > 60
                      ? req.description.slice(0, 60) + "…"
                      : req.description
                    : "—"
                  return (
                    <tr
                      key={req.id}
                      className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300 whitespace-nowrap capitalize">
                        {req.request_type?.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 max-w-[240px]">
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
    </div>
  )
}
