"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Profile {
  id: string
  display_name: string
  company_name: string | null
  role: string
  email: string
}

const NAV_ITEMS = [
  { href: "/portal", label: "Projects", icon: ProjectsIcon },
  { href: "/portal/cases", label: "Cases", icon: CasesIcon },
  { href: "/portal/settings", label: "Settings", icon: SettingsIcon },
]

const ADMIN_ITEMS = [
  { href: "/admin", label: "Admin Overview", icon: AdminIcon },
  { href: "/admin/clients", label: "Manage Clients", icon: UsersIcon },
  { href: "/admin/invite", label: "Invite Client", icon: InviteIcon },
]

export default function PortalSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">ASI 360 Portal</p>
            <p className="text-xs text-slate-400 truncate">
              {profile.company_name || profile.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 mb-2">
          Portal
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {profile.role === "admin" && (
          <>
            <div className="h-px bg-slate-800 my-3" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 mb-2">
              Admin
            </p>
            {ADMIN_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-amber-600/10 text-amber-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{profile.display_name}</p>
            <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <LogoutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ── Icons ────────────────────────────────────────────────────

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function CasesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
      <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4" />
    </svg>
  )
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1l6 3v4c0 3.3-2.7 5.3-6 7-3.3-1.7-6-3.7-6-7V4l6-3z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="12" cy="5" r="1.5" />
      <path d="M15 14c0-1.7-1.3-3-3-3" />
    </svg>
  )
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="6" r="3" />
      <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <line x1="13" y1="2" x2="13" y2="6" />
      <line x1="11" y1="4" x2="15" y2="4" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
      <path d="M10 11l3-3-3-3" />
      <line x1="13" y1="8" x2="6" y2="8" />
    </svg>
  )
}
