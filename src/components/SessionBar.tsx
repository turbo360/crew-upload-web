import { useSessionStore } from '../stores/sessionStore'
import { formatBytes, formatTime } from '../utils/format'

export default function SessionBar() {
  const { session, batches } = useSessionStore()

  if (!session) return null

  const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0)
  const totalBytes = batches.reduce((sum, b) => sum + b.totalBytes, 0)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-medium text-white">{session.projectName}</span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-300">{session.crewName}</span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-400">Started {formatTime(session.createdAt)}</span>
      {totalFiles > 0 && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300">{totalFiles} files</span>
          <span className="text-gray-400">{formatBytes(totalBytes)}</span>
        </>
      )}
      {batches.length > 0 && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
        </>
      )}
    </div>
  )
}
