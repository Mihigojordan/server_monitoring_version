const BASE = ''

function getToken() {
  return localStorage.getItem('vsdc_token')
}

export async function apiFetch(path, { method = 'GET', body, headers: extra } = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extra,
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body != null && { body: JSON.stringify(body) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(
      new Error(data?.message || data?.resultMsg || data?.errors?.[0]?.message || res.statusText),
      { status: res.status, data }
    )
  }
  return data
}

// Multipart upload — FormData bodies must NOT get a JSON Content-Type
// (the browser sets its own multipart boundary), so this bypasses apiFetch.
export async function apiUpload(path, formData) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(
      new Error(data?.message || data?.resultMsg || data?.errors?.[0]?.message || res.statusText),
      { status: res.status, data }
    )
  }
  return data
}

// File download — reads the response as a Blob and triggers a browser
// save-as using the server's Content-Disposition filename.
export async function apiDownload(path) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error(data?.message || data?.resultMsg || res.statusText),
      { status: res.status, data }
    )
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : 'download'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
  upload: (path, formData) => apiUpload(path, formData),
  download: (path) => apiDownload(path),
}
