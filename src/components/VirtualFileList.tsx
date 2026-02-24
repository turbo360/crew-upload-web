import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { UploadFile, UploadStatus } from '../stores/uploadStore'
import { formatBytes, formatSpeed, truncateFilename } from '../utils/format'

interface VirtualFileListProps {
  files: UploadFile[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onCancel?: (id: string) => void
}

export default function VirtualFileList({ files, onRemove, onRetry }: VirtualFileListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const file = files[virtualRow.index]
          return (
            <div
              key={file.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <VirtualFileItem
                file={file}
                onRemove={() => onRemove(file.id)}
                onRetry={() => onRetry(file.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VirtualFileItem({ file, onRemove, onRetry }: {
  file: UploadFile
  onRemove: () => void
  onRetry: () => void
}) {
  return (
    <div className="px-6 py-3 hover:bg-gray-700/30 transition-colors border-b border-gray-700 last:border-0">
      <div className="flex items-center gap-4">
        <FileIcon mimeType={file.mimeType} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate" title={file.filename}>
              {truncateFilename(file.filename, 50)}
            </p>
            <StatusBadge status={file.status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span>{formatBytes(file.size)}</span>
            {file.status === 'uploading' && file.speed > 0 && (
              <>
                <span>{formatSpeed(file.speed)}</span>
                <span>{file.progress}%</span>
              </>
            )}
            {file.error && <span className="text-red-400 truncate">{file.error}</span>}
          </div>

          {(file.status === 'uploading' || file.status === 'paused') && (
            <div className="mt-1.5">
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    file.status === 'paused' ? 'bg-yellow-500' : 'bg-turbo-blue'
                  }`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {file.status === 'failed' && (
            <button onClick={onRetry} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Retry">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {(file.status === 'queued' || file.status === 'completed' || file.status === 'failed') && (
            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors" title="Remove">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  const cfg = {
    queued: { bg: 'bg-gray-600', label: 'Queued' },
    uploading: { bg: 'bg-turbo-blue', label: 'Uploading' },
    paused: { bg: 'bg-yellow-600', label: 'Paused' },
    completed: { bg: 'bg-green-600', label: 'Complete' },
    failed: { bg: 'bg-red-600', label: 'Failed' }
  }
  const { bg, label } = cfg[status]

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${bg}`}>
      {status === 'uploading' && (
        <svg className="animate-spin -ml-0.5 mr-0.5 h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
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
    <div className={`w-8 h-8 ${bgColor} rounded flex items-center justify-center flex-shrink-0`}>
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
      </svg>
    </div>
  )
}
