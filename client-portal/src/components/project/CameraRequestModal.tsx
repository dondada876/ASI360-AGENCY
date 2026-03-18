"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, AlertTriangle } from "lucide-react"

const REQUEST_TYPES = [
  { value: "add", label: "Add Camera" },
  { value: "move", label: "Move Camera" },
  { value: "issue", label: "Report Issue" },
  { value: "quote", label: "Request Quote" },
]

const ISSUE_TYPES = [
  "Offline",
  "Image Quality",
  "Angle",
  "Physical Damage",
  "Recording Problem",
  "Other",
]

const URGENCY_LEVELS = ["Low", "Normal", "High", "Urgent"]

interface CameraOption {
  id: string
  camera_label: string
  location: string | null
}

interface CameraRequestModalProps {
  projectId: number
  projectSlug: string
  cameras?: CameraOption[]
}

export default function CameraRequestModal({
  projectId,
  projectSlug,
  cameras = [],
}: CameraRequestModalProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isOpen = searchParams.get("action") === "new"
  const urlType = searchParams.get("type") || "add"

  const [requestType, setRequestType] = useState(urlType)
  const [form, setForm] = useState({
    // add
    add_location: "",
    add_mount: "",
    // move
    move_from_camera_id: "",
    move_from_text: "",
    move_to: "",
    move_reason: "",
    // issue
    issue_camera_id: "",
    issue_camera_text: "",
    issue_type: "Offline",
    urgency: "Normal",
    // shared
    description: "",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sync request type when URL type param changes
  useEffect(() => {
    if (isOpen) setRequestType(urlType)
  }, [urlType, isOpen])

  const dismiss = () => {
    router.push(`/portal/projects/${projectSlug}?tab=cameras`)
  }

  const set = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      project_id: projectId,
      request_type: requestType,
      urgency: requestType === "issue" ? form.urgency : "Normal",
      description: form.description,
      notes: form.notes,
      // type-specific
      ...(requestType === "add" && {
        location: form.add_location,
        mount_preference: form.add_mount,
      }),
      ...(requestType === "move" && {
        from_camera_id: form.move_from_camera_id || undefined,
        from_location: form.move_from_text,
        to_location: form.move_to,
        reason: form.move_reason,
      }),
      ...(requestType === "issue" && {
        camera_id: form.issue_camera_id || undefined,
        camera_label: form.issue_camera_text,
        issue_type: form.issue_type,
      }),
    }

    try {
      const res = await fetch("/api/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submission failed")

      const caseNo = data.vtiger_case_no || data.case_no
      const msg = caseNo
        ? `Request submitted. Case ${caseNo} opened.`
        : "Request submitted and queued for review."
      setSuccessMsg(msg)
      setTimeout(() => {
        router.push(`/portal/projects/${projectSlug}?tab=cameras`)
      }, 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const inputCls =
    "w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  const labelCls = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1"

  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          New Camera Request
        </h3>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {successMsg ? (
        <div className="px-6 py-8 text-center">
          <p className="text-green-600 dark:text-green-400 font-medium text-sm">
            ✓ {successMsg}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Redirecting…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Request Type */}
          <div>
            <label className={labelCls}>Request Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className={inputCls}
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type: Add Camera */}
          {requestType === "add" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Location *</label>
                <input
                  type="text"
                  required
                  value={form.add_location}
                  onChange={(e) => set("add_location", e.target.value)}
                  placeholder="e.g. Back entrance, Loading dock"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Preferred Position / Mount</label>
                <input
                  type="text"
                  value={form.add_mount}
                  onChange={(e) => set("add_mount", e.target.value)}
                  placeholder="e.g. Corner mount, ceiling, 10 ft height"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Type: Move Camera */}
          {requestType === "move" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Current Location / Camera</label>
                {cameras.length > 0 ? (
                  <select
                    value={form.move_from_camera_id}
                    onChange={(e) => set("move_from_camera_id", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select camera —</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.camera_label}
                        {c.location ? ` — ${c.location}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.move_from_text}
                    onChange={(e) => set("move_from_text", e.target.value)}
                    placeholder="Describe current location"
                    className={inputCls}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>New Location *</label>
                  <input
                    type="text"
                    required
                    value={form.move_to}
                    onChange={(e) => set("move_to", e.target.value)}
                    placeholder="Where should it be moved to?"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Reason</label>
                  <input
                    type="text"
                    value={form.move_reason}
                    onChange={(e) => set("move_reason", e.target.value)}
                    placeholder="Why is it being moved?"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Type: Report Issue */}
          {requestType === "issue" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Camera</label>
                {cameras.length > 0 ? (
                  <select
                    value={form.issue_camera_id}
                    onChange={(e) => set("issue_camera_id", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select camera —</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.camera_label}
                        {c.location ? ` — ${c.location}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.issue_camera_text}
                    onChange={(e) => set("issue_camera_text", e.target.value)}
                    placeholder="Camera name or location"
                    className={inputCls}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Issue Type</label>
                  <select
                    value={form.issue_type}
                    onChange={(e) => set("issue_type", e.target.value)}
                    className={inputCls}
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Urgency</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => set("urgency", e.target.value)}
                    className={inputCls}
                  >
                    {URGENCY_LEVELS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  {form.urgency === "Urgent" && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Emergency dispatch may apply
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description (all types) */}
          <div>
            <label className={labelCls}>
              {requestType === "quote"
                ? "Describe what you need *"
                : "Description / Notes"}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required={requestType === "quote"}
              rows={4}
              placeholder={
                requestType === "quote"
                  ? "Describe the camera additions or system changes you want pricing for…"
                  : requestType === "issue"
                  ? "Describe the issue in detail…"
                  : "Additional notes or context…"
              }
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Additional notes (non-quote types) */}
          {requestType !== "quote" && (
            <div>
              <label className={labelCls}>Additional Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                placeholder="Any other information…"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-slate-800">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                A case will be opened in your project portal once submitted.
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={dismiss}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
