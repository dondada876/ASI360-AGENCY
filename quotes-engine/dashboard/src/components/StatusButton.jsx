import { Link } from 'react-router-dom'

/**
 * StatusButton — Heartbeat pulse icon linking to /status.
 */
export default function StatusButton() {
  return (
    <Link
      to="/status"
      className="p-2 rounded-lg transition-colors"
      style={{ color: 'var(--text-muted)' }}
      title="System Status"
      aria-label="System Status"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M1 9h3l2-4 3 8 2-6 2 2h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}
