import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PortalSidebar from "@/components/ui/portal-sidebar"
import MobileNav from "@/components/ui/mobile-nav"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch client profile — must be admin role
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("id, display_name, company_name, role, email")
    .eq("user_id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    redirect("/portal")
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      <div className="hidden lg:block">
        <PortalSidebar profile={profile} />
      </div>
      <MobileNav profile={profile} />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
