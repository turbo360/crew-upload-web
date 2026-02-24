import { useUploadStore } from '../stores/uploadStore'

interface UploadControlsProps {
  onBrowseFiles: () => void
  onBrowseFolders?: () => void
}

export default function UploadControls({ onBrowseFiles }: UploadControlsProps) {
  const {
    files,
    isUploading,
    isPaused,
    startUpload,
    pauseAll,
    resumeAll,
    retryFailed,
  } = useUploadStore()

  const queuedCount = files.filter(f => f.status === 'queued').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const failedCount = files.filter(f => f.status === 'failed').length
  const pausedCount = files.filter(f => f.status === 'paused').length

  const hasQueued = queuedCount > 0 || pausedCount > 0
  const hasUploading = uploadingCount > 0
  const hasFailed = failedCount > 0

  return (
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
          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry Failed ({failedCount})
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add More Files */}
      <button
        onClick={onBrowseFiles}
        className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add More Files
      </button>
    </div>
  )
}
