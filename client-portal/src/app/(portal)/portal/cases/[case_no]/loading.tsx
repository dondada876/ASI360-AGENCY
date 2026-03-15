import { Skeleton, CardSkeleton } from "@/components/ui/skeleton"

export default function CaseDetailLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <Skeleton className="h-3 w-20 mb-4" />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-2/3 mb-2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      {/* Description */}
      <CardSkeleton />
      {/* Activity */}
      <div className="mt-6 space-y-3">
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg"
          >
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
