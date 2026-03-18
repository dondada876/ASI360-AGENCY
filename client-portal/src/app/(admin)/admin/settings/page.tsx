"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import TimezoneSelect from "@/components/TimezoneSelect"

interface ProfileData {
  id: string
  display_name: string
  email: string
  phone: string | null
  timezone: string
  notification_preferences: {
    email: boolean
    sms: boolean
    telegram: boolean
    in_app: boolean
  }
}

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")
  const [timezone, setTimezone] = useState("America/Los_Angeles")
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    sms: false,
    telegram: false,
    in_app: true,
  })

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("client_profiles")
        .select("id, display_name, email, phone, timezone, notification_preferences")
        .eq("user_id", user.id)
        .single()

      if (data) {
        setProfile(data)
        setDisplayName(data.display_name)
        setPhone(data.phone || "")
        setTimezone(data.timezone || "America/Los_Angeles")
        setNotifPrefs(
          data.notification_preferences || {
            email: true,
            sms: false,
            telegram: false,
            in_app: true,
          }
        )
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("client_profiles")
        .update({
          display_name: displayName,
          phone: phone || null,
          timezone,
          notification_preferences: notifPrefs,
        })
        .eq("id", profile.id)

      if (error) throw error

      setMessage({ type: "success", text: "Settings saved successfully." })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save"
      setMessage({ type: "error", text: msg })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-48" />
          <div className="h-64 bg-gray-100 dark:bg-slate-900 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Admin Settings</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        Manage your profile, timezone, and notification preferences.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100/50 dark:bg-slate-800/50 border border-gray-300/50 dark:border-slate-700/50 rounded-lg text-gray-400 dark:text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Timezone Section */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">Timezone</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
            Timestamps in the portal will display in this timezone.
          </p>
          <TimezoneSelect id="timezone" value={timezone} onChange={setTimezone} />
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-4">
            Notification Preferences
          </h2>
          <div className="space-y-3">
            {[
              {
                key: "email" as const,
                label: "Email Notifications",
                desc: "Receive updates via email",
              },
              {
                key: "in_app" as const,
                label: "In-App Notifications",
                desc: "Show notifications in the portal",
              },
              {
                key: "sms" as const,
                label: "SMS Notifications",
                desc: "Receive text messages for urgent updates",
              },
              {
                key: "telegram" as const,
                label: "Telegram Notifications",
                desc: "Get notifications via Telegram bot",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between py-2 cursor-pointer"
              >
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-300">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-600">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifPrefs((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key],
                    }))
                  }
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    notifPrefs[item.key] ? "bg-blue-600" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      notifPrefs[item.key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  )
}
