import { useState } from 'react'
import { useUploadStore } from '../stores/uploadStore'
import { useSessionStore } from '../stores/sessionStore'

export default function UploadControls() {
  const {
    files,
    isUploading,
    isPaused,
    startUpload,
    pauseAll,
    resumeAll,
    retryFailed,
    clearCompleted,
    clearAll
  } = useUploadStore()

  const { markComplete, clearSession } = useSessionStore()
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const queuedCount = files.filter(f => f.status === 'queued').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const completedCount = files.filter(f => f.status === 'completed').length
  const failedCount = files.filter(f => f.status === 'failed').length
  const pausedCount = files.filter(f => f.status === 'paused').length

  const hasQueued = queuedCount > 0 || pausedCount > 0
  const hasUploading = uploadingCount > 0
  const hasCompleted = completedCount > 0
  const hasFailed = failedCount > 0

  // All files are done (completed or failed), none uploading or queued
  const allDone = files.length > 0 && !hasUploading && !hasQueued && !isPaused

  const handleCompleteSession = async () => {
    if (completing || completed) return
    setCompleting(true)
    try {
      await markComplete()
      setCompleted(true)
      // Clear session after a short delay
      setTimeout(() => {
        clearAll()
        clearSession()
      }, 3000)
    } catch (error) {
      console.error('Failed to complete session:', error)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex flex-wrap items-center gap-3">
        {/* Start / Pause / Resume */}
        {!isUploading && hasQueued && (
          <button
            onClick={startUpload}
            className="px-4 py-2 bg-turbo-blue hover:bg-turbo-blue-dark text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload All
          </button>
        )}

        {isUploading && hasUploading && !isPaused && (
          <button
            onClick={pauseAll}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pause All
          </button>
        )}

        {isPaused && pausedCount > 0 && (
          <button
            onClick={resumeAll}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Resume All
          </button>
        )}

        {/* Retry Failed */}
        {hasFailed && (
          <button
            onClick={retryFailed}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Failed ({failedCount})
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear actions */}
        {hasCompleted && (
          <button
            onClick={clearCompleted}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Clear Completed
          </button>
        )}

        {files.length > 0 && !hasUploading && (
          <button
            onClick={clearAll}
            className="px-4 py-2 text-gray-400 hover:text-red-400 transition-colors text-sm"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Complete Session Button - shows when all uploads are done */}
      {allDone && !completed && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={handleCompleteSession}
            disabled={completing}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-wait text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {completing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Completing Session...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete Session & Notify Team
              </>
            )}
          </button>
          <p className="text-center text-gray-500 text-sm mt-2">
            {completedCount} file{completedCount !== 1 ? 's' : ''} uploaded successfully
            {failedCount > 0 && `, ${failedCount} failed`}
          </p>
        </div>
      )}

      {/* Session Completed Message */}
      {completed && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
            <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-green-400">Session Complete!</h3>
            <p className="text-gray-400 text-sm mt-1">The team has been notified. Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  )
}
