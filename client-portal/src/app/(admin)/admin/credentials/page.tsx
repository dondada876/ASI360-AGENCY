import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"
import SyncStatusCell from "@/components/admin/SyncStatusCell"

// ── Status badge styles ────────────────────────────────────────────────────

const SUBMISSION_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-amber-500/20", text: "text-amber-400" },
  processing: { bg: "bg-blue-500/20", text: "text-blue-400" },
  issued: { bg: "bg-green-500/20", text: "text-green-400" },
  failed: { bg: "bg-red-500/20", text: "text-red-400" },
}

const ENTRY_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-amber-500/20", text: "text-amber-400" },
  approved: { bg: "bg-blue-500/20", text: "text-blue-400" },
  issued: { bg: "bg-green-500/20", text: "text-green-400" },
  purged: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
  rejected: { bg: "bg-red-500/20", text: "text-red-400" },
}

// ── Types ──────────────────────────────────────────────────────────────────

type CredentialEntry = {
  id: string
  submission_id: string
  full_name: string | null
  email: string | null
  role: string | null
  entry_method: string | null
  schedule: string | null
  credential_status: string | null
  created_at: string
}

type CredentialSubmission = {
  id: string
  project_id: number | null
  client_id: string | null
  status: string
  vtiger_case_no: string | null
  vtiger_synced_at: string | null
  airtable_row_id: string | null
  airtable_synced_at: string | null
  created_at: string
  notes: string | null
  // populated manually:
  project_name?: string
  client_name?: string
  entries?: CredentialEntry[]
  entry_count?: number
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function AdminCredentialsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = getServiceClient() as any

  // ── Fetch submissions ──
  const { data: submissions } = await adminClient
    .from("credential_submissions")
    .select("id, project_id, client_id, status, vtiger_case_no, vtiger_synced_at, airtable_row_id, airtable_synced_at, created_at, notes")
    .order("created_at", { ascending: false })

  // ── Fetch all entries (one query, join in JS) ──
  const submissionIds = (submissions || []).map((s: CredentialSubmission) => s.id)
  let allEntries: CredentialEntry[] = []
  if (submissionIds.length > 0) {
    const { data: entries } = await adminClient
      .from("credential_entries")
      .select(
        "id, submission_id, full_name, email, role, entry_method, schedule, credential_status, created_at"
      )
      .in("submission_id", submissionIds)
      .order("created_at", { ascending: true })
    allEntries = entries || []
  }

  // ── Resolve project names ──
  const projectIds = [
    ...new Set(
      (submissions || []).map((s: CredentialSubmission) => s.project_id).filter(Boolean)
    ),
  ] as number[]
  const projectMap: Record<number, string> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("asi360_projects")
      .select("id, project_name, project_no")
      .in("id", projectIds)
    projects?.forEach((p) => {
      projectMap[p.id] = p.project_name || p.project_no
    })
  }

  // ── Resolve client names ──
  const clientIds = [
    ...new Set(
      (submissions || []).map((s: CredentialSubmission) => s.client_id).filter(Boolean)
    ),
  ] as string[]
  const clientMap: Record<string, string> = {}
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

  // ── Group entries by submission ──
  const entriesBySubmission: Record<string, CredentialEntry[]> = {}
  allEntries.forEach((e) => {
    if (!entriesBySubmission[e.submission_id]) entriesBySubmission[e.submission_id] = []
    entriesBySubmission[e.submission_id].push(e)
  })

  // ── Enrich submissions ──
  const enriched: CredentialSubmission[] = (submissions || []).map(
    (s: CredentialSubmission) => ({
      ...s,
      project_name: s.project_id ? projectMap[s.project_id] : undefined,
      client_name: s.client_id ? clientMap[s.client_id] : undefined,
      entries: entriesBySubmission[s.id] || [],
      entry_count: (entriesBySubmission[s.id] || []).length,
    })
  )

  // ── Metrics ──
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const submittedThisMonth = enriched.filter(
    (s) => s.created_at >= startOfMonth
  ).length
  const totalIssued = enriched.filter((s) => s.status === "issued").length
  const totalPending = enriched.filter((s) => s.status === "pending").length
  const totalEntries = allEntries.length
  const issuedEntries = allEntries.filter(
    (e) => e.credential_status === "issued"
  ).length

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Credential Requests
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          All access control credential submissions
        </p>
      </div>

      {/* Metric Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard
          label="Submitted This Month"
          value={submittedThisMonth}
          accent={submittedThisMonth > 0 ? "text-blue-400" : undefined}
        />
        <StatCard
          label="Total Issued"
          value={totalIssued}
          accent="text-green-400"
        />
        <StatCard
          label="Pending"
          value={totalPending}
          accent={totalPending > 0 ? "text-amber-400" : undefined}
        />
        <StatCard label="Total Staff Entries" value={totalEntries} />
        <StatCard
          label="Credentials Issued"
          value={issuedEntries}
          accent="text-green-400"
        />
      </div>

      {/* Submissions Table */}
      {enriched.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_1.5fr_100px_80px_90px_120px_130px_150px] gap-3 px-5 py-3 border-b border-gray-200 dark:border-slate-800">
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Project
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Client
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Submitted
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500 text-center">
              Staff
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Status
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              VTiger Case
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Sync
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Actions
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
            {enriched.map((sub) => (
              <SubmissionRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <p className="text-lg">No credential submissions yet</p>
          <p className="text-sm mt-2 text-gray-400 dark:text-slate-600">
            Submissions will appear here when clients send access control staff lists.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Submission Row (server component — expandable section rendered inline) ──

function SubmissionRow({ submission }: { submission: CredentialSubmission }) {
  const statusStyle =
    SUBMISSION_STATUS_STYLES[submission.status] || SUBMISSION_STATUS_STYLES.pending

  return (
    <div>
      {/* Main row */}
      <div className="grid grid-cols-[1.5fr_1.5fr_100px_80px_90px_120px_130px_150px] gap-3 px-5 py-4 items-center hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
        {/* Project */}
        <div className="min-w-0">
          <p className="text-sm text-gray-700 dark:text-slate-200 truncate">
            {submission.project_name || (
              <span className="text-gray-400 dark:text-slate-600 italic">No project</span>
            )}
          </p>
          {submission.project_id && (
            <p className="text-[10px] font-mono text-gray-400 dark:text-slate-600">
              #{submission.project_id}
            </p>
          )}
        </div>

        {/* Client */}
        <p className="text-sm text-gray-600 dark:text-slate-300 truncate">
          {submission.client_name || (
            <span className="text-gray-400 dark:text-slate-600 italic">Unknown</span>
          )}
        </p>

        {/* Submitted date */}
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {new Date(submission.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {/* Staff count */}
        <p className="text-sm font-mono text-gray-900 dark:text-white text-center">
          {submission.entry_count ?? 0}
        </p>

        {/* Status badge */}
        <span
          className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded w-fit ${statusStyle.bg} ${statusStyle.text}`}
        >
          {submission.status}
        </span>

        {/* VTiger Case */}
        <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
          {submission.vtiger_case_no || (
            <span className="text-gray-300 dark:text-slate-700">—</span>
          )}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-medium">
            View Entries
          </span>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-medium">
            CSV
          </span>
        </div>
      </div>

      {/* Expanded: credential entries */}
      {submission.entries && submission.entries.length > 0 && (
        <div className="px-5 pb-4 bg-gray-50 dark:bg-slate-800/30 border-t border-gray-100 dark:border-slate-800/60">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 py-3">
            Staff Entries ({submission.entries.length})
          </p>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {/* Entry header */}
            <div className="grid grid-cols-[1.2fr_1.5fr_0.8fr_0.9fr_1fr_0.9fr_130px] gap-2 px-4 py-2 border-b border-gray-200 dark:border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Name
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Email
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Role
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Method
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Schedule
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Status
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Actions
              </span>
            </div>

            {/* Entry rows */}
            <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
              {submission.entries.map((entry) => {
                const entryStyle =
                  ENTRY_STATUS_STYLES[entry.credential_status || "pending"] ||
                  ENTRY_STATUS_STYLES.pending
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1.2fr_1.5fr_0.8fr_0.9fr_1fr_0.9fr_130px] gap-2 px-4 py-2.5 items-center hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    <p className="text-xs text-gray-700 dark:text-slate-200 truncate">
                      {entry.full_name || "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {entry.email || "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 capitalize truncate">
                      {entry.role || "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {entry.entry_method || "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {entry.schedule || "—"}
                    </p>
                    <span
                      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded w-fit ${entryStyle.bg} ${entryStyle.text}`}
                    >
                      {entry.credential_status || "pending"}
                    </span>

                    {/* Entry actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-medium transition-colors"
                        title="Approve this credential"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 font-medium transition-colors"
                        title="Mark credential as issued"
                      >
                        Issue
                      </button>
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors"
                        title="Purge PII for this entry"
                      >
                        Purge
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expanded: empty entries notice */}
      {submission.entries && submission.entries.length === 0 && (
        <div className="px-5 pb-3 bg-gray-50 dark:bg-slate-800/30 border-t border-gray-100 dark:border-slate-800/60">
          <p className="text-xs text-gray-400 dark:text-slate-600 italic py-3">
            No staff entries recorded for this submission.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────

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
      <p className={`text-xl font-bold ${accent || "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  )
}
