import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function ManageClientsPage() {
  const supabase = await createClient()

  // Fetch all client profiles with their project access counts
  const { data: clients } = await supabase
    .from("client_profiles")
    .select("id, display_name, email, company_name, role, is_active, phone, vtiger_contact_id, created_at")
    .order("created_at", { ascending: false })

  // Get project access for each client
  const { data: accessRecords } = await supabase
    .from("client_project_access")
    .select("client_id, project_id, access_level")

  // Get all projects for name resolution
  const { data: projects } = await supabase
    .from("asi360_projects")
    .select("id, project_name, project_no")

  const projectMap: Record<number, { name: string; no: string }> = {}
  projects?.forEach((p) => {
    projectMap[p.id] = { name: p.project_name || p.project_no, no: p.project_no }
  })

  // Group access by client
  const accessByClient: Record<string, { project_id: number; access_level: string }[]> = {}
  accessRecords?.forEach((a) => {
    if (!accessByClient[a.client_id]) accessByClient[a.client_id] = []
    accessByClient[a.client_id].push(a)
  })

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Clients</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {clients?.length || 0} registered clients
          </p>
        </div>
        <Link
          href="/admin/invite"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Invite Client
        </Link>
      </div>

      {/* Client Cards */}
      <div className="space-y-4">
        {clients?.map((client) => {
          const clientAccess = accessByClient[client.id] || []
          return (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-slate-300 shrink-0">
                  {client.display_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {client.display_name}
                    </h3>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        client.role === "admin"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                      }`}
                    >
                      {client.role}
                    </span>
                    {!client.is_active && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {client.email}
                    {client.company_name && (
                      <span className="text-gray-400 dark:text-slate-600 ml-2">
                        &bull; {client.company_name}
                      </span>
                    )}
                    {client.phone && (
                      <span className="text-gray-400 dark:text-slate-600 ml-2">
                        &bull; {client.phone}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1">
                    Joined{" "}
                    {new Date(client.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {client.vtiger_contact_id && (
                      <span className="ml-2">
                        &bull; VTiger: {client.vtiger_contact_id}
                      </span>
                    )}
                  </p>

                  {/* Project Access */}
                  {clientAccess.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">
                        Project Access ({clientAccess.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {clientAccess.map((a) => {
                          const proj = projectMap[a.project_id]
                          return (
                            <span
                              key={a.project_id}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                            >
                              <span className="font-mono text-gray-400 dark:text-slate-500">
                                {proj?.no || `#${a.project_id}`}
                              </span>
                              <span className="truncate max-w-[140px]">
                                {proj?.name || "Unknown"}
                              </span>
                              <span
                                className={`ml-1 ${
                                  a.access_level === "admin"
                                    ? "text-amber-400"
                                    : a.access_level === "commenter"
                                    ? "text-blue-400"
                                    : "text-gray-400 dark:text-slate-500"
                                }`}
                              >
                                ({a.access_level})
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {clientAccess.length === 0 && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-2 italic">
                      No project access assigned
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {(!clients || clients.length === 0) && (
          <div className="text-center py-12 text-gray-400 dark:text-slate-500">
            <p className="text-lg">No clients registered yet</p>
            <Link
              href="/admin/invite"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Invite Your First Client
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
