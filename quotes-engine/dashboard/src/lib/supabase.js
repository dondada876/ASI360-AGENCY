import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0ZmZmeHdmZ2N4aWlhdWxpeW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NzU3MzUsImV4cCI6MjA4MjQ1MTczNX0.wTKrNBsynjuvEwpxnOtiAzSjI9KZhomcNuhWIZhUHrc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
