import { useCallback, useState, DragEvent } from 'react'

interface DropZoneProps {
  onFilesDropped: (files: FileList | File[]) => void
  onBrowseFiles: () => void
  onBrowseFolders: () => void
}

export default function DropZone({ onFilesDropped, onBrowseFiles, onBrowseFolders }: DropZoneProps) {
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
          {isDragging ? 'Drop files here' : 'Drag and drop files here'}
        </p>
        <p className="text-gray-400 mb-6">or use the buttons below to browse</p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onBrowseFiles}
            className="px-6 py-2.5 bg-turbo-blue hover:bg-turbo-blue-dark text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Browse Files
          </button>
          <button
            onClick={onBrowseFolders}
            className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Browse Folder
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
