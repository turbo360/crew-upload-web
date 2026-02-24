import { formatBytes, formatDuration } from '../utils/format'

interface BatchCompleteBannerProps {
  batchNumber: number
  fileCount: number
  totalBytes: number
  duration: number // ms
  failedFiles: number
}

export default function BatchCompleteBanner({ batchNumber, fileCount, totalBytes, duration, failedFiles }: BatchCompleteBannerProps) {
  const hasFailed = failedFiles > 0
  const borderColor = hasFailed ? 'border-amber-600/50' : 'border-green-600/50'
  const bgColor = hasFailed ? 'bg-amber-900/20' : 'bg-green-900/20'
  const iconColor = hasFailed ? 'text-amber-400' : 'text-green-400'
  const iconBg = hasFailed ? 'bg-amber-500/20' : 'bg-green-500/20'

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-5`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
          {hasFailed ? (
            <svg className={`w-6 h-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ) : (
            <svg className={`w-6 h-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">
            Batch {batchNumber} Complete!
          </h3>
          <p className="text-sm text-gray-300">
            {fileCount} files &mdash; {formatBytes(totalBytes)} &mdash; {formatDuration(duration)}
            {hasFailed && <span className="text-amber-400 ml-2">({failedFiles} failed)</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
