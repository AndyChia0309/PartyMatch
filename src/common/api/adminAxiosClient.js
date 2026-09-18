import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl'

export const adminTokenManager = {
  get:    ()          => localStorage.getItem('pm_admin_access_token'),
  set:    (token)     => { localStorage.setItem('pm_admin_access_token', token); scheduleProactiveRefresh(token) },
  remove: ()          => { localStorage.removeItem('pm_admin_access_token'); clearTimeout(_refreshTimer) },
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
  _refreshTimer = setTimeout(() => { refreshAdminAccessToken().catch(() => {}) }, delay)
}

const adminClient = axios.create({
  baseURL:         getApiBaseUrl(),
  timeout:         15_000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

adminClient.interceptors.request.use(
  (config) => {
    const token = adminTokenManager.get()
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

async function refreshAdminAccessToken() {
  if (_isRefreshing) {
    return new Promise((resolve, reject) => { _refreshQueue.push({ resolve, reject }) })
  }

  _isRefreshing = true
  try {
    const { accessToken } = await axios.post(
      `${adminClient.defaults.baseURL}/admin/auth/refresh`,
      {},
      { withCredentials: true },
    ).then(r => r.data);
    adminTokenManager.set(accessToken)
    processQueue(null, accessToken)
    return accessToken
  } catch (refreshErr) {
    processQueue(refreshErr)
    adminTokenManager.remove()
    window.location.replace('/admin/login')
    throw refreshErr
  } finally {
    _isRefreshing = false
  }
}

adminClient.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const status   = error.response?.status
    const original = error.config

    if (status === 401 && !adminTokenManager.get()) {
      const message = error.response?.data?.message ?? error.message ?? '發生錯誤，請稍後再試'
      const rejected = new Error(message)
      rejected.response = error.response
      return Promise.reject(rejected)
    }

    if (status === 401 && adminTokenManager.get() && !original._retry) {
      original._retry = true
      try {
        const accessToken = await refreshAdminAccessToken()
        original.headers.Authorization = `Bearer ${accessToken}`
        return adminClient(original)
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

scheduleProactiveRefresh(adminTokenManager.get());

export default adminClient
