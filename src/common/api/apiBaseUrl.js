function resolveDefaultApiBaseUrl() {
  if (window.location.protocol === 'http:') {
    return `http://${window.location.hostname}:3001/api`
  }
  return '/api'
}

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? resolveDefaultApiBaseUrl()
}
