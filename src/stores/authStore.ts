import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../utils/api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (password: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await api.post('/api/auth/login', { password })

          if (response.success && response.token) {
            set({
              token: response.token,
              isAuthenticated: true,
              isLoading: false
            })
            return true
          }

          set({
            error: response.error || 'Login failed',
            isLoading: false
          })
          return false

        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Login failed'
          set({
            error: message,
            isLoading: false
          })
          return false
        }
      },

      logout: async () => {
        const { token } = get()

        if (token) {
          try {
            await api.post('/api/auth/logout', {}, token)
          } catch {
            // Ignore logout errors
          }
        }

        set({
          token: null,
          isAuthenticated: false,
          error: null
        })
      },

      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isAuthenticated: false, isLoading: false })
          return
        }

        set({ isLoading: true })

        try {
          const response = await api.get('/api/auth/check', token)

          if (response.valid) {
            set({ isAuthenticated: true, isLoading: false })
          } else {
            set({
              token: null,
              isAuthenticated: false,
              isLoading: false
            })
          }
        } catch {
          set({
            token: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'crew-upload-auth',
      partialize: (state) => ({ token: state.token })
    }
  )
)
