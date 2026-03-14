import { useState, useEffect, useRef, FormEvent, KeyboardEvent, ClipboardEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useSessionStore } from '../stores/sessionStore'

function PinScreen() {
  const { verifyPin, isLoading, error, clearError } = useAuthStore()
  const [digits, setDigits] = useState(['', '', '', ''])
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    inputRefs[0].current?.focus()
  }, [])

  const pin = digits.join('')
  const isValid = pin.length === 4

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)
    if (error) clearError()

    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      setDigits(newDigits)
      inputRefs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4)
    if (pasted.length > 0) {
      const newDigits = ['', '', '', '']
      pasted.split('').forEach((ch, i) => { newDigits[i] = ch })
      setDigits(newDigits)
      const focusIdx = Math.min(pasted.length, 3)
      inputRefs[focusIdx].current?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid || isLoading) return

    const success = await verifyPin(pin)
    if (!success) {
      setDigits(['', '', '', ''])
      inputRefs[0].current?.focus()
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-turbo-blue/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-turbo-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Enter Access PIN</h2>
            <p className="text-gray-400 mt-2">Enter the PIN provided by your event coordinator</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => updateDigit(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  className={`w-14 h-16 text-center text-2xl font-bold bg-gray-800/80 border-2 rounded-xl text-white outline-none transition-all ${
                    digit
                      ? 'border-turbo-blue'
                      : 'border-gray-600'
                  } focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20`}
                  autoComplete="off"
                  disabled={isLoading}
                />
              ))}
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="w-full py-3 px-4 bg-turbo-blue hover:bg-turbo-blue-dark disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function DetailsScreen() {
  const { login, isAuthenticated, userName, userEmail, isLoading: authLoading, error: authError, clearError: clearAuthError } = useAuthStore()
  const { createSession, isLoading: sessionLoading, error: sessionError, clearError: clearSessionError } = useSessionStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [projectName, setProjectName] = useState('')

  const projectRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Pre-fill name + email if returning user (authenticated but no session)
  useEffect(() => {
    if (isAuthenticated && userName) {
      setName(userName)
    }
    if (isAuthenticated && userEmail) {
      setEmail(userEmail)
    }
  }, [isAuthenticated, userName, userEmail])

  // Auto-focus: project field if returning user, name field if new
  useEffect(() => {
    if (isAuthenticated && userName) {
      projectRef.current?.focus()
    } else {
      nameRef.current?.focus()
    }
  }, [isAuthenticated, userName])

  const isLoading = authLoading || sessionLoading
  const error = authError || sessionError

  const clearError = () => {
    clearAuthError()
    clearSessionError()
  }

  const isValid = name.trim().length > 0 && email.trim().length > 0 && projectName.trim().length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid || isLoading) return

    // Step 1: Login (get JWT) if not already authenticated
    if (!isAuthenticated) {
      const loginSuccess = await login(name.trim(), email.trim())
      if (!loginSuccess) return
    }

    // Step 2: Create session (crewName = name)
    await createSession(name.trim(), projectName.trim())
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo-dark.png"
              alt="Turbo 360"
              className="h-16 mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-white">Crew Upload Portal</h2>
            <p className="text-gray-400 mt-2">Enter your details to start uploading</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Start form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20 transition-all"
                  placeholder="e.g., John Smith"
                  disabled={isLoading}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20 transition-all"
                  placeholder="e.g., john@example.com"
                  disabled={isLoading}
                />
              </div>

              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  ref={projectRef}
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-turbo-blue focus:ring-2 focus:ring-turbo-blue/20 transition-all"
                  placeholder="e.g., Toyota Campaign 2024"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="mt-6 w-full py-3 px-4 bg-turbo-blue hover:bg-turbo-blue-dark disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  Start Uploading
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function StartPage() {
  const { pinVerified } = useAuthStore()

  if (!pinVerified) {
    return <PinScreen />
  }

  return <DetailsScreen />
}
