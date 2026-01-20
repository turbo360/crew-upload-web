import { create } from 'zustand'
import * as tus from 'tus-js-client'
import { api } from '../utils/api'
import { useAuthStore } from './authStore'
import { useSessionStore } from './sessionStore'

export type UploadStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'failed'

export interface UploadFile {
  id: string
  file: File
  filename: string
  originalPath: string
  size: number
  mimeType: string
  status: UploadStatus
  progress: number
  bytesUploaded: number
  speed: number
  error: string | null
  tusUpload: tus.Upload | null
  dbId: string | null
}

interface UploadState {
  files: UploadFile[]
  isUploading: boolean
  isPaused: boolean
  concurrentUploads: number

  addFiles: (files: FileList | File[]) => void
  removeFile: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void

  startUpload: () => void
  pauseAll: () => void
  resumeAll: () => void
  retryFailed: () => void
  retryFile: (id: string) => void
  cancelFile: (id: string) => void

  updateFileProgress: (id: string, progress: number, bytesUploaded: number, speed: number) => void
  updateFileStatus: (id: string, status: UploadStatus, error?: string) => void
}

const MAX_CONCURRENT = 3
const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB

export const useUploadStore = create<UploadState>((set, get) => ({
  files: [],
  isUploading: false,
  isPaused: false,
  concurrentUploads: 0,

  addFiles: (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const newFiles: UploadFile[] = files.map(file => {
      // Handle webkitRelativePath for folder uploads
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''

      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        file,
        filename: file.name,
        originalPath: relativePath,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: 'queued',
        progress: 0,
        bytesUploaded: 0,
        speed: 0,
        error: null,
        tusUpload: null,
        dbId: null
      }
    })

    set(state => ({
      files: [...state.files, ...newFiles]
    }))
  },

  removeFile: (id: string) => {
    const file = get().files.find(f => f.id === id)
    if (file?.tusUpload) {
      file.tusUpload.abort()
    }

    set(state => ({
      files: state.files.filter(f => f.id !== id),
      concurrentUploads: file?.status === 'uploading'
        ? state.concurrentUploads - 1
        : state.concurrentUploads
    }))
  },

  clearCompleted: () => {
    set(state => ({
      files: state.files.filter(f => f.status !== 'completed')
    }))
  },

  clearAll: () => {
    const { files } = get()
    files.forEach(file => {
      if (file.tusUpload) {
        file.tusUpload.abort()
      }
    })

    set({
      files: [],
      isUploading: false,
      isPaused: false,
      concurrentUploads: 0
    })
  },

  startUpload: () => {
    set({ isUploading: true, isPaused: false })
    processQueue()
  },

  pauseAll: () => {
    const { files } = get()

    files.forEach(file => {
      if (file.status === 'uploading' && file.tusUpload) {
        file.tusUpload.abort()
      }
    })

    set(state => ({
      isPaused: true,
      files: state.files.map(f =>
        f.status === 'uploading' ? { ...f, status: 'paused' as UploadStatus } : f
      ),
      concurrentUploads: 0
    }))
  },

  resumeAll: () => {
    set(state => ({
      isPaused: false,
      files: state.files.map(f =>
        f.status === 'paused' ? { ...f, status: 'queued' as UploadStatus } : f
      )
    }))
    processQueue()
  },

  retryFailed: () => {
    set(state => ({
      files: state.files.map(f =>
        f.status === 'failed'
          ? { ...f, status: 'queued' as UploadStatus, error: null, progress: 0 }
          : f
      )
    }))
    processQueue()
  },

  retryFile: (id: string) => {
    set(state => ({
      files: state.files.map(f =>
        f.id === id
          ? { ...f, status: 'queued' as UploadStatus, error: null, progress: 0 }
          : f
      )
    }))
    processQueue()
  },

  cancelFile: (id: string) => {
    const file = get().files.find(f => f.id === id)
    if (file?.tusUpload) {
      file.tusUpload.abort()
    }

    set(state => ({
      files: state.files.map(f =>
        f.id === id ? { ...f, status: 'queued' as UploadStatus, tusUpload: null } : f
      ),
      concurrentUploads: file?.status === 'uploading'
        ? state.concurrentUploads - 1
        : state.concurrentUploads
    }))
  },

  updateFileProgress: (id: string, progress: number, bytesUploaded: number, speed: number) => {
    set(state => ({
      files: state.files.map(f =>
        f.id === id ? { ...f, progress, bytesUploaded, speed } : f
      )
    }))
  },

  updateFileStatus: (id: string, status: UploadStatus, error?: string) => {
    set(state => {
      const file = state.files.find(f => f.id === id)
      const wasUploading = file?.status === 'uploading'
      const isNowUploading = status === 'uploading'

      let concurrentUploads = state.concurrentUploads
      if (wasUploading && !isNowUploading) {
        concurrentUploads--
      } else if (!wasUploading && isNowUploading) {
        concurrentUploads++
      }

      return {
        files: state.files.map(f =>
          f.id === id
            ? {
                ...f,
                status,
                error: error || null,
                progress: status === 'completed' ? 100 : f.progress
              }
            : f
        ),
        concurrentUploads
      }
    })

    // Process next in queue after completion or failure
    if (status === 'completed' || status === 'failed') {
      setTimeout(processQueue, 100)
    }
  }
}))

