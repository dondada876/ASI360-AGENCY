"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ProjectCommentForm({
  projectId,
}: {
  projectId: number
}) {
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/projects/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          content: content.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to post comment")
      }

      setContent("")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Leave a comment or question..."
          rows={3}
          className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={submitting}
        />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-gray-400 dark:text-slate-600">
            Your comment will be visible to the project team.
          </p>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </form>
  )
}
