import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useUploadStore } from '../stores/uploadStore'
import { useAuthStore } from '../stores/authStore'

export default function EndSessionCard() {
  const { session, batches, markComplete, clearSession } = useSessionStore()
  const { clearAll } = useUploadStore()
  const { logout } = useAuthStore()
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0)

  const handleEndSession = async () => {
    if (completing || completed || !session) return

    const confirmed = confirm(
      `End session for ${session.projectName}? ${batches.length} batch${batches.length !== 1 ? 'es' : ''}, ${totalFiles} files uploaded today.`
    )
    if (!confirmed) return

    setCompleting(true)
    try {
      await markComplete()
      setCompleted(true)
      setTimeout(() => {
        clearAll()
        clearSession()
      }, 2500)
    } catch (error) {
      console.error('Failed to complete session:', error)
      setCompleting(false)
    }
  }

  const handleLogout = () => {
    clearAll()
    clearSession()
    logout()
  }

  if (completed) {
    return (
      <div className="bg-green-900/20 border border-green-600/50 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Session Complete!</h3>
        <p className="text-gray-400 mb-1">The team has been notified.</p>
        <p className="text-gray-500 text-sm">{batches.length} batch{batches.length !== 1 ? 'es' : ''}, {totalFiles} files uploaded today.</p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => { clearAll(); clearSession() }}
            className="px-6 py-2.5 bg-turbo-blue hover:bg-turbo-blue-dark text-white rounded-lg font-medium transition-colors"
          >
            Start New Session
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Done for today?</span>
        <button
          onClick={handleEndSession}
          disabled={completing}
          className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-wait text-gray-300 hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          {completing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Ending Session...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              End Session & Notify Team
            </>
          )}
        </button>
      </div>
    </div>
  )
}
