import { CardSkeleton, StatSkeleton } from "@/components/ui/skeleton"

export default function PortalLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-7 w-48 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
      </div>
      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    </div>
  )
}
