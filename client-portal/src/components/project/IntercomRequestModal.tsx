"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, AlertTriangle } from "lucide-react"

const REQUEST_TYPES = [
  { value: "new_install", label: "New Installation" },
  { value: "add_user", label: "Add User / Grant Access" },
  { value: "remove_user", label: "Remove User / Revoke Access" },
  { value: "issue", label: "Report Issue" },
  { value: "quote", label: "Request Quote" },
]

const SYSTEM_TYPES = [
  { value: "audio_intercom", label: "Audio Intercom" },
  { value: "video_intercom", label: "Video Intercom" },
  { value: "keypad", label: "Keypad Entry" },
  { value: "key_fob", label: "Key Fob / Card Reader" },
  { value: "mobile_app", label: "Mobile App Entry" },
  { value: "buzzer", label: "Buzzer / Callbox" },
  { value: "multi_tenant", label: "Multi-Tenant System" },
  { value: "other", label: "Other / Not Sure" },
]

const URGENCY_LEVELS = ["Low", "Normal", "High", "Urgent"]

interface IntercomRequestModalProps {
  projectId: number
  projectSlug: string
}

export default function IntercomRequestModal({
  projectId,
  projectSlug,
}: IntercomRequestModalProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isOpen = searchParams.get("action") === "new"
  const urlType = searchParams.get("type") || "new_install"

  const [requestType, setRequestType] = useState(urlType)
  const [form, setForm] = useState({
    system_type: "",
    door_location: "",
    urgency: "Normal",
    description: "",
    // add_user / remove_user
    user_name: "",
    user_role: "",
    // issue
    issue_detail: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) setRequestType(urlType)
  }, [urlType, isOpen])

  const dismiss = () => {
    router.push(`/portal/projects/${projectSlug}?tab=intercoms`)
  }

  const set = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const buildDescription = (): string => {
    const parts: string[] = []

    if (form.door_location) parts.push(`Door/Location: ${form.door_location}`)
    if (form.system_type) {
      const sysLabel = SYSTEM_TYPES.find((s) => s.value === form.system_type)?.label || form.system_type
      parts.push(`System type: ${sysLabel}`)
    }

    if (requestType === "add_user" || requestType === "remove_user") {
      if (form.user_name) parts.push(`Person: ${form.user_name}`)
      if (form.user_role) parts.push(`Role: ${form.user_role}`)
    }

    if (requestType === "issue" && form.issue_detail) {
      parts.push(`Issue: ${form.issue_detail}`)
    }

    if (form.description) parts.push(form.description)

    return parts.join(". ")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const description = buildDescription()
    if (description.length < 10) {
      setError("Please provide more detail before submitting.")
      setSubmitting(false)
      return
    }

    const payload = {
      project_id: projectId,
      request_type: requestType,
      system_type: form.system_type || undefined,
      door_location: form.door_location || undefined,
      urgency: requestType === "issue" ? form.urgency.toLowerCase() : "normal",
      description,
    }

    try {
      const res = await fetch("/api/intercoms", {
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
        router.push(`/portal/projects/${projectSlug}?tab=intercoms`)
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
          New Intercom / Door Entry Request
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

          {/* Door / Entry Point + System Type — shown for most types */}
          {requestType !== "quote" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Door / Entry Point</label>
                <input
                  type="text"
                  value={form.door_location}
                  onChange={(e) => set("door_location", e.target.value)}
                  placeholder="e.g. Front Door, Loading Dock Gate, Suite 200"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>System Type</label>
                <select
                  value={form.system_type}
                  onChange={(e) => set("system_type", e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select if known —</option>
                  {SYSTEM_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Add / Remove User fields */}
          {(requestType === "add_user" || requestType === "remove_user") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {requestType === "add_user" ? "Person to Add *" : "Person to Remove *"}
                </label>
                <input
                  type="text"
                  required
                  value={form.user_name}
                  onChange={(e) => set("user_name", e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Role / Title</label>
                <input
                  type="text"
                  value={form.user_role}
                  onChange={(e) => set("user_role", e.target.value)}
                  placeholder="e.g. Manager, Vendor, Employee"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Issue type — only for "issue" */}
          {requestType === "issue" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Describe the Issue *</label>
                <input
                  type="text"
                  required
                  value={form.issue_detail}
                  onChange={(e) => set("issue_detail", e.target.value)}
                  placeholder="e.g. Intercom not ringing, door not unlocking"
                  className={inputCls}
                />
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
          )}

          {/* Description / notes (all types) */}
          <div>
            <label className={labelCls}>
              {requestType === "quote"
                ? "Describe what you need *"
                : requestType === "new_install"
                ? "Additional Details / Requirements"
                : "Notes / Additional Context"}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required={requestType === "quote" || requestType === "new_install"}
              rows={4}
              placeholder={
                requestType === "quote"
                  ? "Describe the intercom or door entry system you need pricing for…"
                  : requestType === "new_install"
                  ? "Describe the location, number of doors, expected users, any existing wiring…"
                  : requestType === "add_user" || requestType === "remove_user"
                  ? "Any access schedule restrictions, notes, or context…"
                  : "Any other information that will help us resolve this faster…"
              }
              className={`${inputCls} resize-none`}
            />
          </div>

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
