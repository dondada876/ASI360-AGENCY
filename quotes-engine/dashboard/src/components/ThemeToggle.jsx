import { useTheme } from '../lib/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="transition-transform duration-300" style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        {isDark ? (
          // Sun icon
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="9" cy="9" r="3.5" className="text-[var(--text-secondary)]" />
            <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.05 4.05l1.06 1.06M12.89 12.89l1.06 1.06M4.05 13.95l1.06-1.06M12.89 5.11l1.06-1.06" className="text-[var(--text-muted)]" />
          </g>
        ) : (
          // Moon icon
          <path
            d="M15 10.37A7 7 0 117.63 3 5.5 5.5 0 0015 10.37z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--text-secondary)]"
          />
        )}
      </svg>
    </button>
  )
}
