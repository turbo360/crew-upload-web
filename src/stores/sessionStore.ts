import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../utils/api'
import { useAuthStore } from './authStore'

interface Session {
  id: string
  crewName: string
  projectName: string
  folderPath: string
  createdAt: string
  completedAt: string | null
  status: string
  totalFiles: number
  totalBytes: number
  uploadedFiles: number
  uploadedBytes: number
  failedFiles: number
}

interface SessionState {
  session: Session | null
  isLoading: boolean
  error: string | null
  createSession: (crewName: string, projectName: string) => Promise<boolean>
  refreshSession: () => Promise<void>
  markComplete: () => Promise<void>
  clearSession: () => void
  clearError: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      error: null,

      createSession: async (crewName: string, projectName: string) => {
        const token = useAuthStore.getState().token

        if (!token) {
          set({ error: 'Not authenticated' })
          return false
        }

        set({ isLoading: true, error: null })

        try {
          const response = await api.post(
            '/api/session/create',
            { crewName, projectName },
            token
          )

          if (response.success && response.session) {
            set({
              session: response.session,
              isLoading: false
            })
            return true
          }

          set({
            error: response.error || 'Failed to create session',
            isLoading: false
          })
          return false

        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to create session'
          set({
            error: message,
            isLoading: false
          })
          return false
        }
      },

      refreshSession: async () => {
        const { session } = get()
        const token = useAuthStore.getState().token

        if (!session || !token) return

        try {
          const response = await api.get(`/api/session/${session.id}`, token)

          if (response.session) {
            set({ session: response.session })
          }
        } catch {
          // Ignore refresh errors
        }
      },

      markComplete: async () => {
        const { session } = get()
        const token = useAuthStore.getState().token

        if (!session || !token) return

        try {
          await api.patch(
            `/api/session/${session.id}`,
            { status: 'completed' },
            token
          )

          set({
            session: { ...session, status: 'completed' }
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to complete session'
          set({ error: message })
        }
      },

      clearSession: () => set({ session: null, error: null }),

      clearError: () => set({ error: null })
    }),
    {
      name: 'crew-upload-session',
      partialize: (state) => ({ session: state.session })
    }
  )
)
