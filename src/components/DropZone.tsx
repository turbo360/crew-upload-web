import { useCallback, useState, DragEvent } from 'react'

interface DropZoneProps {
  onFilesDropped: (files: FileList | File[]) => void
  onBrowseFiles: () => void
  batchNumber?: number
  hasCompletedBatches?: boolean
}

export default function DropZone({ onFilesDropped, onBrowseFiles, batchNumber = 1, hasCompletedBatches = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const { files } = e.dataTransfer
    if (files && files.length > 0) {
      onFilesDropped(files)
    }
  }, [onFilesDropped])

  const headingText = isDragging
    ? 'Drop files here'
    : hasCompletedBatches
      ? 'Ready for more files?'
      : 'Drag and drop files here'

  const subText = isDragging
    ? ''
    : hasCompletedBatches
      ? `Drag and drop to start Batch ${batchNumber}`
      : 'or use the buttons below to browse'

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-12 transition-all duration-200
        ${isDragging
          ? 'border-turbo-blue bg-turbo-blue/10 scale-[1.01]'
          : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
        }
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="text-center">
        {/* Icon */}
        <div className={`
          inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 transition-all
          ${isDragging ? 'bg-turbo-blue/20 text-turbo-blue scale-110' : 'bg-gray-700 text-gray-400'}
        `}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        {/* Text */}
        <p className={`text-lg font-medium mb-2 transition-colors ${isDragging ? 'text-turbo-blue' : 'text-white'}`}>
          {headingText}
        </p>
        {subText && <p className="text-gray-400 mb-6">{subText}</p>}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onBrowseFiles}
            className="px-6 py-2.5 bg-turbo-blue hover:bg-turbo-blue-dark text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Select Files
          </button>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-turbo-blue/5 rounded-xl pointer-events-none" />
      )}
    </div>
  )
}
