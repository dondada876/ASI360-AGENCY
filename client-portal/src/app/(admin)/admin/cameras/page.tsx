import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"

// ── Badge style maps ───────────────────────────────────────────────────────

const REQUEST_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  submitted: { bg: "bg-blue-500/20", text: "text-blue-400" },
  pending_vtiger_sync: { bg: "bg-amber-500/20", text: "text-amber-400" },
  in_review: { bg: "bg-purple-500/20", text: "text-purple-400" },
  scheduled: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  resolved: { bg: "bg-green-500/20", text: "text-green-400" },
  closed: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
}

const URGENCY_STYLES: Record<string, { bg: string; text: string }> = {
  urgent: { bg: "bg-red-500/20", text: "text-red-400" },
  high: { bg: "bg-amber-500/20", text: "text-amber-400" },
  normal: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
  low: { bg: "bg-blue-500/20", text: "text-blue-400" },
}

const CAMERA_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-500/20", text: "text-green-400" },
  offline: { bg: "bg-red-500/20", text: "text-red-400" },
  maintenance: { bg: "bg-amber-500/20", text: "text-amber-400" },
  decommissioned: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-500 dark:text-slate-400" },
  pending_install: { bg: "bg-blue-500/20", text: "text-blue-400" },
}

// ── Types ──────────────────────────────────────────────────────────────────

type CameraRequest = {
  id: string
  project_id: number
  request_type: string
  urgency: string
  description: string
  request_status: string
  vtiger_case_no: string | null
  created_at: string
  // populated:
  project_name?: string
}

