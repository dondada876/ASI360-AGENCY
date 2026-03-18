import { createClient } from "@/lib/supabase/server"

const EVENT_ICONS: Record<string, string> = {
  login_success: "✅",
  login_failed: "❌",
  logout: "🚪",
  password_change: "🔑",
  password_reset_requested: "📧",
  password_reset_completed: "🔓",
  account_created: "👤",
  account_deactivated: "🚫",
  account_reactivated: "♻️",
  role_changed: "🏷️",
  invite_sent: "📨",
  invite_accepted: "🤝",
  captcha_failed: "🤖",
  mfa_enabled: "🔐",
  mfa_disabled: "⚠️",
  session_expired: "⏰",
}

const EVENT_SEVERITY: Record<string, string> = {
  login_failed: "text-red-400",
  account_deactivated: "text-red-400",
  captcha_failed: "text-red-400",
  mfa_disabled: "text-amber-400",
  password_reset_requested: "text-amber-400",
  session_expired: "text-gray-500 dark:text-slate-400",
  login_success: "text-green-400",
  account_created: "text-green-400",
  invite_accepted: "text-green-400",
  password_reset_completed: "text-green-400",
  mfa_enabled: "text-blue-400",
  logout: "text-gray-500 dark:text-slate-400",
  invite_sent: "text-blue-400",
  role_changed: "text-purple-400",
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—"
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default async function AuditLogPage() {
  const supabase = await createClient()

  // Fetch recent events (limit 200 for comprehensive view)
  const { data: events, count } = await supabase
    .from("auth_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200)

  // ── Aggregate stats ──
  const failedLogins =
    events?.filter((e) => e.event_type === "login_failed").length || 0
  const successLogins =
    events?.filter((e) => e.event_type === "login_success").length || 0
  const logouts =
    events?.filter((e) => e.event_type === "logout").length || 0
  const accountsCreated =
    events?.filter((e) => e.event_type === "account_created").length || 0

  // Average session duration (from login events that have duration)
  const sessionsWithDuration =
    events?.filter(
      (e) =>
        e.event_type === "login_success" && e.session_duration_seconds !== null
    ) || []
  const avgSessionDuration =
    sessionsWithDuration.length > 0
      ? Math.round(
          sessionsWithDuration.reduce(
            (sum, e) => sum + (e.session_duration_seconds || 0),
            0
          ) / sessionsWithDuration.length
        )
      : null

  // Unique IPs
  const uniqueIps = new Set(
    events?.map((e) => e.ip_address).filter(Boolean)
  ).size

  // ── Client Engagement Summary ──
  // Group logins by email to see who's active
  const loginsByEmail: Record<
    string,
    { count: number; last: string; avgDuration: number | null; role: string }
  > = {}
  events
    ?.filter((e) => e.event_type === "login_success" && e.email)
    .forEach((e) => {
      const email = e.email!
      if (!loginsByEmail[email]) {
        loginsByEmail[email] = {
          count: 0,
          last: e.created_at,
          avgDuration: null,
          role:
            (e.metadata as Record<string, string> | null)?.role || "unknown",
        }
      }
      loginsByEmail[email].count++
      if (e.created_at > loginsByEmail[email].last) {
        loginsByEmail[email].last = e.created_at
      }
    })

  // Calculate avg duration per user
  for (const email of Object.keys(loginsByEmail)) {
    const userSessions = sessionsWithDuration.filter(
      (e) => e.email === email
    )
    if (userSessions.length > 0) {
      loginsByEmail[email].avgDuration = Math.round(
        userSessions.reduce(
          (sum, e) => sum + (e.session_duration_seconds || 0),
          0
        ) / userSessions.length
      )
    }
  }

  const engagementList = Object.entries(loginsByEmail)
    .sort((a, b) => b[1].count - a[1].count)

  // ── Comment & Case Activity (engagement tracking) ──
  const { count: totalComments } = await supabase
    .from("project_comments")
    .select("id", { count: "exact", head: true })

  const { count: totalCases } = await supabase
    .from("vtiger_cases_cache")
    .select("id", { count: "exact", head: true })

  // Comments per author (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: recentComments } = await supabase
    .from("project_comments")
    .select("author_name, author_role, created_at")
    .gte("created_at", thirtyDaysAgo)

  const commentsByAuthor: Record<
    string,
    { count: number; role: string; last: string }
  > = {}
  recentComments?.forEach((c) => {
    if (!commentsByAuthor[c.author_name]) {
      commentsByAuthor[c.author_name] = {
        count: 0,
        role: c.author_role,
        last: c.created_at,
      }
    }
    commentsByAuthor[c.author_name].count++
    if (c.created_at > commentsByAuthor[c.author_name].last) {
      commentsByAuthor[c.author_name].last = c.created_at
    }
  })

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Auth Audit Log
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {count || 0} total events &bull; Session tracking &bull; Client
          engagement
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <StatCard label="Logins" value={successLogins} color="text-green-400" />
        <StatCard
          label="Failed"
          value={failedLogins}
          color={failedLogins > 0 ? "text-red-400" : undefined}
        />
        <StatCard label="Logouts" value={logouts} />
        <StatCard label="Accounts" value={accountsCreated} />
        <StatCard
          label="Fail Rate"
          value={`${
            successLogins + failedLogins > 0
              ? Math.round(
                  (failedLogins / (successLogins + failedLogins)) * 100
                )
              : 0
          }%`}
          color={failedLogins > 3 ? "text-red-400" : undefined}
        />
        <StatCard
          label="Avg Session"
          value={avgSessionDuration ? formatDuration(avgSessionDuration) : "—"}
        />
        <StatCard label="Unique IPs" value={uniqueIps} />
      </div>

      {/* ── Client Engagement ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Login Engagement */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Client Login Activity
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_80px_70px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
              <span>User</span>
              <span className="text-right">Logins</span>
              <span className="text-right">Avg Time</span>
              <span className="text-right">Last</span>
            </div>
            {engagementList.length > 0 ? (
              engagementList.map(([email, data]) => (
                <div
                  key={email}
                  className="grid grid-cols-[1fr_60px_80px_70px] gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-slate-800/50 last:border-0"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-gray-700 dark:text-slate-200 truncate block">
                      {email}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-600 capitalize">
                      {data.role}
                    </span>
                  </div>
                  <span className="text-xs text-gray-900 dark:text-white text-right font-mono">
                    {data.count}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 text-right">
                    {data.avgDuration
                      ? formatDuration(data.avgDuration)
                      : "—"}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-600 text-right">
                    {new Date(data.last).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-xs text-gray-400 dark:text-slate-600 text-center">
                No login data yet
              </p>
            )}
          </div>
        </div>

        {/* Comment & Case Engagement */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
            Portal Engagement (Last 30 Days)
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Total Comments
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {totalComments || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Total Cases Created
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {totalCases || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Comments (30d)
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {recentComments?.length || 0}
              </span>
            </div>

            {Object.keys(commentsByAuthor).length > 0 && (
              <>
                <div className="h-px bg-gray-200 dark:bg-slate-800" />
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  Active Commenters
                </p>
                {Object.entries(commentsByAuthor)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([name, data]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs text-gray-700 dark:text-slate-200">
                          {name}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-600 ml-1 capitalize">
                          ({data.role})
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-900 dark:text-white">
                        {data.count}
                      </span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Event Log ── */}
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
        Event Log (Last 200)
      </h2>
      <div className="space-y-1">
        {events?.map((event) => {
          const icon = EVENT_ICONS[event.event_type] || "📝"
          const severity =
            EVENT_SEVERITY[event.event_type] ||
            "text-gray-500 dark:text-slate-400"
          const meta =
            event.metadata && typeof event.metadata === "object"
              ? (event.metadata as Record<string, unknown>)
              : {}

          return (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
            >
              <span className="text-sm shrink-0">{icon}</span>

              <span
                className={`text-[10px] font-mono w-28 shrink-0 ${severity}`}
              >
                {event.event_type.replace(/_/g, " ")}
              </span>

              {/* Email + role */}
              <span className="text-xs text-gray-600 dark:text-slate-300 truncate flex-1 min-w-0">
                {event.email || "—"}
                {meta.role && (
                  <span className="text-gray-400 dark:text-slate-600 ml-1">
                    ({String(meta.role)})
                  </span>
                )}
                {meta.reason && (
                  <span className="text-red-400/70 ml-2 text-[10px]">
                    {String(meta.reason).substring(0, 50)}
                  </span>
                )}
                {meta.invited_email && (
                  <span className="text-blue-400/70 ml-2 text-[10px]">
                    &rarr; {String(meta.invited_email)}
                  </span>
                )}
              </span>

              {/* IP address */}
              {event.ip_address && (
                <span className="text-[10px] font-mono text-gray-400 dark:text-slate-600 shrink-0 w-24 text-right">
                  {event.ip_address}
                </span>
              )}

              {/* Session duration */}
              {event.session_duration_seconds !== null &&
                event.session_duration_seconds !== undefined && (
                  <span className="text-[10px] font-medium text-blue-400 shrink-0 w-14 text-right">
                    {formatDuration(event.session_duration_seconds)}
                  </span>
                )}

              {/* Timestamp */}
              <span className="text-[10px] text-gray-400 dark:text-slate-600 shrink-0 w-28 text-right">
                {new Date(event.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          )
        })}
        {(!events || events.length === 0) && (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <p className="text-lg">No auth events recorded yet</p>
            <p className="text-sm mt-2">
              Events will appear here after users log in. Each event captures
              IP address, user agent, and session duration.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
        {label}
      </p>
      <p
        className={`text-xl font-bold ${color || "text-gray-900 dark:text-white"}`}
      >
        {value}
      </p>
    </div>
  )
}
