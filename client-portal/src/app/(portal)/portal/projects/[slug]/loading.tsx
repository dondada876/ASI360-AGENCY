import { Skeleton, StatSkeleton, ListSkeleton } from "@/components/ui/skeleton"

export default function ProjectDetailLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <Skeleton className="h-3 w-20 mb-4" />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <Skeleton className="h-7 w-1/2 mb-2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      {/* Phase progress */}
      <div className="mb-8">
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1">
              <Skeleton className="h-2 rounded-full" />
              <Skeleton className="h-2 w-12 mx-auto mt-1" />
            </div>
          ))}
        </div>
      </div>
      {/* Tasks */}
      <div className="mb-8">
        <Skeleton className="h-3 w-12 mb-3" />
        <ListSkeleton rows={5} />
      </div>
    </div>
  )
}
