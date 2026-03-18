"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X, Plus, ClipboardPaste } from "lucide-react"

interface StaffRow {
  first_name: string
  last_name: string
  email: string
  role_title: string
  entry_method: string
  access_schedule: string
}

const ENTRY_METHODS = ["Fob", "PIN", "Fob + PIN", "Mobile"]
const ACCESS_SCHEDULES = ["Standard Hours", "24/7", "Weekdays Only", "Custom"]

function emptyRow(): StaffRow {
  return {
    first_name: "",
    last_name: "",
    email: "",
    role_title: "",
    entry_method: "Fob",
    access_schedule: "Standard Hours",
  }
}

interface CredentialRequestModalProps {
  projectId: number
  projectSlug: string
}

export default function CredentialRequestModal({
  projectId,
  projectSlug,
}: CredentialRequestModalProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isOpen = searchParams.get("action") === "new"

  const [rows, setRows] = useState<StaffRow[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pasteTooltip, setPasteTooltip] = useState(false)

  const dismiss = useCallback(() => {
    router.push(`/portal/projects/${projectSlug}?tab=access-control`)
  }, [router, projectSlug])

  const updateRow = (idx: number, field: keyof StaffRow, value: string) => {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const addRow = () => {
    if (rows.length >= 20) return
    setRows((prev) => [...prev, emptyRow()])
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handlePasteFromExcel = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const lines = text.trim().split("\n").filter(Boolean)
      const parsed: StaffRow[] = lines.map((line) => {
        const cols = line.split("\t")
        return {
          first_name: cols[0]?.trim() || "",
          last_name: cols[1]?.trim() || "",
          email: cols[2]?.trim() || "",
          role_title: cols[3]?.trim() || "",
          entry_method: ENTRY_METHODS.includes(cols[4]?.trim() || "")
            ? cols[4].trim()
            : "Fob",
          access_schedule: ACCESS_SCHEDULES.includes(cols[5]?.trim() || "")
            ? cols[5].trim()
            : "Standard Hours",
        }
      })
      if (parsed.length > 0) {
        setRows((prev) => {
          const combined = [...prev.filter((r) => r.first_name || r.last_name), ...parsed]
          return combined.slice(0, 20)
        })
      }
    } catch {
      setError("Could not read clipboard. Please allow clipboard access and try again.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validRows = rows.filter((r) => r.first_name.trim() && r.last_name.trim())
    if (validRows.length === 0) {
      setError("Please add at least one staff member with a first and last name.")
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, entries: validRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submission failed")

      const caseNo = data.vtiger_case_no || data.case_no
      const msg = caseNo
        ? `Submitted — ${validRows.length} staff member${validRows.length > 1 ? "s" : ""} queued. Case ${caseNo} opened.`
        : `Submitted — ${validRows.length} staff member${validRows.length > 1 ? "s" : ""} queued for processing.`
      setSuccessMsg(msg)
      setTimeout(() => {
        router.push(`/portal/projects/${projectSlug}?tab=access-control`)
      }, 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="mt-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            New Credential Request
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Add up to 20 staff members. First &amp; last name are required.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Success state */}
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
        <form onSubmit={handleSubmit}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= 20}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handlePasteFromExcel}
                onMouseEnter={() => setPasteTooltip(true)}
                onMouseLeave={() => setPasteTooltip(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste from Excel
              </button>
              {pasteTooltip && (
                <div className="absolute left-0 top-full mt-1.5 z-10 w-64 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-[11px] rounded-lg shadow-lg pointer-events-none">
                  Copy rows from Excel with columns: First Name, Last Name,
                  Email, Role, Entry Method, Schedule
                </div>
              )}
            </div>
            <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
              {rows.length}/20 rows
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  {[
                    "First Name *",
                    "Last Name *",
                    "Email",
                    "Role / Title",
                    "Entry Method",
                    "Access Schedule",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 px-3 py-2.5 whitespace-nowrap first:pl-6 last:pr-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-slate-800/50 last:border-0"
                  >
                    <td className="px-3 py-2 pl-6">
                      <input
                        type="text"
                        required
                        value={row.first_name}
                        onChange={(e) => updateRow(idx, "first_name", e.target.value)}
                        placeholder="Jane"
                        className="w-full min-w-[100px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        required
                        value={row.last_name}
                        onChange={(e) => updateRow(idx, "last_name", e.target.value)}
                        placeholder="Smith"
                        className="w-full min-w-[100px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) => updateRow(idx, "email", e.target.value)}
                        placeholder="jane@company.com"
                        className="w-full min-w-[160px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.role_title}
                        onChange={(e) => updateRow(idx, "role_title", e.target.value)}
                        placeholder="Manager"
                        className="w-full min-w-[110px] bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.entry_method}
                        onChange={(e) => updateRow(idx, "entry_method", e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {ENTRY_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.access_schedule}
                        onChange={(e) => updateRow(idx, "access_schedule", e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {ACCESS_SCHEDULES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 pr-4">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1 rounded text-gray-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                          aria-label="Remove row"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between gap-4">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Processed within 2–3 business days. You&apos;ll receive a
                confirmation once credentials are issued.
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
