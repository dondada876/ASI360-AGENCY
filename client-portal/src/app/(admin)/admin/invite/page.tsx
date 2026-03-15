"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Project {
  id: number
  project_no: string
  project_name: string
}

export default function InviteClientPage() {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("client")
  const [selectedProjects, setSelectedProjects] = useState<
    { project_id: number; access_level: string }[]
  >([])
  const [projects, setProjects] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  // Load projects for access assignment
  useEffect(() => {
    async function loadProjects() {
      const res = await fetch("/api/admin/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    }
    loadProjects()
  }, [])

  function addProject(projectId: number) {
    if (selectedProjects.some((p) => p.project_id === projectId)) return
    setSelectedProjects([
      ...selectedProjects,
      { project_id: projectId, access_level: "viewer" },
    ])
  }

  function removeProject(projectId: number) {
    setSelectedProjects(selectedProjects.filter((p) => p.project_id !== projectId))
  }

  function setAccessLevel(projectId: number, level: string) {
    setSelectedProjects(
      selectedProjects.map((p) =>
        p.project_id === projectId ? { ...p, access_level: level } : p
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !displayName.trim()) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          display_name: displayName.trim(),
          company_name: companyName.trim() || null,
          phone: phone.trim() || null,
          role,
          projects: selectedProjects,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite client")
      }

      setSuccess(
        `Client invited successfully. Temporary password: ${data.temp_password}`
      )
      setEmail("")
      setDisplayName("")
      setCompanyName("")
      setPhone("")
      setRole("client")
      setSelectedProjects([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invite Client</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Create a new portal account and assign project access
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="client@company.com"
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="John Smith"
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Company + Phone row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                Company
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Goldman Law Firm"
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(510) 555-0123"
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="client">Client</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Project Access */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              Project Access
            </label>

            {/* Selected projects */}
            {selectedProjects.length > 0 && (
              <div className="space-y-2 mb-3">
                {selectedProjects.map((sp) => {
                  const proj = projects.find((p) => p.id === sp.project_id)
                  return (
                    <div
                      key={sp.project_id}
                      className="flex items-center gap-3 px-3 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg"
                    >
                      <span className="text-xs font-mono text-gray-400 dark:text-slate-500">
                        {proj?.project_no}
                      </span>
                      <span className="flex-1 text-sm text-gray-600 dark:text-slate-300 truncate">
                        {proj?.project_name || `Project #${sp.project_id}`}
                      </span>
                      <select
                        value={sp.access_level}
                        onChange={(e) =>
                          setAccessLevel(sp.project_id, e.target.value)
                        }
                        className="bg-gray-200 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-[10px] text-gray-900 dark:text-white"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="commenter">Commenter</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeProject(sp.project_id)}
                        className="text-gray-400 dark:text-slate-500 hover:text-red-400 text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add project dropdown */}
            <select
              onChange={(e) => {
                const id = Number(e.target.value)
                if (id) addProject(id)
                e.target.value = ""
              }}
              className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="" disabled>
                + Add project access...
              </option>
              {projects
                .filter(
                  (p) => !selectedProjects.some((sp) => sp.project_id === p.id)
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_no} — {p.project_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">{success}</p>
            <p className="text-xs text-green-300/60 mt-1">
              Share these credentials with the client securely. They should change
              their password on first login.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/admin/clients")}
            className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            &larr; Back to Clients
          </button>
          <button
            type="submit"
            disabled={submitting || !email.trim() || !displayName.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? "Creating Account..." : "Create Account & Invite"}
          </button>
        </div>
      </form>
    </div>
  )
}
