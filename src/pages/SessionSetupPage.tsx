import { useState, FormEvent } from 'react'
import { useSessionStore } from '../stores/sessionStore'

export default function SessionSetupPage() {
  const [crewName, setCrewName] = useState('')
  const [projectName, setProjectName] = useState('')
  const { createSession, isLoading, error, clearError } = useSessionStore()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!crewName.trim() || !projectName.trim()) return
    await createSession(crewName.trim(), projectName.trim())
  }

  const isValid = crewName.trim().length > 0 && projectName.trim().length > 0

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-turbo-blue/20 rounded-full mb-4">
              <svg className="w-7 h-7 text-turbo-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Start Upload Session</h2>
            <p className="text-gray-400 mt-2">Enter your details to begin uploading files</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-red-400 hover:text-red-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Session form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Crew Name */}
              <div>
                <label htmlFor="crewName" className="block text-sm font-medium text-gray-300 mb-2">
                  Crew Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="crewName"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20 transition-all"
                  placeholder="e.g., John Smith or Melbourne Crew A"
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Your name or team identifier
                </p>
              </div>

              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20 transition-all"
                  placeholder="e.g., Toyota Campaign 2024"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  The project these files belong to
                </p>
              </div>
            </div>

            {/* Info box */}
            <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-turbo-blue flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-white mb-1">Your files will be organized as:</p>
                  <p className="font-mono text-xs text-gray-400 break-all">
                    /{projectName || 'Project'}/{crewName || 'Crew'}/{new Date().toISOString().split('T')[0]}/
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="mt-6 w-full py-3 px-4 bg-turbo-blue hover:bg-turbo-blue-dark disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Session...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Start Upload Session
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
