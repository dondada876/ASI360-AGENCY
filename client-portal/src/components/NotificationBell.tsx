"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  action_url: string | null
  read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    async function fetchNotifications() {
      const { data } = await supabase
        .from("client_notifications")
        .select("id, type, title, message, action_url, read, created_at")
        .order("created_at", { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter((n) => !n.read).length)
      }
      setLoading(false)
    }

    fetchNotifications()

    // Subscribe to realtime changes
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_notifications",
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev].slice(0, 20))
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from("client_notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds)

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const TYPE_ICONS: Record<string, string> = {
    project_update: "\u25B6",
    task_completed: "\u2713",
    phase_advanced: "\u2191",
    comment_reply: "\u2709",
    case_update: "\u2699",
    document_ready: "\u2193",
    system_alert: "\u26A0",
    welcome: "\u2605",
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        title="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 20 20"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" />
          <path d="M8 16a2 2 0 004 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 p-4 text-center">
                Loading...
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 p-4 text-center">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-100 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !n.read ? "bg-blue-500/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs mt-0.5 shrink-0">
                      {TYPE_ICONS[n.type] || "\u2022"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-gray-300 dark:text-slate-700 mt-1">
                        {formatTimeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
