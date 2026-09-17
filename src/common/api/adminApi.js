import adminClient from './adminAxiosClient'

export async function adminLogin({ email, password }) {
  return adminClient.post('/admin/auth/login', { email, password })
}

export async function adminLogout() {
  return adminClient.post('/admin/auth/logout')
}

export async function fetchAdminMe() {
  return adminClient.get('/admin/auth/me')
}

export async function fetchAdminStats() {
  return adminClient.get('/admin/stats')
}

export async function fetchAdminDisputes(params = {}) {
  return adminClient.get('/admin/disputes', { params })
}

export async function fetchAdminDisputeDetail(disputeId) {
  return adminClient.get(`/admin/disputes/${disputeId}`)
}

export async function fetchAdminDisputeHistory(params = {}) {
  return adminClient.get('/admin/disputes/history', { params })
}

export async function adjudicateDisputeApi(groupId, { memberId, winner, reason }) {
  return adminClient.post(`/groups/${groupId}/adjudicate`, { memberId, winner, reason })
}

export async function fetchAdminPlatformReports(params = {}) {
  return adminClient.get('/admin/platform-reports', { params })
}

export async function resolvePlatformReportApi(reportId, { resolutionNote, nextBillingDate } = {}) {
  return adminClient.post(`/admin/platform-reports/${reportId}/resolve`, { resolutionNote, nextBillingDate })
}

export async function searchUserByEmail(email) {
  return adminClient.get('/users', { params: { email } })
}

export async function reactivateUserApi(userId) {
  return adminClient.post(`/users/${userId}/reactivate`)
}
