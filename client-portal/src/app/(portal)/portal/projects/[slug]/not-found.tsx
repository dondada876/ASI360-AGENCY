import Link from "next/link"

export default function ProjectNotFound() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-4">
        <Link
          href="/portal"
          className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          &larr; All Projects
        </Link>
      </div>
      <div className="text-center py-20">
        <div className="text-4xl mb-4 text-gray-300 dark:text-slate-700">
          &#128269;
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Project Not Found
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
          This project doesn&apos;t exist or you don&apos;t have access to
          view it.
        </p>
        <Link
          href="/portal"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          View Your Projects
        </Link>
      </div>
    </div>
  )
}
