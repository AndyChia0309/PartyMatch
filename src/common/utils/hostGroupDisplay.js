import { daysUntil } from './date'
import { isHistoryGroup } from './groupStatusDisplay'

export function getHostGroupFlags(status, nextBillingDate) {
  return {
    isRecruiting: ['recruiting', 'full'].includes(status),
    isCancelled: status === 'cancelled',
    hasBeenActive: ['active', 'ended'].includes(status),
    showRenewal: status === 'active' && !!nextBillingDate && daysUntil(nextBillingDate) <= 7,
  }
}

export function hostGroupNeedsAttention(group, { pendingAppCount = 0, hasUnseenServiceInfo = false, hasUnseenCredentialComment = false } = {}) {
  if (!group) return false
  const { showRenewal } = getHostGroupFlags(group.status, group.nextBillingDate)
  return group.status === 'full' ||
    group.status === 'pending_activation' ||
    group.status === 'disputed' ||
    showRenewal ||
    pendingAppCount > 0 ||
    hasUnseenServiceInfo ||
    hasUnseenCredentialComment
}

export function getHostStatusBadge(status, needsCredentialsOnLock, hasServiceIssue) {
  if (hasServiceIssue && status === 'pending_confirmation') return { variant: 'disputed', label: '問題處理中' }
  if (status === 'full') return { variant: 'full', label: '等待鎖定' }
  if (status === 'pending_confirmation' && needsCredentialsOnLock) return { variant: 'pending_confirmation', label: '成員提取中' }
  return undefined
}

export function getHostPendingBadge(status, needsCredentialsOnLock, hasServiceIssue) {
  if (hasServiceIssue && status === 'pending_confirmation') return { text: '問題處理中', color: 'danger' }
  if (status === 'pending_confirmation') return { text: needsCredentialsOnLock ? '成員提取中' : '成員填寫中' }
  if (status === 'disputed') return { text: '請至帳號資訊查看問題回報內容', color: 'danger' }
  return undefined
}

export function getHostGroupStatusLabel(status, hasServiceIssue) {
  if (isHistoryGroup({ status })) return '已結束'
  if (status === 'recruiting') return '招募中'
  if (status === 'full') return '已滿員'
  if (hasServiceIssue && status === 'pending_confirmation') return '問題處理中'
  if (status === 'pending_confirmation') return '處理中'
  if (status === 'pending_activation') return '待啟用服務'
  if (status === 'confirming') return '確認期中'
  if (status === 'disputed') return '問題處理中'
  if (status === 'active') return '服務中'
  return '正常'
}
