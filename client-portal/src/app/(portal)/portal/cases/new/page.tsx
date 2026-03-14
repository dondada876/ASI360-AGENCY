"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

const CATEGORIES = [
  { value: "general", label: "General Inquiry" },
  { value: "change_request", label: "Change Request" },
  { value: "bug_report", label: "Bug / Issue Report" },
  { value: "billing", label: "Billing" },
  { value: "scheduling", label: "Scheduling" },
  { value: "access", label: "Access / Permissions" },
]

const PRIORITIES = [
  { value: "Low", label: "Low" },
  { value: "Normal", label: "Normal" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
]

interface ProjectOption {
  id: number
  project_name: string
  project_no: string
}

export default function NewCasePage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("general")
  const [priority, setPriority] = useState("Normal")
  const [projectId, setProjectId] = useState<number | null>(null)

  // Load available projects
  useEffect(() => {
    async function loadProjects() {
      const supabase = createClient()
      const { data } = await supabase
        .from("asi360_projects")
        .select("id, project_name, project_no")
        .order("project_name")
      if (data) setProjects(data)
    }
    loadProjects()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          project_id: projectId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create case")
      }

      // Redirect to the new case
      router.push(`/portal/cases/${result.case_no}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create case"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/portal/cases"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          &larr; All Cases
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">
        Create Support Case
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
      >
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Case Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Brief summary of the issue"
            required
          />
        </div>

        {/* Project */}
        <div>
          <label
            htmlFor="project"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Related Project
          </label>
          <select
            id="project"
            value={projectId || ""}
            onChange={(e) =>
              setProjectId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No project (general inquiry)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_no} — {p.project_name}
              </option>
            ))}
          </select>
        </div>

        {/* Category + Priority Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Describe the issue in detail. Include any relevant context, error messages, or steps to reproduce."
            required
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Creating..." : "Create Case"}
          </button>
          <Link
            href="/portal/cases"
            className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
