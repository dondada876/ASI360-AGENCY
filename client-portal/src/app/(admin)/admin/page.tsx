import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Counts for overview
  const { count: clientCount } = await supabase
    .from("client_profiles")
    .select("id", { count: "exact", head: true })

  const { count: openCaseCount } = await supabase
    .from("vtiger_cases_cache")
    .select("id", { count: "exact", head: true })
    .neq("status", "Closed")
    .neq("status", "Resolved")

  const { count: totalCaseCount } = await supabase
    .from("vtiger_cases_cache")
    .select("id", { count: "exact", head: true })

  const { count: pendingSyncCount } = await supabase
    .from("vtiger_cases_cache")
    .select("id", { count: "exact", head: true })
    .eq("sync_status", "pending_sync")

  const { count: projectCount } = await supabase
    .from("asi360_projects")
    .select("id", { count: "exact", head: true })

  const { count: commentCount } = await supabase
    .from("project_comments")
    .select("id", { count: "exact", head: true })

  // Recent cases
  const { data: recentCases } = await supabase
    .from("vtiger_cases_cache")
    .select("id, case_no, title, status, priority, created_at, client_id")
    .order("created_at", { ascending: false })
    .limit(5)

  // Recent comments
  const { data: recentComments } = await supabase
    .from("project_comments")
    .select("id, author_name, author_role, content, created_at, project_id")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Portal overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Clients" value={clientCount || 0} />
        <StatCard label="Projects" value={projectCount || 0} />
        <StatCard
          label="Open Cases"
          value={openCaseCount || 0}
          accent={openCaseCount ? "text-amber-400" : undefined}
        />
        <StatCard label="Total Cases" value={totalCaseCount || 0} />
        <StatCard label="Comments" value={commentCount || 0} />
        <StatCard
          label="Pending Sync"
          value={pendingSyncCount || 0}
          accent={pendingSyncCount ? "text-red-400" : undefined}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <Link
          href="/admin/invite"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 transition-colors"
        >
          <span className="text-lg">+</span>
          <span className="text-sm font-medium">Invite New Client</span>
        </Link>
        <Link
          href="/admin/clients"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-600 transition-colors"
        >
          <span className="text-lg">&#9881;</span>
          <span className="text-sm font-medium">Manage Clients</span>
        </Link>
        <Link
          href="/admin/cases"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-600 transition-colors"
        >
          <span className="text-lg">&#9993;</span>
          <span className="text-sm font-medium">Manage Cases</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
            Recent Cases
          </h2>
          <div className="space-y-2">
            {recentCases?.map((c) => (
              <Link
                key={c.id}
                href={`/portal/cases/${c.case_no}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-gray-400 dark:hover:border-slate-600 transition-colors"
              >
                <span className="text-xs font-mono text-gray-400 dark:text-slate-500">
                  {c.case_no}
                </span>
                <span className="flex-1 text-sm text-gray-600 dark:text-slate-300 truncate">
                  {c.title}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">
                  {c.status}
                </span>
              </Link>
            ))}
            {(!recentCases || recentCases.length === 0) && (
              <p className="text-sm text-gray-400 dark:text-slate-600 py-2">No cases yet.</p>
            )}
          </div>
        </div>

        {/* Recent Comments */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
            Recent Comments
          </h2>
          <div className="space-y-2">
            {recentComments?.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                    {c.author_name}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-600 capitalize">
                    {c.author_role}
                  </span>
                  <span className="text-[10px] text-gray-300 dark:text-slate-700">
                    {new Date(c.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{c.content}</p>
              </div>
            ))}
            {(!recentComments || recentComments.length === 0) && (
              <p className="text-sm text-gray-400 dark:text-slate-600 py-2">No comments yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold ${accent || "text-gray-900 dark:text-white"}`}>{value}</p>
    </div>
  )
}
