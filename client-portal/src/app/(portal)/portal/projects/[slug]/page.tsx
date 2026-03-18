import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import ProjectCommentForm from "@/components/ProjectCommentForm"
import ProjectTabs from "@/components/project/ProjectTabs"
import AccessControlPanel from "@/components/project/AccessControlPanel"
import CameraSystemsPanel from "@/components/project/CameraSystemsPanel"
import IntercomPanel from "@/components/project/IntercomPanel"
import CredentialRequestModal from "@/components/project/CredentialRequestModal"
import CameraRequestModal from "@/components/project/CameraRequestModal"
import IntercomRequestModal from "@/components/project/IntercomRequestModal"

const PHASE_LABELS: Record<number, string> = {
  1: "Scope & Design",
  2: "Procurement",
  3: "Build & Install",
  4: "Testing & QA",
  5: "Close & Handoff",
}

const PHASE_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#8b5cf6",
  3: "#f59e0b",
  4: "#10b981",
  5: "#06b6d4",
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  "not started": { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-600 dark:text-slate-300" },
  "in progress": { bg: "bg-blue-500/20", text: "text-blue-400" },
  completed: { bg: "bg-green-500/20", text: "text-green-400" },
  deferred: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-400" },
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; action?: string; type?: string }>
}) {
  const { slug } = await params
  const { tab, action, type } = await searchParams
  const activeTab = tab || "overview"

  const supabase = await createClient()

  // Fetch project by slug or project_no
  const { data: project } = await supabase
    .from("asi360_projects")
    .select(
      "id, project_no, project_name, slug, client_name, project_status, current_phase, start_date, target_close_date, business_type, health_score, description, scope_description, site_address, contact_name, contact_email, contact_phone, project_modules"
    )
    .or(`slug.eq.${slug},project_no.eq.${slug}`)
    .single()

  if (!project) notFound()

  // Fetch tasks for this project (client-safe fields only)
  const { data: tasks } = await supabase
    .from("asi360_project_tasks")
    .select(
      "id, task_no, task_name, phase_no, phase_name, status, priority, start_date, due_date, end_date, completed_date, is_milestone"
    )
    .eq("project_id", project.id)
    .order("phase_no", { ascending: true })
    .order("id", { ascending: true })

  // Fetch open ticket count for badge
  const { count: ticketCount } = await supabase
    .from("vtiger_tickets_ref")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .neq("status", "Closed")

  // Fetch open case count
  const { count: caseCount } = await supabase
    .from("vtiger_cases_cache")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .neq("status", "Closed")

  // Fetch recent events
  const { data: events } = await supabase
    .from("project_events")
    .select("id, event_type, title, detail, created_at")
    .eq("project_no", project.project_no)
    .order("created_at", { ascending: false })
    .limit(10)

  // Fetch project comments (external only, via RLS)
  const { data: comments } = await supabase
    .from("project_comments")
    .select("id, author_name, author_role, content, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })

  // Check access level (commenter vs viewer)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let accessLevel = "viewer"
  if (user) {
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (profile) {
      const { data: access } = await supabase
        .from("client_project_access")
        .select("access_level")
        .eq("project_id", project.id)
        .eq("client_id", profile.id)
        .single()
      accessLevel = access?.access_level || "viewer"
    }
  }

  // Tab-specific data fetches
  let submissions: Array<{
    id: string
    entry_count: number
    submission_status: string
    vtiger_case_no: string | null
    created_at: string
  }> = []

  let cameras: Array<{
    id: string
    camera_label: string
    camera_model: string | null
    location: string | null
    status: string
    nvr_channel: number | null
    install_date: string | null
  }> = []

  let cameraRequests: Array<{
    id: string
    request_type: string
    description: string
    urgency: string
    request_status: string
    vtiger_case_no: string | null
    github_issue_no: number | null
    github_issue_url: string | null
    created_at: string
  }> = []

  if (activeTab === "access-control") {
    const { data } = await supabase
      .from("credential_submissions")
      .select("id, entry_count, submission_status, vtiger_case_no, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
    submissions = data || []
  }

  if (activeTab === "cameras") {
    const { data: camData } = await supabase
      .from("camera_inventory")
      .select("id, camera_label, camera_model, location, status, nvr_channel, install_date")
      .eq("project_id", project.id)
      .order("camera_label")
    cameras = camData || []

    const { data: reqData } = await supabase
      .from("camera_requests")
      .select("id, request_type, description, urgency, request_status, vtiger_case_no, github_issue_no, github_issue_url, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
    cameraRequests = reqData || []
  }

  let intercomRequests: Array<{
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
  }> = []

  if (activeTab === "intercoms") {
    const { data: intercomData } = await supabase
      .from("intercom_requests")
      .select("id, request_type, door_location, urgency, description, request_status, vtiger_case_no, github_issue_no, github_issue_url, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
    intercomRequests = intercomData || []
  }

  const phase = project.current_phase || 1
  const phaseColor = PHASE_COLORS[phase] || "#3b82f6"
  const status = (project.project_status || "initiated").toLowerCase()
  const modules = (project.project_modules as { credential_intake?: boolean; camera_tracking?: boolean; intercom_tracking?: boolean }) || {}

  // Group tasks by phase
  const tasksByPhase: Record<number, typeof tasks> = {}
  tasks?.forEach((t) => {
    if (!tasksByPhase[t.phase_no]) tasksByPhase[t.phase_no] = []
    tasksByPhase[t.phase_no]!.push(t)
  })

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/portal"
          className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          &larr; All Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono text-gray-400 dark:text-slate-500">
            {project.project_no}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${phaseColor}22`,
              color: phaseColor,
            }}
          >
            Phase {phase} — {PHASE_LABELS[phase] || `Phase ${phase}`}
          </span>
          <span className="text-xs capitalize text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {status}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {project.project_name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {project.client_name || "No client"}
          {project.business_type && (
            <span className="ml-2 text-gray-400 dark:text-slate-600">
              &bull; {project.business_type.replace(/_/g, " ")}
            </span>
          )}
        </p>
      </div>

      {/* Tab Bar */}
      <ProjectTabs slug={slug} modules={modules} activeTab={activeTab} />

      {/* Tab: Access Control */}
      {activeTab === "access-control" && (
        <>
          <AccessControlPanel
            projectId={project.id}
            projectSlug={slug}
            submissions={submissions}
            accessLevel={accessLevel}
          />
          <CredentialRequestModal
            projectId={project.id}
            projectSlug={slug}
          />
        </>
      )}

      {/* Tab: Camera Systems */}
      {activeTab === "cameras" && (
        <>
          <CameraSystemsPanel
            projectId={project.id}
            projectSlug={slug}
            cameras={cameras}
            requests={cameraRequests}
            accessLevel={accessLevel}
          />
          <CameraRequestModal
            projectId={project.id}
            projectSlug={slug}
            cameras={cameras.map((c) => ({
              id: c.id,
              camera_label: c.camera_label,
              location: c.location,
            }))}
          />
        </>
      )}

      {/* Tab: Intercom & Door Entry */}
      {activeTab === "intercoms" && (
        <>
          <IntercomPanel
            projectId={project.id}
            projectSlug={slug}
            requests={intercomRequests}
            accessLevel={accessLevel}
          />
          <IntercomRequestModal
            projectId={project.id}
            projectSlug={slug}
          />
        </>
      )}

      {/* Tab: Overview (default) */}
      {activeTab === "overview" && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label="Start Date" value={formatDate(project.start_date)} />
            <StatCard
              label="Target Close"
              value={formatDate(project.target_close_date)}
            />
            <StatCard
              label="Open Cases"
              value={String(caseCount || 0)}
              accent={caseCount ? "text-amber-400" : undefined}
            />
            <StatCard
              label="Internal Tickets"
              value={`${ticketCount || 0} in progress`}
              accent={ticketCount ? "text-gray-500 dark:text-slate-400" : undefined}
            />
          </div>

          {/* Phase Progress */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
              Phase Progress
            </h2>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((p) => (
                <div key={p} className="flex-1">
                  <div
                    className={`h-2 rounded-full ${p > phase ? "bg-gray-200 dark:bg-slate-700 opacity-50" : ""}`}
                    style={
                      p <= phase
                        ? { backgroundColor: PHASE_COLORS[p] }
                        : undefined
                    }
                  />
                  <p
                    className={`text-[10px] mt-1 text-center ${p > phase ? "text-gray-400 dark:text-slate-500" : ""}`}
                    style={
                      p <= phase ? { color: PHASE_COLORS[p] } : undefined
                    }
                  >
                    {PHASE_LABELS[p]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Task List by Phase */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">Tasks</h2>
            {Object.entries(tasksByPhase).map(([phaseNo, phaseTasks]) => (
              <div key={phaseNo} className="mb-4">
                <h3
                  className="text-xs font-medium uppercase tracking-wider mb-2 px-1"
                  style={{
                    color:
                      PHASE_COLORS[Number(phaseNo)] || "rgb(148 163 184)",
                  }}
                >
                  Phase {phaseNo} —{" "}
                  {phaseTasks?.[0]?.phase_name || PHASE_LABELS[Number(phaseNo)]}
                </h3>
                <div className="space-y-1">
                  {phaseTasks?.map((task) => {
                    const taskStatus = (task.status || "not started").toLowerCase()
                    const badge = STATUS_BADGES[taskStatus] || STATUS_BADGES["not started"]
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
                      >
                        {task.is_milestone ? (
                          <span className="text-amber-400 text-xs">&#9670;</span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-600 text-xs">&#9679;</span>
                        )}
                        <span className="flex-1 text-sm text-gray-600 dark:text-slate-300 truncate">
                          {task.task_name}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                        >
                          {task.status || "Not Started"}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-600">
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {(!tasks || tasks.length === 0) && (
              <p className="text-sm text-gray-400 dark:text-slate-600 py-4">
                No tasks assigned to this project yet.
              </p>
            )}
          </div>

          {/* Recent Activity */}
          {events && events.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
                Recent Activity
              </h2>
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
                  >
                    <span className="text-xs text-gray-400 dark:text-slate-600 mt-0.5 shrink-0">
                      {formatDate(evt.created_at)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-600 dark:text-slate-300">{evt.title}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">
                        {evt.event_type?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
              Comments
              {comments && comments.length > 0 && (
                <span className="text-gray-400 dark:text-slate-600 font-normal ml-2">
                  ({comments.length})
                </span>
              )}
            </h2>
            {comments && comments.length > 0 ? (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-slate-300 shrink-0 mt-0.5">
                      {c.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
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
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-slate-400 whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-600 py-2">
                No comments yet.
              </p>
            )}

            {/* Comment form for commenter+ access */}
            {accessLevel !== "viewer" ? (
              <ProjectCommentForm projectId={project.id} />
            ) : (
              <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-2 italic">
                Viewer access — upgrade to commenter to post comments.
              </p>
            )}
          </div>

          {/* Project Info */}
          {(project.description || project.scope_description || project.site_address) && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">
                Project Details
              </h2>
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                {project.description && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Description</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">{project.description}</p>
                  </div>
                )}
                {project.scope_description && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Scope</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      {project.scope_description}
                    </p>
                  </div>
                )}
                {project.site_address && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Site Address</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      {project.site_address}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-sm font-semibold ${accent || "text-gray-900 dark:text-white"}`}>
        {value || "—"}
      </p>
    </div>
  )
}

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
