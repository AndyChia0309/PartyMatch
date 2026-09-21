import { daysUntil } from './date'
import { isHistoryGroup } from './groupStatusDisplay'

export function getHostGroupFlags(status, nextBillingDate) {
  return {
    isRecruiting: ['recruiting', 'replacement_recruiting', 'full'].includes(status),
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
    group.status === 'info_overdue' ||
    group.status === 'activation_overdue' ||
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
  if (status === 'info_overdue') return { variant: 'info_overdue', label: '帳號處理中' }
  if (status === 'activation_overdue') return { variant: 'activation_overdue', label: '啟用逾期' }
  return undefined
}

export function getHostPendingBadge(status, needsCredentialsOnLock, hasServiceIssue) {
  if (hasServiceIssue && status === 'pending_confirmation') return { text: '問題處理中', color: 'danger' }
  if (status === 'pending_confirmation') return { text: needsCredentialsOnLock ? '成員提取中' : '成員填寫中' }
  if (status === 'info_overdue') return { text: '帳號資訊填寫期限已到，請延長或聯絡客服', color: 'danger' }
  if (status === 'activation_overdue') return { text: '逾期未啟用，請盡快啟用服務', color: 'danger' }
  if (status === 'disputed') return { text: '請至帳號資訊查看回報問題內容', color: 'danger' }
  return undefined
}

export function getHostGroupStatusLabel(status, hasServiceIssue) {
  if (isHistoryGroup({ status })) return '已結束'
  if (status === 'recruiting') return '招募中'
  if (status === 'replacement_recruiting') return '補位中'
  if (status === 'full') return '已滿員'
  if (hasServiceIssue && status === 'pending_confirmation') return '問題處理中'
  if (status === 'pending_confirmation') return '成員填寫中'
  if (status === 'info_overdue') return '帳號處理中'
  if (status === 'pending_activation') return '待啟用服務'
  if (status === 'activation_overdue') return '啟用逾期'
  if (status === 'confirming') return '確認期中'
  if (status === 'disputed') return '問題處理中'
  if (status === 'active') return '服務中'
  return '正常'
}
