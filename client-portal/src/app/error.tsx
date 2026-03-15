"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center text-2xl mx-auto mb-4">
          &#9888;
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Try Again
        </button>
        {error.digest && (
          <p className="text-[10px] text-gray-300 dark:text-slate-700 mt-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
