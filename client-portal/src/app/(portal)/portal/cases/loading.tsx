import { ListSkeleton } from "@/components/ui/skeleton"

export default function CasesLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-40 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-2" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>
      <ListSkeleton rows={6} />
    </div>
  )
}
