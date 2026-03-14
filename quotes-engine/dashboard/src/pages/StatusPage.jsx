import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import HelpButton from '../components/HelpButton'
import { runAllHealthChecks, supabase } from '../lib/supabase'

const AUTO_REFRESH_MS = 30_000

/**
 * StatusPage — System Health Dashboard (Phase H)
 * Live connectivity checks for Supabase, VTiger Gateway, Airtable, and Droplet.
 */
export default function StatusPage() {
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [lastCheck, setLastCheck] = useState(null)
  const [dbStats, setDbStats] = useState(null)

  const runChecks = useCallback(async () => {
    setLoading(true)
    try {
      const result = await runAllHealthChecks()
      setHealthData(result)
      setLastCheck(new Date())
      setHistory(prev => [result, ...prev].slice(0, 20))
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch DB stats (table counts)
  const loadDbStats = useCallback(async () => {
    try {
      const [projects, tasks, events] = await Promise.all([
        supabase.from('asi360_projects').select('id', { count: 'exact', head: true }),
        supabase.from('asi360_project_tasks').select('id', { count: 'exact', head: true }),
        supabase.from('project_events').select('id', { count: 'exact', head: true }),
      ])
      setDbStats({
        projects: projects.count ?? '?',
        tasks: tasks.count ?? '?',
        events: events.count ?? '?',
      })
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    runChecks()
    loadDbStats()
  }, [runChecks, loadDbStats])

  useEffect(() => {
    const interval = setInterval(runChecks, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [runChecks])

  const checks = healthData?.checks || {}
  const services = [
    {
      key: 'supabase',
      name: 'Supabase',
      description: 'Database & Auth (asi360-commerce)',
      icon: '🗄️',
      data: checks.supabase,
    },
    {
      key: 'vtiger',
      name: 'VTiger Gateway',
      description: 'CRM API Gateway (104.248.69.86:3004)',
      icon: '🔌',
      data: checks.vtiger,
    },
    {
      key: 'airtable',
      name: 'Airtable',
      description: 'CEO Dashboard / Ops Hub sync',
      icon: '📊',
      data: checks.airtable,
    },
    {
      key: 'droplet',
      name: 'Droplet / Nginx',
      description: 'Production server (projects.asi360.co)',
      icon: '🖥️',
      data: checks.droplet,
    },
  ]

  const overallStatus = !healthData
    ? 'checking'
    : Object.values(checks).every(c => c.status === 'connected')
      ? 'operational'
      : Object.values(checks).some(c => c.status === 'error')
        ? 'degraded'
        : 'partial'

  const statusColors = {
    operational: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', text: '#22c55e', label: 'All Systems Operational' },
    degraded: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444', label: 'Service Disruption Detected' },
    partial: { bg: 'rgba(234,179,8,0.12)', border: '#eab308', text: '#eab308', label: 'Partial Connectivity' },
    checking: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#3b82f6', label: 'Running Checks...' },
  }

  const sts = statusColors[overallStatus]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="border-b backdrop-blur sticky top-0 z-20" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--modal-header-bg)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="hover:opacity-80 transition-colors text-sm" style={{ color: 'var(--text-muted)' }}>
              &larr; Projects
            </Link>
            <span style={{ color: 'var(--border-secondary)' }}>/</span>
            <span className="text-sm font-semibold">System Status</span>
          </div>
          <div className="flex items-center gap-3">
            <HelpButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Overall Status Banner */}
        <div
          className="rounded-xl border p-5 text-center"
          style={{ backgroundColor: sts.bg, borderColor: sts.border }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <div
              className={`w-3 h-3 rounded-full ${overallStatus === 'checking' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: sts.text }}
            />
            <h1 className="text-lg font-bold" style={{ color: sts.text }}>{sts.label}</h1>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lastCheck
              ? `Last checked: ${lastCheck.toLocaleTimeString()} · Auto-refresh every 30s`
              : 'Initializing...'}
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {services.map(svc => (
            <ServiceCard
              key={svc.key}
              name={svc.name}
              description={svc.description}
              icon={svc.icon}
              data={svc.data}
              loading={loading && !healthData}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={runChecks}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8a6 6 0 0111.2-3M14 8a6 6 0 01-11.2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M13 2v3h-3M3 14v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {loading ? 'Checking...' : 'Run All Checks'}
            </button>
            <a
              href="http://104.248.69.86:3004/health"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              Gateway Health JSON
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 1h7v7M11 1L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a
              href="https://supabase.com/dashboard/project/gtfffxwfgcxiiauliynd"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              Supabase Dashboard
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 1h7v7M11 1L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Database Stats */}
        {dbStats && (
          <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Database Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              <StatBlock label="Projects" value={dbStats.projects} />
              <StatBlock label="Tasks" value={dbStats.tasks} />
              <StatBlock label="Events" value={dbStats.events} />
            </div>
          </div>
        )}

        {/* Check History */}
        {history.length > 1 && (
          <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              Check History <span className="font-normal text-[10px]" style={{ color: 'var(--text-muted)' }}>({history.length} checks)</span>
            </h2>
            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
              {history.map((h, i) => {
                const allOk = Object.values(h.checks).every(c => c.status === 'connected')
                const hasError = Object.values(h.checks).some(c => c.status === 'error')
                const time = new Date(h.timestamp).toLocaleTimeString()
                const avgLatency = Math.round(
                  Object.values(h.checks).reduce((sum, c) => sum + (c.latency || 0), 0) /
                  Object.values(h.checks).length
                )

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded text-xs"
                    style={{ backgroundColor: i === 0 ? 'var(--bg-card-hover)' : 'transparent' }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: allOk ? '#22c55e' : hasError ? '#ef4444' : '#eab308' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>{time}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {Object.entries(h.checks).map(([key, val]) => (
                        <span
                          key={key}
                          className="text-[10px] font-mono"
                          style={{
                            color: val.status === 'connected' ? '#22c55e' : val.status === 'error' ? '#ef4444' : '#eab308'
                          }}
                          title={`${key}: ${val.message}`}
                        >
                          {key.slice(0, 3).toUpperCase()}
                        </span>
                      ))}
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{avgLatency}ms avg</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Architecture Info */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Architecture</h2>
          <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <ArchRow label="Frontend" value="React 19 + Vite 6 — projects.asi360.co" />
            <ArchRow label="Database" value="Supabase (gtfffxwfgcxiiauliynd) — asi360-commerce" />
            <ArchRow label="CRM" value="VTiger 7.4 via Gateway API (104.248.69.86:3004)" />
            <ArchRow label="Sync" value="Airtable CEO Dashboard (appOkZt0CLLBLo2Fr)" />
            <ArchRow label="Hosting" value="DigitalOcean Droplet (104.248.69.86) — Ubuntu + Nginx" />
            <ArchRow label="Secrets" value="Supabase Vault (vault.decrypted_secrets)" />
          </div>
        </div>
      </main>
    </div>
  )
}

/* ── Sub-components ── */

function ServiceCard({ name, description, icon, data, loading }) {
  const status = data?.status || 'checking'
  const latency = data?.latency
  const message = data?.message || ''

  const colors = {
    connected: { dot: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', label: 'Connected', labelColor: '#22c55e' },
    degraded: { dot: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.3)', label: 'Degraded', labelColor: '#eab308' },
    error: { dot: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', label: 'Down', labelColor: '#ef4444' },
    unknown: { dot: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.3)', label: 'Unknown', labelColor: '#6b7280' },
    checking: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', label: 'Checking...', labelColor: '#3b82f6' },
  }

  const c = colors[status] || colors.checking

  return (
    <div
      className="rounded-lg border p-4 transition-all"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${status === 'checking' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: c.dot }}
          />
          <span className="text-xs font-medium" style={{ color: c.labelColor }}>{c.label}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs truncate max-w-[70%]" style={{ color: 'var(--text-muted)' }}>{message}</p>
        {latency !== undefined && (
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: latency < 300 ? '#22c55e' : latency < 1000 ? '#eab308' : '#ef4444',
            }}
          >
            {latency}ms
          </span>
        )}
      </div>
    </div>
  )
}

function StatBlock({ label, value }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
      <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function ArchRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="flex-1 font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}
