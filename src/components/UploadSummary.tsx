import { useMemo } from 'react'
import { useUploadStore } from '../stores/uploadStore'
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format'

export default function UploadSummary() {
  const { files } = useUploadStore()

  const stats = useMemo(() => {
    const total = files.length
    const queued = files.filter(f => f.status === 'queued').length
    const uploading = files.filter(f => f.status === 'uploading').length
    const paused = files.filter(f => f.status === 'paused').length
    const completed = files.filter(f => f.status === 'completed').length
    const failed = files.filter(f => f.status === 'failed').length

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    const uploadedBytes = files.reduce((sum, f) => sum + f.bytesUploaded, 0)
    const remainingBytes = totalBytes - uploadedBytes

    // Calculate average speed from uploading files
    const uploadingFiles = files.filter(f => f.status === 'uploading')
    const totalSpeed = uploadingFiles.reduce((sum, f) => sum + f.speed, 0)

    const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0

    return {
      total,
      queued,
      uploading,
      paused,
      completed,
      failed,
      totalBytes,
      uploadedBytes,
      remainingBytes,
      totalSpeed,
      overallProgress
    }
  }, [files])

  const isAllComplete = stats.completed === stats.total && stats.total > 0
  const hasFailed = stats.failed > 0

  return (
    <div className={`
      rounded-xl p-6 border transition-colors
      ${isAllComplete
        ? 'bg-green-900/20 border-green-600/50'
        : hasFailed
          ? 'bg-gray-800 border-red-600/50'
          : 'bg-gray-800 border-gray-700'
      }
    `}>
      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Overall Progress</span>
          <span className="text-sm font-medium text-white">{stats.overallProgress}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAllComplete
                ? 'bg-green-500'
                : stats.uploading > 0
                  ? 'bg-turbo-blue progress-bar-striped'
                  : 'bg-turbo-blue'
            }`}
            style={{ width: `${stats.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Files"
          value={stats.total.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />

        <StatCard
          label="Total Size"
          value={formatBytes(stats.totalBytes)}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          }
        />

        <StatCard
          label="Uploaded"
          value={`${stats.completed} / ${stats.total}`}
          subValue={formatBytes(stats.uploadedBytes)}
          color={stats.completed === stats.total ? 'green' : undefined}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />

        <StatCard
          label={stats.uploading > 0 ? 'Speed' : 'Status'}
          value={
            stats.uploading > 0
              ? formatSpeed(stats.totalSpeed)
              : stats.failed > 0
                ? `${stats.failed} Failed`
                : isAllComplete
                  ? 'Complete'
                  : 'Ready'
          }
          subValue={
            stats.uploading > 0 && stats.totalSpeed > 0
              ? `${formatTimeRemaining(stats.remainingBytes, stats.totalSpeed)} remaining`
              : undefined
          }
          color={stats.failed > 0 ? 'red' : isAllComplete ? 'green' : undefined}
          icon={
            stats.uploading > 0 ? (
              <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )
          }
        />
      </div>

      {/* Completion message */}
      {isAllComplete && (
        <div className="mt-6 p-4 bg-green-900/30 border border-green-600/30 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-white">All uploads complete!</p>
              <p className="text-sm text-gray-400">
                An email notification has been sent to the team.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  color?: 'green' | 'red'
  icon: React.ReactNode
}

function StatCard({ label, value, subValue, color, icon }: StatCardProps) {
  const colorClasses = {
    green: 'text-green-400',
    red: 'text-red-400'
  }

  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color ? colorClasses[color] : 'text-white'}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      )}
    </div>
  )
}
