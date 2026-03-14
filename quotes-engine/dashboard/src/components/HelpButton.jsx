import { Link } from 'react-router-dom'

/**
 * HelpButton — Question mark icon that links to /help.
 * Placed in page headers next to ThemeToggle.
 */
export default function HelpButton() {
  return (
    <Link
      to="/help"
      className="p-2 rounded-lg transition-colors"
      style={{ color: 'var(--text-muted)' }}
      title="Help & Documentation"
      aria-label="Help"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6.5 7a2.5 2.5 0 015 0c0 1.5-2.5 1.5-2.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="9" cy="13" r="0.75" fill="currentColor"/>
      </svg>
    </Link>
  )
}
