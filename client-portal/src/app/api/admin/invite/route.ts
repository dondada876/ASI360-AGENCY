import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let password = ""
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password + "!"
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify caller is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("client_profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { email, display_name, company_name, phone, role, projects } = body

    if (!email || !display_name) {
      return NextResponse.json(
        { error: "email and display_name are required" },
        { status: 400 }
      )
    }

    const tempPassword = generateTempPassword()

    // Use service client to create auth user (bypasses RLS)
    const adminClient = getServiceClient()
    const { data: newUser, error: authErr } =
      await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })

    if (authErr) {
      return NextResponse.json(
        { error: `Auth error: ${authErr.message}` },
        { status: 500 }
      )
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 500 }
      )
    }

    // Create client profile using service client (bypasses RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileErr } = await (adminClient as any)
      .from("client_profiles")
      .insert({
        user_id: newUser.user.id,
        display_name,
        email,
        company_name: company_name || null,
        phone: phone || null,
        role: role || "client",
        is_active: true,
      })
      .select("id")
      .single()

    if (profileErr) {
      // Rollback: delete auth user
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: `Profile error: ${profileErr.message}` },
        { status: 500 }
      )
    }

    // Assign project access if provided
    if (projects && projects.length > 0 && profile) {
      const accessRecords = projects.map(
        (p: { project_id: number; access_level: string }) => ({
          client_id: profile.id,
          project_id: p.project_id,
          access_level: p.access_level || "viewer",
          invited_by: user.id,
        })
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: accessErr } = await (adminClient as any)
        .from("client_project_access")
        .insert(accessRecords)

      if (accessErr) {
        console.error("Access assignment error:", accessErr.message)
        // Don't fail the entire invite — user is created, access can be fixed
      }
    }

    return NextResponse.json(
      {
        success: true,
        user_id: newUser.user.id,
        profile_id: profile?.id,
        temp_password: tempPassword,
        projects_assigned: projects?.length || 0,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
