/**
 * Skeleton — Shimmer loading placeholders matching dashboard layout.
 */

function SkeletonBlock({ className = '', style = {} }) {
  return (
    <div
      className={`animate-skeleton rounded ${className}`}
      style={{ backgroundColor: 'var(--progress-track)', ...style }}
    />
  )
}

export function SkeletonHUD() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header skeleton */}
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-16 h-4" />
            <SkeletonBlock className="w-48 h-5" />
          </div>
          <SkeletonBlock className="w-20 h-4" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Project header card */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <SkeletonBlock className="w-64 h-6" />
              <SkeletonBlock className="w-40 h-4" />
              <div className="flex gap-3">
                <SkeletonBlock className="w-20 h-3" />
                <SkeletonBlock className="w-24 h-3" />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center space-y-2">
                <SkeletonBlock className="w-12 h-8 mx-auto" />
                <SkeletonBlock className="w-14 h-3 mx-auto" />
              </div>
              <div className="text-center space-y-2">
                <SkeletonBlock className="w-12 h-8 mx-auto" />
                <SkeletonBlock className="w-14 h-3 mx-auto" />
              </div>
              <div className="text-center space-y-2">
                <SkeletonBlock className="w-12 h-8 mx-auto" />
                <SkeletonBlock className="w-14 h-3 mx-auto" />
              </div>
            </div>
          </div>
          <SkeletonBlock className="w-full h-3 mt-4" />
        </div>

        {/* View controls */}
        <div className="flex gap-3">
          <SkeletonBlock className="w-24 h-9" />
          <SkeletonBlock className="w-24 h-9" />
          <SkeletonBlock className="w-24 h-9" />
          <div className="flex-1" />
          <SkeletonBlock className="w-48 h-9" />
        </div>

        {/* Gantt + sidebar */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 rounded-lg border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <SkeletonBlock className="w-full h-8" />
            <SkeletonBlock className="w-full h-6" />
            {[1, 2, 3, 4, 5].map(i => (
              <SkeletonBlock key={i} className="w-full h-10" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <SkeletonBlock className="w-24 h-4" />
              {[1, 2, 3].map(i => (
                <SkeletonBlock key={i} className="w-full h-8" />
              ))}
            </div>
            <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <SkeletonBlock className="w-24 h-4" />
              <SkeletonBlock className="w-full h-16" />
              <SkeletonBlock className="w-full h-16" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export function SkeletonProjectList() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-8 h-8 rounded" />
            <div className="space-y-1">
              <SkeletonBlock className="w-40 h-5" />
              <SkeletonBlock className="w-32 h-3" />
            </div>
          </div>
          <SkeletonBlock className="w-20 h-4" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-xl border p-5 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <SkeletonBlock className="w-20 h-3" />
                <SkeletonBlock className="w-16 h-5 rounded" />
              </div>
              <SkeletonBlock className="w-48 h-4" />
              <SkeletonBlock className="w-32 h-3" />
              <SkeletonBlock className="w-full h-2 rounded-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default SkeletonBlock
