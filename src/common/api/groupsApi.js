import client from './axiosClient'

export async function readAllGroups(params = {}) {
  return client.get('/groups', { params })
}

export async function insertGroup(data) {
  return client.post('/groups', data)
}

export async function fetchGroupById(id) {
  return client.get(`/groups/${id}`)
}

export async function patchGroup(id, patch) {
  return client.patch(`/groups/${id}`, patch)
}

export async function lockGroupApi(id, sharedCredentials) {
  return client.post(`/groups/${id}/lock`, sharedCredentials ? { sharedCredentials } : undefined)
}

export async function activateGroupApi(id, nextBillingDate) {
  return client.post(`/groups/${id}/activate`, nextBillingDate ? { nextBillingDate } : undefined)
}

export async function confirmGroupApi(id) {
  return client.post(`/groups/${id}/confirm`)
}

export async function adjustBillingDateApi(id, { nextBillingDate, note }) {
  return client.patch(`/groups/${id}/billing-date`, { nextBillingDate, note })
}

export async function cancelGroupApi(id) {
  return client.post(`/groups/${id}/cancel`)
}

export async function reportServiceInfoIssueApi(id, { memberId, note, evidenceUrl }) {
  return client.post(`/groups/${id}/service-info-issue`, { memberId, note, evidenceUrl })
}

export async function withdrawServiceInfoIssueApi(id, memberId) {
  return client.post(`/groups/${id}/service-info-issue/withdraw`, { memberId })
}

export async function disputeGroupApi(id, { reason, evidenceUrl }) {
  return client.post(`/groups/${id}/dispute`, { reason, evidenceUrl })
}

export async function withdrawDisputeApi(id) {
  return client.post(`/groups/${id}/dispute/withdraw`)
}

export async function resolveDisputeApi(id, { memberId, note } = {}) {
  return client.post(`/groups/${id}/resolve-dispute`, { memberId, note })
}

export async function escalateDisputeApi(id, { memberId, note }) {
  return client.post(`/groups/${id}/escalate-dispute`, { memberId, note })
}

export async function renewGroupApi(id, renewingUserIds) {
  return client.post(`/groups/${id}/renew`, { renewingUserIds })
}

export async function fetchGroupTransactions(id) {
  return client.get(`/groups/${id}/transactions`)
}
