/**
 * Notification helper — creates records in client_notifications.
 * Uses service client (bypasses RLS) — called from server-side API routes only.
 * NEVER import this in client components.
 */

import { getServiceClient } from "@/lib/vault"
import type { NotificationType } from "@/types"

interface CreateNotificationParams {
  client_id: string
  project_id?: number | null
  case_no?: string | null
  type: NotificationType
  title: string
  message: string
  action_url?: string | null
  priority?: "low" | "normal" | "high"
}

/**
 * Insert a notification for a specific client.
 * The NotificationBell component picks this up via Supabase Realtime.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    await adminClient.from("client_notifications").insert({
      client_id: params.client_id,
      project_id: params.project_id || null,
      case_no: params.case_no || null,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.action_url || null,
      priority: params.priority || "normal",
      read: false,
      delivery_channels: ["in_app"],
      delivery_status: {},
    })
  } catch (err) {
    // Notification failures should not break the main flow
    console.error("[notifications] Failed to create notification:", err)
  }
}

/**
 * Notify all admins about an event (e.g., new case from client).
 */
export async function notifyAdmins(
  params: Omit<CreateNotificationParams, "client_id">
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    const { data: admins } = await adminClient
      .from("client_profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)

    if (!admins || admins.length === 0) return

    const rows = admins.map((admin: { id: string }) => ({
      client_id: admin.id,
      project_id: params.project_id || null,
      case_no: params.case_no || null,
      type: params.type,
      title: params.title,
      message: params.message,
      action_url: params.action_url || null,
      priority: params.priority || "normal",
      read: false,
      delivery_channels: ["in_app"],
      delivery_status: {},
    }))

    await adminClient.from("client_notifications").insert(rows)
  } catch (err) {
    console.error("[notifications] Failed to notify admins:", err)
  }
}

/**
 * Notify all clients with access to a project about a project event.
 */
export async function notifyProjectMembers(
  projectId: number,
  excludeClientId: string | null,
  params: Omit<CreateNotificationParams, "client_id" | "project_id">
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    const { data: members } = await adminClient
      .from("client_project_access")
      .select("client_id")
      .eq("project_id", projectId)

    if (!members || members.length === 0) return

    const rows = members
      .filter((m: { client_id: string }) => m.client_id !== excludeClientId)
      .map((m: { client_id: string }) => ({
        client_id: m.client_id,
        project_id: projectId,
        case_no: params.case_no || null,
        type: params.type,
        title: params.title,
        message: params.message,
        action_url: params.action_url || null,
        priority: params.priority || "normal",
        read: false,
        delivery_channels: ["in_app"],
        delivery_status: {},
      }))

    if (rows.length > 0) {
      await adminClient.from("client_notifications").insert(rows)
    }
  } catch (err) {
    console.error("[notifications] Failed to notify project members:", err)
  }
}
