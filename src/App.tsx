import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { useSessionStore } from './stores/sessionStore'
import LoginPage from './pages/LoginPage'
import SessionSetupPage from './pages/SessionSetupPage'
import UploadPage from './pages/UploadPage'
import Layout from './components/Layout'

function App() {
  const { isAuthenticated, checkAuth, isLoading: authLoading } = useAuthStore()
  const { session } = useSessionStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-turbo-blue"></div>
        </div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <LoginPage />
      </Layout>
    )
  }

  if (!session) {
    return (
      <Layout>
        <SessionSetupPage />
      </Layout>
    )
  }

  return (
    <Layout>
      <UploadPage />
    </Layout>
  )
}

export default App
