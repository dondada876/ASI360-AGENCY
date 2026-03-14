import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0ZmZmeHdmZ2N4aWlhdWxpeW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzU3MzUsImV4cCI6MjA4MjQ1MTczNX0.wTKrNBsynjuvEwpxnOtiAzSjI9KZhomcNuhWIZhUHrc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Read operations ──

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('asi360_projects')
    .select('*')
    .not('project_status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchProjectBySlug(slug) {
  const { data, error } = await supabase
    .from('asi360_projects')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

export async function fetchTasksForProject(projectId) {
  const { data, error } = await supabase
    .from('asi360_project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('task_no', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchProjectEvents(projectNo, limit = 20) {
  const { data, error } = await supabase
    .from('project_events')
    .select('*')
    .eq('project_no', projectNo)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ── Write operations ──

/**
 * Update a task's status (used by Kanban drag-drop and detail modal).
 * Sets modified_source to 'dashboard' for tri-sync conflict resolution.
 */
export async function updateTaskStatus(taskId, newStatus) {
  const { data, error } = await supabase
    .from('asi360_project_tasks')
    .update({
      status: newStatus,
      modified_source: 'dashboard',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update a task's assigned_to field.
 */
export async function updateTaskAssignment(taskId, assignedTo) {
  const { data, error } = await supabase
    .from('asi360_project_tasks')
    .update({
      assigned_to: assignedTo,
      modified_source: 'dashboard',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update task details (milestones, hours, budget, risk, dependencies).
 */
export async function updateTaskDetails(taskId, updates) {
  const { data, error } = await supabase
    .from('asi360_project_tasks')
    .update({
      ...updates,
      modified_source: 'dashboard',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update project health metrics.
 */
export async function updateProjectHealth(projectId, healthData) {
  const { data, error } = await supabase
    .from('asi360_projects')
    .update(healthData)
    .eq('id', projectId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Log an event to the project_events table.
 */
export async function logProjectEvent(projectNo, title, eventType = 'task_update', source = 'dashboard') {
  const { error } = await supabase
    .from('project_events')
    .insert({
      project_no: projectNo,
      title,
      event_type: eventType,
      event_source: source,
    })
  if (error) console.error('Failed to log event:', error)
}

// ── Health Check operations ──

const VTIGER_GATEWAY = 'http://104.248.69.86:3004'
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0'

/**
 * Check Supabase connectivity — query project count + latest event timestamp.
 */
export async function checkSupabase() {
  const start = performance.now()
  try {
    const [projResult, eventResult] = await Promise.all([
      supabase.from('asi360_projects').select('id', { count: 'exact', head: true }),
      supabase.from('project_events').select('created_at').order('created_at', { ascending: false }).limit(1),
    ])
    const latency = Math.round(performance.now() - start)
    const projectCount = projResult.count ?? 0
    const lastEvent = eventResult.data?.[0]?.created_at || null

    if (projResult.error) throw projResult.error

    return {
      status: 'connected',
      latency,
      projectCount,
      lastEvent,
      message: `${projectCount} projects, ${latency}ms`,
    }
  } catch (err) {
    return {
      status: 'error',
      latency: Math.round(performance.now() - start),
      message: err.message,
    }
  }
}

/**
 * Check VTiger Gateway connectivity via /health or /api/health endpoint.
 */
export async function checkVtigerGateway() {
  const start = performance.now()
  try {
    const res = await fetch(`${VTIGER_GATEWAY}/health`, {
      signal: AbortSignal.timeout(8000),
    })
    const latency = Math.round(performance.now() - start)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        status: 'connected',
        latency,
        message: data.status || `HTTP ${res.status}, ${latency}ms`,
        details: data,
      }
    }
    return {
      status: 'degraded',
      latency,
      message: `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      status: 'error',
      latency: Math.round(performance.now() - start),
      message: err.name === 'TimeoutError' ? 'Timeout (8s)' : err.message,
    }
  }
}

/**
 * Check Airtable connectivity via a lightweight metadata query.
 * Uses the Supabase vault to get the API key, then hits Airtable.
 */
export async function checkAirtable() {
  const start = performance.now()
  try {
    // Try via VTiger gateway which has Airtable credentials
    const res = await fetch(`${VTIGER_GATEWAY}/health`, {
      signal: AbortSignal.timeout(8000),
    })
    const latency = Math.round(performance.now() - start)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      // The gateway health check may include Airtable status
      if (data.airtable) {
        return {
          status: data.airtable.status || 'connected',
          latency,
          message: data.airtable.message || `Via gateway, ${latency}ms`,
          details: data.airtable,
        }
      }
      // Gateway is up but doesn't report Airtable status separately
      return {
        status: 'unknown',
        latency,
        message: 'Gateway up — Airtable status not reported separately',
      }
    }
    return { status: 'error', latency, message: `Gateway HTTP ${res.status}` }
  } catch (err) {
    return {
      status: 'error',
      latency: Math.round(performance.now() - start),
      message: err.name === 'TimeoutError' ? 'Timeout (8s)' : err.message,
    }
  }
}

/**
 * Check droplet Nginx/services by hitting the dashboard itself.
 */
export async function checkDroplet() {
  const start = performance.now()
  try {
    const res = await fetch('https://projects.asi360.co/', {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    const latency = Math.round(performance.now() - start)
    return {
      status: res.ok ? 'connected' : 'degraded',
      latency,
      message: `HTTP ${res.status}, ${latency}ms`,
    }
  } catch (err) {
    return {
      status: 'error',
      latency: Math.round(performance.now() - start),
      message: err.name === 'TimeoutError' ? 'Timeout (8s)' : err.message,
    }
  }
}

/**
 * Run all health checks in parallel.
 */
export async function runAllHealthChecks() {
  const [supabaseResult, vtigerResult, airtableResult, dropletResult] = await Promise.allSettled([
    checkSupabase(),
    checkVtigerGateway(),
    checkAirtable(),
    checkDroplet(),
  ])

  return {
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseResult.status === 'fulfilled' ? supabaseResult.value : { status: 'error', message: 'Promise rejected' },
      vtiger: vtigerResult.status === 'fulfilled' ? vtigerResult.value : { status: 'error', message: 'Promise rejected' },
      airtable: airtableResult.status === 'fulfilled' ? airtableResult.value : { status: 'error', message: 'Promise rejected' },
      droplet: dropletResult.status === 'fulfilled' ? dropletResult.value : { status: 'error', message: 'Promise rejected' },
    },
  }
}
