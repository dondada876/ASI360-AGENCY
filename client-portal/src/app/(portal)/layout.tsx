import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import PortalSidebar from "@/components/ui/portal-sidebar"

export default async function PortalLayout({
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

  // Fetch client profile for sidebar display
  const { data: profile } = await supabase
    .from("client_profiles")
    .select("id, display_name, company_name, role, email")
    .eq("user_id", user.id)
    .single()

  if (!profile) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      <PortalSidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
