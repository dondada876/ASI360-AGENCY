import { createClient } from "@/lib/supabase/server"

export default async function AdminNotificationsPage() {
  const supabase = await createClient()

  // Recent notifications across all clients
  const { data: notifications } = await supabase
    .from("client_notifications")
    .select(
      "id, client_id, project_id, case_no, type, title, message, priority, read, delivery_channels, delivery_status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50)

  // Get client names
  const clientIds = [
    ...new Set(notifications?.map((n) => n.client_id).filter(Boolean)),
  ]
  const clientMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("client_profiles")
      .select("id, display_name, email")
      .in("id", clientIds)
    clients?.forEach((c) => {
      clientMap[c.id] = c.display_name
    })
  }

  // Stats
  const totalCount = notifications?.length || 0
  const unreadCount = notifications?.filter((n) => !n.read).length || 0
  const deliveredCount =
    notifications?.filter(
      (n) =>
        n.delivery_status &&
        typeof n.delivery_status === "object" &&
        (n.delivery_status as Record<string, string>).resend_id
    ).length || 0

  const TYPE_ICONS: Record<string, string> = {
    project_update: "📊",
    case_alert: "🎫",
    comment_reply: "💬",
    ticket_update: "🔧",
    weekly_digest: "📋",
    welcome: "👋",
    system_alert: "⚠️",
    document_ready: "📄",
    task_completed: "✅",
    phase_advanced: "🚀",
  }

  const PRIORITY_STYLES: Record<string, string> = {
    urgent: "text-red-400 bg-red-500/20",
    high: "text-orange-400 bg-orange-500/20",
    normal: "text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-700",
    low: "text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800",
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Notifications
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {totalCount} total &bull; {unreadCount} unread &bull;{" "}
          {deliveredCount} email delivered
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
            Total Sent
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
            Unread
          </p>
          <p
            className={`text-xl font-bold ${
              unreadCount > 0 ? "text-amber-400" : "text-gray-900 dark:text-white"
            }`}
          >
            {unreadCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
            Email Delivered
          </p>
          <p className="text-xl font-bold text-green-400">{deliveredCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
            Read Rate
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalCount > 0
              ? Math.round(((totalCount - unreadCount) / totalCount) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {notifications?.map((n) => {
          const icon = TYPE_ICONS[n.type] || "🔔"
          const priorityStyle =
            PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.normal
          const deliveryInfo = n.delivery_status as Record<string, string> | null
          const hasResendId = deliveryInfo?.resend_id

          return (
            <div
              key={n.id}
              className={`px-4 py-3 rounded-xl border transition-colors ${
                n.read
                  ? "bg-white dark:bg-slate-900/50 border-gray-200 dark:border-slate-800/50"
                  : "bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-lg shrink-0 mt-0.5">{icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {n.title}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Client */}
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      To: {clientMap[n.client_id] || "Unknown"}
                    </span>

                    {/* Type */}
                    <span className="text-[10px] text-gray-400 dark:text-slate-600">
                      &bull; {n.type.replace(/_/g, " ")}
                    </span>

                    {/* Priority badge */}
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityStyle}`}
                    >
                      {n.priority}
                    </span>

                    {/* Case reference */}
                    {n.case_no && (
                      <span className="text-[10px] font-mono text-gray-400 dark:text-slate-600">
                        &bull; {n.case_no}
                      </span>
                    )}

                    {/* Email delivery status */}
                    {hasResendId && (
                      <span className="text-[10px] text-green-500">
                        &bull; Email sent
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-gray-400 dark:text-slate-600 shrink-0">
                  {new Date(n.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )
        })}
        {(!notifications || notifications.length === 0) && (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <p className="text-lg">No notifications sent yet</p>
            <p className="text-sm mt-2">
              Notifications are sent automatically when project status changes,
              cases are updated, or new comments are posted.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
