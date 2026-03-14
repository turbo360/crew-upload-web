import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../utils/api'

interface AuthState {
  token: string | null
  userName: string | null
  userEmail: string | null
  pinVerified: boolean
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  verifyPin: (pin: string) => Promise<boolean>
  login: (name: string, email: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userName: null,
      userEmail: null,
      pinVerified: false,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      verifyPin: async (pin: string) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/api/auth/pin', { pin })
          set({ pinVerified: true, isLoading: false })
          return true
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Invalid PIN'
          set({ error: message, isLoading: false })
          return false
        }
      },

      login: async (name: string, email: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await api.post('/api/auth/login', { name, email })

          if (response.success && response.token) {
            set({
              token: response.token,
              userName: name.trim(),
              userEmail: email.trim().toLowerCase(),
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
          userName: null,
          userEmail: null,
          pinVerified: false,
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
              userName: null,
              userEmail: null,
              isAuthenticated: false,
              isLoading: false
            })
          }
        } catch {
          set({
            token: null,
            userName: null,
            userEmail: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'crew-upload-auth',
      partialize: (state) => ({
        token: state.token,
        userName: state.userName,
        userEmail: state.userEmail,
        pinVerified: state.pinVerified
      })
    }
  )
)
