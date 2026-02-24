import { useMemo } from 'react'
import { useUploadStore } from '../stores/uploadStore'
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format'

interface BatchProgressProps {
  batchNumber: number
}

export default function BatchProgress({ batchNumber }: BatchProgressProps) {
  const { files } = useUploadStore()

  const stats = useMemo(() => {
    const total = files.length
    const completed = files.filter(f => f.status === 'completed').length
    const failed = files.filter(f => f.status === 'failed').length
    const uploading = files.filter(f => f.status === 'uploading').length
    const queued = files.filter(f => f.status === 'queued' || f.status === 'paused').length

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    const uploadedBytes = files.reduce((sum, f) => sum + f.bytesUploaded, 0)

    const uploadingFiles = files.filter(f => f.status === 'uploading')
    const totalSpeed = uploadingFiles.reduce((sum, f) => sum + f.speed, 0)

    const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0

    return { total, completed, failed, uploading, queued, totalBytes, uploadedBytes, totalSpeed, overallProgress }
  }, [files])

  const isComplete = stats.completed + stats.failed === stats.total && stats.total > 0
  const barColor = isComplete
    ? stats.failed > 0 ? 'bg-amber-500' : 'bg-green-500'
    : 'bg-turbo-blue progress-bar-striped'

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">
          Batch {batchNumber} &mdash; {isComplete ? 'Complete' : 'Uploading'}
        </span>
        <span className="text-sm font-medium text-white">{stats.overallProgress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-300 rounded-full ${barColor}`}
          style={{ width: `${stats.overallProgress}%` }}
        />
      </div>

      {/* Stats line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{stats.completed} / {stats.total} files</span>
        <span>{formatBytes(stats.uploadedBytes)} / {formatBytes(stats.totalBytes)}</span>
        {stats.totalSpeed > 0 && <span>{formatSpeed(stats.totalSpeed)}</span>}
        {stats.totalSpeed > 0 && stats.uploadedBytes < stats.totalBytes && (
          <span>ETA ~{formatTimeRemaining(stats.totalBytes - stats.uploadedBytes, stats.totalSpeed)}</span>
        )}
      </div>
    </div>
  )
}
