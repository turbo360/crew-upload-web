import { useUploadStore, UploadFile, UploadStatus } from '../stores/uploadStore'
import { formatBytes, formatSpeed, truncateFilename } from '../utils/format'

export default function FileQueue() {
  const { files, removeFile, retryFile, cancelFile } = useUploadStore()

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h3 className="text-lg font-medium text-white">
          Upload Queue
          <span className="ml-2 text-sm text-gray-400">({files.length} files)</span>
        </h3>
      </div>

      {/* File list */}
      <div className="divide-y divide-gray-700 max-h-[400px] overflow-y-auto">
        {files.map(file => (
          <FileQueueItem
            key={file.id}
            file={file}
            onRemove={() => removeFile(file.id)}
            onRetry={() => retryFile(file.id)}
            onCancel={() => cancelFile(file.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface FileQueueItemProps {
  file: UploadFile
  onRemove: () => void
  onRetry: () => void
  onCancel: () => void
}

function FileQueueItem({ file, onRemove, onRetry, onCancel }: FileQueueItemProps) {
  return (
    <div className="px-6 py-4 hover:bg-gray-700/30 transition-colors">
      <div className="flex items-center gap-4">
        {/* File icon */}
        <div className="flex-shrink-0">
          <FileIcon mimeType={file.mimeType} />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate" title={file.filename}>
              {truncateFilename(file.filename, 50)}
            </p>
            <StatusBadge status={file.status} />
          </div>

          {/* Original path for folder uploads */}
          {file.originalPath && (
            <p className="text-xs text-gray-500 truncate mt-0.5" title={file.originalPath}>
              {file.originalPath}
            </p>
          )}

          {/* Size and speed */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span>{formatBytes(file.size)}</span>
            {file.status === 'uploading' && file.speed > 0 && (
              <>
                <span>•</span>
                <span>{formatSpeed(file.speed)}</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          {(file.status === 'uploading' || file.status === 'paused') && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    file.status === 'paused' ? 'bg-yellow-500' : 'bg-turbo-blue progress-bar-striped'
                  }`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {file.progress}% • {formatBytes(file.bytesUploaded)} of {formatBytes(file.size)}
              </p>
            </div>
          )}

          {/* Error message */}
          {file.error && (
            <p className="text-xs text-red-400 mt-1">{file.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {file.status === 'failed' && (
            <button
              onClick={onRetry}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Retry"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {(file.status === 'uploading' || file.status === 'paused') && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded-lg transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {(file.status === 'queued' || file.status === 'completed' || file.status === 'failed') && (
            <button
              onClick={onRemove}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const config = {
    queued: { bg: 'bg-gray-600', text: 'text-gray-200', label: 'Queued' },
    uploading: { bg: 'bg-turbo-blue', text: 'text-white', label: 'Uploading' },
    paused: { bg: 'bg-yellow-600', text: 'text-white', label: 'Paused' },
    completed: { bg: 'bg-green-600', text: 'text-white', label: 'Complete' },
    failed: { bg: 'bg-red-600', text: 'text-white', label: 'Failed' }
  }

  const { bg, text, label } = config[status]

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {status === 'uploading' && (
        <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {label}
    </span>
  )
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isVideo = mimeType.startsWith('video/')
  const isImage = mimeType.startsWith('image/')
  const isAudio = mimeType.startsWith('audio/')

  let iconPath = 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  let bgColor = 'bg-gray-600'

  if (isVideo) {
    iconPath = 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
    bgColor = 'bg-purple-600'
  } else if (isImage) {
    iconPath = 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    bgColor = 'bg-blue-600'
  } else if (isAudio) {
    iconPath = 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3'
    bgColor = 'bg-green-600'
  }

  return (
    <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center`}>
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
      </svg>
    </div>
  )
}
