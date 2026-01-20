import { useCallback, useRef, useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useUploadStore } from '../stores/uploadStore'
import { useAuthStore } from '../stores/authStore'
import DropZone from '../components/DropZone'
import FileQueue from '../components/FileQueue'
import UploadSummary from '../components/UploadSummary'
import UploadControls from '../components/UploadControls'

export default function UploadPage() {
  const { session, markComplete, clearSession } = useSessionStore()
  const { files, addFiles, isUploading, clearAll } = useUploadStore()
  const { logout } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const queuedCount = files.filter(f => f.status === 'queued').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const completedCount = files.filter(f => f.status === 'completed').length
  const failedCount = files.filter(f => f.status === 'failed').length
  const pausedCount = files.filter(f => f.status === 'paused').length

  // Check if all uploads are done
  const allDone = files.length > 0 && uploadingCount === 0 && queuedCount === 0 && pausedCount === 0

  // Show modal when all uploads complete
  useEffect(() => {
    if (allDone && !completed && !showCompleteModal) {
      // Small delay to let the UI update
      const timer = setTimeout(() => {
        setShowCompleteModal(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [allDone, completed, showCompleteModal])

  const handleFilesSelected = useCallback((selectedFiles: FileList | File[]) => {
    addFiles(selectedFiles)
    setShowCompleteModal(false) // Hide modal if they add more files
    setCompleted(false)
  }, [addFiles])

  const handleBrowseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleBrowseFolders = () => {
    folderInputRef.current?.click()
  }

  const handleCompleteSession = async () => {
    if (completing || completed) return
    setCompleting(true)
    try {
      await markComplete()
      setCompleted(true)
      // Wait a moment then logout
      setTimeout(() => {
        clearAll()
        clearSession()
        logout()
      }, 2500)
    } catch (error) {
      console.error('Failed to complete session:', error)
      setCompleting(false)
    }
  }

  const handleAddMoreFiles = () => {
    setShowCompleteModal(false)
  }

  if (!session) return null

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Session Header */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{session.projectName}</h2>
            <p className="text-gray-400">{session.crewName}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="font-mono text-xs truncate max-w-[300px]" title={session.folderPath}>
              {session.folderPath.replace(/^\/uploads/, '')}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error - webkitdirectory is not in the type definition
        webkitdirectory="true"
        className="hidden"
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
      />

      {/* Drop Zone - only show when not uploading or queue is empty */}
      {(!isUploading || files.length === 0) && (
        <DropZone
          onFilesDropped={handleFilesSelected}
          onBrowseFiles={handleBrowseFiles}
          onBrowseFolders={handleBrowseFolders}
        />
      )}

      {/* File Queue */}
      {files.length > 0 && (
        <>
          <FileQueue />
          <UploadControls />
          <UploadSummary />
        </>
      )}

      {/* Empty state info */}
      {files.length === 0 && !isUploading && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4">Tips for uploading</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Upload any file type - video, audio, images, documents, project files</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Large files supported - uploads are resumable if interrupted</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Folder structure is preserved when uploading folders</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>The Turbo Editing Team will receive a notification when all uploads complete.</span>
            </li>
          </ul>
        </div>
      )}

      {/* Upload Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full border border-gray-700 shadow-2xl animate-slide-up">
            {!completed ? (
              <>
                {/* Success Icon */}
                <div className="pt-8 pb-4 text-center">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Uploads Complete!</h2>
                  <p className="text-gray-400 mt-2">
                    {completedCount} file{completedCount !== 1 ? 's' : ''} uploaded successfully
                    {failedCount > 0 && (
                      <span className="text-red-400"> ({failedCount} failed)</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-6 space-y-3">
                  <button
                    onClick={handleCompleteSession}
                    disabled={completing}
                    className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-wait text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-900/30"
                  >
                    {completing ? (
                      <>
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Notifying Team...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete & Notify Team
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleAddMoreFiles}
                    disabled={completing}
                    className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-xl font-medium transition-colors"
                  >
                    Upload More
                  </button>
                </div>

                <div className="px-6 pb-6">
                  <p className="text-center text-gray-500 text-sm">
                    Click "Complete & Notify Team" to let the editing team know your files are ready.
                  </p>
                </div>
              </>
            ) : (
              /* Completed State */
              <div className="py-12 px-6 text-center">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
                <p className="text-gray-400">The team has been notified.</p>
                <p className="text-gray-500 text-sm mt-4">Redirecting to login...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