type CameraInventoryItem = {
  id: string
  project_id: number
  camera_label: string
  camera_model: string | null
  location: string | null
  nvr_channel: number | null
  status: string | null
  install_date: string | null
  notes: string | null
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function AdminCamerasPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = getServiceClient() as any

  // ── Fetch camera requests (all, newest first) ──
  const { data: rawRequests } = await adminClient
    .from("camera_requests")
    .select(
      "id, project_id, request_type, urgency, description, request_status, vtiger_case_no, created_at"
    )
    .order("created_at", { ascending: false })

  const requests: CameraRequest[] = rawRequests || []

  // ── Fetch camera inventory (all) ──
  const { data: rawInventory } = await adminClient
    .from("camera_inventory")
    .select(
      "id, project_id, camera_label, camera_model, location, nvr_channel, status, install_date, notes"
    )
    .order("camera_label", { ascending: true })

  const inventory: CameraInventoryItem[] = rawInventory || []

  // ── Resolve project names for both sets ──
  const allProjectIds = [
    ...new Set([
      ...requests.map((r) => r.project_id),
      ...inventory.map((i) => i.project_id),
    ].filter(Boolean)),
  ] as number[]

  const projectMap: Record<number, string> = {}
  if (allProjectIds.length > 0) {
    const { data: projects } = await supabase
      .from("asi360_projects")
      .select("id, project_name, project_no")
      .in("id", allProjectIds)
    projects?.forEach((p) => {
      projectMap[p.id] = p.project_name || p.project_no
    })
  }

  // Enrich requests with project names
  const enrichedRequests: CameraRequest[] = requests.map((r) => ({
    ...r,
    project_name: projectMap[r.project_id] ?? `Project ${r.project_id}`,
  }))

  // Group inventory by project
  const inventoryByProject: Record<number, CameraInventoryItem[]> = {}
  inventory.forEach((cam) => {
    if (!inventoryByProject[cam.project_id]) inventoryByProject[cam.project_id] = []
    inventoryByProject[cam.project_id].push(cam)
  })

  // ── Metrics ──
  const openRequests = enrichedRequests.filter(
    (r) => r.request_status !== "resolved" && r.request_status !== "closed"
  ).length
  const urgentRequests = enrichedRequests.filter((r) => r.urgency === "urgent").length
  const activecameras = inventory.filter((c) => c.status === "active").length
  const offlineCameras = inventory.filter((c) => c.status === "offline").length

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cameras</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Camera requests &amp; inventory management
        </p>
      </div>

      {/* Metric Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard
          label="Open Requests"
          value={openRequests}
          accent={openRequests > 0 ? "text-amber-400" : undefined}
        />
        <StatCard
          label="Urgent"
          value={urgentRequests}
          accent={urgentRequests > 0 ? "text-red-400" : undefined}
        />
        <StatCard label="Active Cameras" value={activecameras} accent="text-green-400" />
        <StatCard
          label="Offline"
          value={offlineCameras}
          accent={offlineCameras > 0 ? "text-red-400" : undefined}
        />
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 1: Camera Requests
          ═══════════════════════════════════════════════════ */}
      <div className="mb-12">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-4">
          Camera Requests ({enrichedRequests.length})
        </h2>

        {enrichedRequests.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1.5fr_1fr_80px_100px_130px_120px_160px] gap-3 px-5 py-3 border-b border-gray-200 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Project
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Type
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Urgency
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Status
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                VTiger Case
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Submitted
              </span>
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Actions
              </span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
              {enrichedRequests.map((req) => {
                const statusStyle =
                  REQUEST_STATUS_STYLES[req.request_status] ||
                  REQUEST_STATUS_STYLES.submitted
                const urgencyStyle =
                  URGENCY_STYLES[req.urgency] || URGENCY_STYLES.normal
                return (
                  <div
                    key={req.id}
                    className="grid grid-cols-[1.5fr_1fr_80px_100px_130px_120px_160px] gap-3 px-5 py-4 items-start hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Project */}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 dark:text-slate-200 truncate">
                        {req.project_name}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-0.5 line-clamp-2">
                        {req.description}
                      </p>
                    </div>

                    {/* Type */}
                    <p className="text-sm text-gray-600 dark:text-slate-300 capitalize">
                      {req.request_type?.replace(/_/g, " ")}
                    </p>

                    {/* Urgency */}
                    <span
                      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded w-fit capitalize ${urgencyStyle.bg} ${urgencyStyle.text}`}
                    >
                      {req.urgency}
                    </span>

                    {/* Status */}
                    <span
                      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded w-fit ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {req.request_status.replace(/_/g, " ")}
                    </span>

                    {/* VTiger Case */}
                    <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
                      {req.vtiger_case_no || (
                        <span className="text-gray-300 dark:text-slate-700">—</span>
                      )}
                    </p>

                    {/* Date */}
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {new Date(req.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 font-medium transition-colors whitespace-nowrap"
                        title="Mark this request as resolved"
                      >
                        Mark Resolved
                      </button>
                      {!req.vtiger_case_no && (
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-medium transition-colors whitespace-nowrap"
                          title="Assign a VTiger case number"
                        >
                          Assign Case
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p>No camera requests yet.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 2: Camera Inventory (per project)
          ═══════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-4">
          Camera Inventory ({inventory.length} cameras across {Object.keys(inventoryByProject).length} projects)
        </h2>

        {allProjectIds.length > 0 ? (
          <div className="space-y-6">
            {allProjectIds
              .filter((pid) => inventoryByProject[pid]?.length > 0)
              .map((projectId) => {
                const cameras = inventoryByProject[projectId] || []
                const projectName = projectMap[projectId] ?? `Project ${projectId}`
                return (
                  <ProjectInventoryGroup
                    key={projectId}
                    projectId={projectId}
                    projectName={projectName}
                    cameras={cameras}
                  />
                )
              })}

            {/* If no inventory at all */}
            {Object.keys(inventoryByProject).length === 0 && (
              <div className="text-center py-16 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
                <p>No cameras in inventory yet.</p>
                <p className="text-sm mt-2 text-gray-400 dark:text-slate-600">
                  Add cameras to a project using the &ldquo;+ Add Camera&rdquo; button.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p>No projects found. Create a project first.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Project Inventory Group ────────────────────────────────────────────────

function ProjectInventoryGroup({
  projectId,
  projectName,
  cameras,
}: {
  projectId: number
  projectName: string
  cameras: CameraInventoryItem[]
}) {
  const activeCount = cameras.filter((c) => c.status === "active").length
  const offlineCount = cameras.filter((c) => c.status === "offline").length

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {projectName}
          </h3>
          <span className="text-[10px] font-mono text-gray-400 dark:text-slate-600">
            #{projectId}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {cameras.length} camera{cameras.length !== 1 ? "s" : ""}
            {activeCount > 0 && (
              <span className="text-green-400 ml-1">&bull; {activeCount} active</span>
            )}
            {offlineCount > 0 && (
              <span className="text-red-400 ml-1">&bull; {offlineCount} offline</span>
            )}
          </span>
        </div>

        {/* Add Camera button — placeholder (requires client interaction) */}
        <button
          type="button"
          className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 font-medium transition-colors"
          title={`Add a camera to ${projectName}`}
        >
          + Add Camera
        </button>
      </div>

      {cameras.length > 0 ? (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_1fr_80px_90px_100px_1fr] gap-3 px-5 py-2 border-b border-gray-100 dark:border-slate-800/60">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Label
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Model
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Location
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 text-center">
              Channel
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Status
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Install Date
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Notes
            </span>
          </div>

          {/* Camera rows */}
          <div className="divide-y divide-gray-100 dark:divide-slate-800/40">
            {cameras.map((cam) => {
              const statusStyle =
                CAMERA_STATUS_STYLES[cam.status || "pending_install"] ||
                CAMERA_STATUS_STYLES.pending_install
              return (
                <div
                  key={cam.id}
                  className="grid grid-cols-[1fr_1fr_1fr_80px_90px_100px_1fr] gap-3 px-5 py-3 items-center hover:bg-gray-50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">
                    {cam.camera_label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                    {cam.camera_model || (
                      <span className="text-gray-300 dark:text-slate-700">—</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                    {cam.location || (
                      <span className="text-gray-300 dark:text-slate-700">—</span>
                    )}
                  </p>
                  <p className="text-xs font-mono text-gray-500 dark:text-slate-400 text-center">
                    {cam.nvr_channel ?? (
                      <span className="text-gray-300 dark:text-slate-700">—</span>
                    )}
                  </p>
                  <span
                    className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded w-fit capitalize ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {(cam.status || "pending_install").replace(/_/g, " ")}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {cam.install_date
                      ? new Date(cam.install_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : <span className="text-gray-300 dark:text-slate-700">—</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {cam.notes || (
                      <span className="text-gray-300 dark:text-slate-700">—</span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="px-5 py-6 text-sm text-gray-400 dark:text-slate-600 italic">
          No cameras added to this project yet.
        </p>
      )}

      {/* Add Camera inline form placeholder */}
      <AddCameraForm projectId={projectId} />
    </div>
  )
}

// ── Add Camera Form (server-rendered form, uses native form action) ─────────
// Note: Wiring to interactive state requires a Client Component wrapper.
// This renders the form shell; JavaScript progressively enhances it.

function AddCameraForm({ projectId }: { projectId: number }) {
  return (
    <details className="group border-t border-gray-100 dark:border-slate-800/60">
      <summary className="flex items-center gap-2 px-5 py-3 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer list-none select-none transition-colors">
        <span className="font-medium">+ Add Camera to this project</span>
      </summary>
      <div className="px-5 pb-5 bg-gray-50 dark:bg-slate-800/30">
        <form
          action="/api/cameras/inventory"
          method="POST"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3"
        >
          <input type="hidden" name="project_id" value={projectId} />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Camera Label <span className="text-red-400">*</span>
            </label>
            <input
              name="camera_label"
              required
              placeholder="e.g. CAM-01-ENTRY"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Model
            </label>
            <input
              name="camera_model"
              placeholder="e.g. LUM-R54-32NA"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Location
            </label>
            <input
              name="location"
              placeholder="e.g. Main Entrance"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              NVR Channel
            </label>
            <input
              name="nvr_channel"
              type="number"
              min="1"
              placeholder="e.g. 4"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Install Date
            </label>
            <input
              name="install_date"
              type="date"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Status
            </label>
            <select
              name="status"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="pending_install">Pending Install</option>
              <option value="active">Active</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
              Notes
            </label>
            <input
              name="notes"
              placeholder="Optional notes"
              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add Camera
            </button>
          </div>
        </form>
      </div>
    </details>
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
