import { useCallback, useRef, useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useUploadStore } from '../stores/uploadStore'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import DropZone from '../components/DropZone'
import FileQueue from '../components/FileQueue'
import BatchProgress from '../components/BatchProgress'
import BatchCompleteBanner from '../components/BatchCompleteBanner'
import BatchHistoryStrip from '../components/BatchHistoryStrip'
import UploadControls from '../components/UploadControls'
import EndSessionCard from '../components/EndSessionCard'

export default function UploadPage() {
  const { session, batches, currentBatchNumber, completeBatch } = useSessionStore()
  const { files, addFiles, clearForNewBatch } = useUploadStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Track the batch start time
  const batchStartRef = useRef<string | null>(null)
  // Track whether we've already completed this batch
  const batchCompletedRef = useRef(false)
  // Show completion banner state
  const [showBanner, setShowBanner] = useState(false)
  const [bannerStats, setBannerStats] = useState<{
    batchNumber: number
    fileCount: number
    totalBytes: number
    duration: number
    failedFiles: number
  } | null>(null)

  const queuedCount = files.filter(f => f.status === 'queued').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const completedCount = files.filter(f => f.status === 'completed').length
  const failedCount = files.filter(f => f.status === 'failed').length
  const pausedCount = files.filter(f => f.status === 'paused').length

  // Check if all uploads in current batch are done
  const allDone = files.length > 0 && uploadingCount === 0 && queuedCount === 0 && pausedCount === 0

  // Set batch start time when first file starts uploading
  useEffect(() => {
    if (uploadingCount > 0 && !batchStartRef.current) {
      batchStartRef.current = new Date().toISOString()
      batchCompletedRef.current = false
    }
  }, [uploadingCount])

  // Handle batch completion
  useEffect(() => {
    if (allDone && !batchCompletedRef.current && files.length > 0) {
      batchCompletedRef.current = true

      const completedAt = new Date().toISOString()
      const startedAt = batchStartRef.current || completedAt
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
      const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime()

      // Notify admin of batch completion
      const token = useAuthStore.getState().token
      if (session && token) {
        const completedFiles = files.filter(f => f.status === 'completed')
        api.post(`/api/session/${session.id}/batch-complete`, {
          batchNumber: currentBatchNumber,
          fileCount: files.length,
          completedFiles: completedFiles.length,
          failedFiles: failedCount,
          totalBytes,
          startedAt,
          completedAt,
          fileNames: completedFiles.map(f => f.name)
        }, token).catch(() => {
          // Non-critical -- don't block batch completion
        })
      }

      // Record batch stats for the banner
      setBannerStats({
        batchNumber: currentBatchNumber,
        fileCount: files.length,
        totalBytes,
        duration,
        failedFiles: failedCount
      })

      // After a 2-second celebration, complete the batch and clear for next
      const timer = setTimeout(() => {
        completeBatch({
          fileCount: files.length,
          completedFiles: completedCount,
          failedFiles: failedCount,
          totalBytes,
          startedAt,
          completedAt
        })

        clearForNewBatch()
        batchStartRef.current = null
        setShowBanner(true)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [allDone, files, currentBatchNumber, completedCount, failedCount, completeBatch, clearForNewBatch, session])

  const handleFilesSelected = useCallback((selectedFiles: FileList | File[]) => {
    addFiles(selectedFiles)
    setShowBanner(false)
    setBannerStats(null)
  }, [addFiles])

  const handleBrowseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleStartNextBatch = useCallback(() => {
    setShowBanner(false)
    setBannerStats(null)
  }, [])

  if (!session) return null

  const hasActiveUpload = files.length > 0 && !allDone
  const showDropZone = files.length === 0 && !showBanner

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFilesSelected(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Completed Batch History */}
      <BatchHistoryStrip batches={batches} />

      {/* Batch Complete Banner (shown after batch finishes and files are cleared) */}
      {showBanner && bannerStats && (
        <BatchCompleteBanner
          batchNumber={bannerStats.batchNumber}
          fileCount={bannerStats.fileCount}
          totalBytes={bannerStats.totalBytes}
          duration={bannerStats.duration}
          failedFiles={bannerStats.failedFiles}
          onStartNextBatch={handleStartNextBatch}
        />
      )}

      {/* Drop Zone -- hero when idle */}
      {showDropZone && (
        <DropZone
          onFilesDropped={handleFilesSelected}
          onBrowseFiles={handleBrowseFiles}
          batchNumber={currentBatchNumber}
          hasCompletedBatches={batches.length > 0}
        />
      )}

      {/* Active Batch: Progress + File Queue + Controls */}
      {files.length > 0 && (
        <>
          <BatchProgress batchNumber={currentBatchNumber} />
          <FileQueue />
          <UploadControls
            onBrowseFiles={handleBrowseFiles}
          />
        </>
      )}

      {/* Tips -- only show on first batch with no files */}
      {files.length === 0 && batches.length === 0 && !showBanner && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4">Tips for uploading</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Upload any file type -- video, audio, images, documents, project files</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Large files supported -- uploads are resumable if interrupted</span>
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
              <span>Upload multiple batches throughout the day. End your session when done.</span>
            </li>
          </ul>
        </div>
      )}

      {/* End Session Card -- only when no active upload and at least one batch completed */}
      {!hasActiveUpload && batches.length > 0 && (
        <EndSessionCard />
      )}
    </div>
  )
}
