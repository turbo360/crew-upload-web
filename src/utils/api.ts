const API_BASE = ''

interface ApiResponse {
  success?: boolean
  error?: string
  [key: string]: unknown
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`)
  }

  return data
}

export const api = {
  get: (path: string, token?: string) => request('GET', path, undefined, token),
  post: (path: string, body: unknown, token?: string) => request('POST', path, body, token),
  patch: (path: string, body: unknown, token?: string) => request('PATCH', path, body, token),
  delete: (path: string, token?: string) => request('DELETE', path, undefined, token)
}