async function processQueue() {
  const state = useUploadStore.getState()

  if (state.isPaused) return

  const { files, concurrentUploads } = state
  const session = useSessionStore.getState().session
  const token = useAuthStore.getState().token

  if (!session || !token) return

  const availableSlots = MAX_CONCURRENT - concurrentUploads
  const queuedFiles = files.filter(f => f.status === 'queued')

  for (let i = 0; i < Math.min(availableSlots, queuedFiles.length); i++) {
    const file = queuedFiles[i]
    startFileUpload(file, session.id, token)
  }

  // Check if all done
  const allDone = files.every(f =>
    f.status === 'completed' || f.status === 'failed' || f.status === 'queued'
  )

  if (allDone && queuedFiles.length === 0 && files.length > 0) {
    useUploadStore.setState({ isUploading: false })

    // Refresh session to get updated stats
    useSessionStore.getState().refreshSession()
  }
}

async function startFileUpload(uploadFile: UploadFile, sessionId: string, token: string) {
  const { updateFileStatus, updateFileProgress } = useUploadStore.getState()

  updateFileStatus(uploadFile.id, 'uploading')

  let lastLoaded = 0
  let lastTime = Date.now()

  try {
    // Register upload with backend
    const response = await api.post(
      `/api/session/${sessionId}/upload`,
      {
        filename: uploadFile.filename,
        originalPath: uploadFile.originalPath,
        fileSize: uploadFile.size,
        mimeType: uploadFile.mimeType
      },
      token
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to register upload')
    }

    const dbId = response.upload.id

    // Update file with db ID
    useUploadStore.setState(state => ({
      files: state.files.map(f =>
        f.id === uploadFile.id ? { ...f, dbId } : f
      )
    }))

    // Create tus upload
    const upload = new tus.Upload(uploadFile.file, {
      endpoint: '/files',
      retryDelays: [0, 1000, 3000, 5000, 10000],
      chunkSize: CHUNK_SIZE,
      metadata: {
        filename: uploadFile.filename,
        filetype: uploadFile.mimeType,
        sessionId: sessionId,
        uploadId: dbId,
        originalPath: uploadFile.originalPath
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      onError: (error) => {
        console.error('Upload error:', error)
        updateFileStatus(uploadFile.id, 'failed', error.message)

        // Update backend
        api.patch(
          `/api/session/${sessionId}/upload/${dbId}`,
          { status: 'failed', errorMessage: error.message },
          token
        ).catch(() => {})
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const progress = Math.round((bytesUploaded / bytesTotal) * 100)

        // Calculate speed
        const now = Date.now()
        const timeDiff = (now - lastTime) / 1000 // seconds
        const bytesDiff = bytesUploaded - lastLoaded
        const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0

        lastLoaded = bytesUploaded
        lastTime = now

        updateFileProgress(uploadFile.id, progress, bytesUploaded, speed)
      },
      onSuccess: () => {
        updateFileStatus(uploadFile.id, 'completed')
      }
    })

    // Store tus upload reference
    useUploadStore.setState(state => ({
      files: state.files.map(f =>
        f.id === uploadFile.id ? { ...f, tusUpload: upload } : f
      )
    }))

    // Check for previous upload to resume
    const previousUploads = await upload.findPreviousUploads()
    if (previousUploads.length > 0) {
      upload.resumeFromPreviousUpload(previousUploads[0])
    }

    // Start upload
    upload.start()

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    updateFileStatus(uploadFile.id, 'failed', message)
  }
}
