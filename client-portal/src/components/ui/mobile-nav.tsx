"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import NotificationBell from "@/components/NotificationBell"
import ThemeToggle from "@/components/ThemeToggle"

interface Profile {
  id: string
  display_name: string
  company_name: string | null
  role: string
  email: string
}

const NAV_ITEMS = [
  { href: "/portal", label: "Projects" },
  { href: "/portal/cases", label: "Cases" },
  { href: "/portal/settings", label: "Settings" },
]

const ADMIN_ITEMS = [
  { href: "/admin", label: "Admin Overview" },
  { href: "/admin/clients", label: "Manage Clients" },
  { href: "/admin/invite", label: "Invite Client" },
]

export default function MobileNav({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <>
      {/* Top bar — visible on mobile only */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            ASI 360 Portal
          </p>
        </div>

        <ThemeToggle />
        <NotificationBell />
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed top-14 left-0 bottom-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-3 space-y-1">
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Portal
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          {profile.role === "admin" && (
            <>
              <div className="h-px bg-gray-200 dark:bg-slate-800 my-3" />
              <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
                Admin
              </p>
              {ADMIN_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-amber-600/10 text-amber-400"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {profile.display_name}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">
                {profile.role}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
                <path d="M10 11l3-3-3-3" />
                <line x1="13" y1="8" x2="6" y2="8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
