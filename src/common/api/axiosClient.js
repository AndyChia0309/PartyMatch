import axios from 'axios'
import { getApiBaseUrl } from './apiBaseUrl'

export const tokenManager = {
  get:    ()          => localStorage.getItem('pm_access_token'),
  set:    (token)     => { localStorage.setItem('pm_access_token', token); scheduleProactiveRefresh(token) },
  remove: ()          => { localStorage.removeItem('pm_access_token'); clearTimeout(_refreshTimer) },
};

let _refreshTimer = null;
const PROACTIVE_REFRESH_BUFFER_MS = 60_000

function decodeJwtExpiryMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function scheduleProactiveRefresh(token) {
  clearTimeout(_refreshTimer)
  const expiresAtMs = decodeJwtExpiryMs(token)
  if (!expiresAtMs) return
  const delay = expiresAtMs - Date.now() - PROACTIVE_REFRESH_BUFFER_MS
  if (delay <= 0)
    return;
  _refreshTimer = setTimeout(() => { refreshAccessToken().catch(() => {}) }, delay)
}

const client = axios.create({
  baseURL:         getApiBaseUrl(),
  timeout:         15_000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

client.interceptors.request.use(
  (config) => {
    const token = tokenManager.get()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
);

let _isRefreshing = false;
let _refreshQueue = []

function processQueue(error, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
  _refreshQueue = []
}

async function refreshAccessToken() {
  if (_isRefreshing) {
    return new Promise((resolve, reject) => { _refreshQueue.push({ resolve, reject }) })
  }

  _isRefreshing = true
  try {
    const { accessToken } = await axios.post(
      `${client.defaults.baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    ).then(r => r.data);
    tokenManager.set(accessToken)
    processQueue(null, accessToken)
    return accessToken
  } catch (refreshErr) {
    processQueue(refreshErr)
    tokenManager.remove()
    window.location.replace('/login')
    throw refreshErr
  } finally {
    _isRefreshing = false
  }
}

client.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const status   = error.response?.status
    const original = error.config

    if (status === 401 && !tokenManager.get()) {
      const message = error.response?.data?.message ?? error.message ?? '發生錯誤，請稍後再試'
      const rejected = new Error(message)
      rejected.response = error.response
      return Promise.reject(rejected)
    }

    if (status === 401 && tokenManager.get() && !original._retry) {
      original._retry = true
      try {
        const accessToken = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${accessToken}`
        return client(original)
      } catch (refreshErr) {
        return Promise.reject(refreshErr)
      }
    }

    const message =
      error.response?.data?.message ??
      error.message ??
      '發生錯誤，請稍後再試'

    const rejected = new Error(message)
    rejected.response = error.response
    return Promise.reject(rejected)
  },
);

scheduleProactiveRefresh(tokenManager.get());

export default client
