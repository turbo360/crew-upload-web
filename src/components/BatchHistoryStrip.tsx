import { useState } from 'react'
import { BatchRecord } from '../stores/sessionStore'
import { formatBytes, formatDuration, formatTime } from '../utils/format'

interface BatchHistoryStripProps {
  batches: BatchRecord[]
}

export default function BatchHistoryStrip({ batches }: BatchHistoryStripProps) {
  if (batches.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed Batches</h3>
      <div className="space-y-1">
        {batches.map(batch => (
          <BatchCard key={batch.batchNumber} batch={batch} />
        ))}
      </div>
    </div>
  )
}

function BatchCard({ batch }: { batch: BatchRecord }) {
  const [expanded, setExpanded] = useState(false)
  const hasFailed = batch.failedFiles > 0
  const duration = new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime()

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700/50 transition-colors text-left"
      >
        {/* Expand/collapse chevron */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>

        {/* Batch info */}
        <span className="text-sm font-medium text-white">Batch {batch.batchNumber}</span>
        <span className="text-xs text-gray-400">{formatTime(batch.completedAt)}</span>

        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs text-gray-400">{batch.fileCount} files</span>
        <span className="text-xs text-gray-400">{formatBytes(batch.totalBytes)}</span>
        <span className="text-xs text-gray-400">{formatDuration(duration)}</span>

        {/* Status icon */}
        {hasFailed ? (
          <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </span>
        ) : (
          <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{batch.completedFiles} completed</span>
            {hasFailed && <span className="text-red-400">{batch.failedFiles} failed</span>}
            <span>{formatBytes(batch.totalBytes)} transferred</span>
          </div>
        </div>
      )}
    </div>
  )
}
