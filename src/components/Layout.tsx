import { ReactNode } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useSessionStore } from '../stores/sessionStore'
import { useUploadStore } from '../stores/uploadStore'
import SessionBar from './SessionBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isAuthenticated, logout } = useAuthStore()
  const { session, batches, clearSession } = useSessionStore()
  const { clearAll, files } = useUploadStore()

  const handleLogout = async () => {
    const hasActiveUploads = files.some(f => f.status === 'uploading')
    const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0)

    if (hasActiveUploads) {
      if (!confirm('You have uploads in progress. Are you sure you want to logout? Active uploads will be cancelled.')) {
        return
      }
    } else if (totalFiles > 0) {
      if (!confirm(`Logout? You've uploaded ${totalFiles} files across ${batches.length} batch${batches.length !== 1 ? 'es' : ''} today. Make sure you've ended your session first if you're done.`)) {
        return
      }
    }

    clearAll()
    clearSession()
    await logout()
  }

  const handleNewSession = () => {
    const hasActiveUploads = files.some(f => f.status === 'uploading')
    const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0)

    if (hasActiveUploads) {
      if (!confirm('You have uploads in progress. Are you sure you want to start a new session? Active uploads will be cancelled.')) {
        return
      }
    } else if (totalFiles > 0) {
      if (!confirm(`Start a new session? Current session has ${batches.length} batch${batches.length !== 1 ? 'es' : ''} with ${totalFiles} files. The team will NOT be notified unless you end the session first.`)) {
        return
      }
    }

    clearAll()
    clearSession()
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo-dark.png"
                  alt="Turbo 360"
                  className="h-10"
                />
              </div>

              {/* Session info & actions */}
              {isAuthenticated && (
                <div className="flex items-center gap-4">
                  {session && (
                    <div className="hidden sm:block">
                      <SessionBar />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {session && (
                      <button
                        onClick={handleNewSession}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        New
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Turbo 360. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
