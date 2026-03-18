"use client"

import Link from "next/link"
import { LayoutDashboard, KeyRound, Camera, Phone } from "lucide-react"

interface ProjectTabsProps {
  slug: string
  modules: { credential_intake?: boolean; camera_tracking?: boolean; intercom_tracking?: boolean }
  activeTab: string
}

const tabs = [
  {
    key: "overview",
    label: "Overview",
    Icon: LayoutDashboard,
    href: (slug: string) => `/portal/projects/${slug}`,
    always: true,
  },
  {
    key: "access-control",
    label: "Access Control",
    Icon: KeyRound,
    href: (slug: string) => `/portal/projects/${slug}?tab=access-control`,
    always: false,
    moduleKey: "credential_intake" as const,
  },
  {
    key: "cameras",
    label: "Camera Systems",
    Icon: Camera,
    href: (slug: string) => `/portal/projects/${slug}?tab=cameras`,
    always: false,
    moduleKey: "camera_tracking" as const,
  },
  {
    key: "intercoms",
    label: "Intercom & Door Entry",
    Icon: Phone,
    href: (slug: string) => `/portal/projects/${slug}?tab=intercoms`,
    always: false,
    moduleKey: "intercom_tracking" as const,
  },
]

export default function ProjectTabs({
  slug,
  modules,
  activeTab,
}: ProjectTabsProps) {
  const visibleTabs = tabs.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t) => t.always || (t.moduleKey && (modules as any)[t.moduleKey] === true)
  )

  return (
    <div className="mb-8">
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit">
        {visibleTabs.map(({ key, label, Icon, href }) => {
          const isActive = activeTab === key
          return (
            <Link
              key={key}
              href={href(slug)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
