import { canReportServiceIssue } from './groupStatus'

export function getMemberJoinedBadgeVariant(status, isMember) {
  return isMember && status === 'recruiting' ? 'member_joined' : undefined
}

export function getGroupFooterAction({ activeUserId, isHost, isWaitingMembers, needsFillInfo, isMember, isFull }) {
  if (!activeUserId) return 'login'
  if (isHost) return 'host'
  if (isWaitingMembers) return 'waiting'
  if (needsFillInfo) return 'fillInfo'
  if (isMember) return 'member'
  if (isFull) return 'full'
  return null
}

export function getSubscriptionBillingDisplay(rawStatus) {
  const isPreBillingLock = canReportServiceIssue(rawStatus)
  const showsBillingDate = isPreBillingLock || ['confirming', 'disputed', 'active'].includes(rawStatus)
  return { isPreBillingLock, showsBillingDate }
}

export function getMemberGroupFlags({ status, sub, myMember, hasServiceInfo, hasServiceInfoIssue, hasGroupServiceInfoIssue = false }) {
  const isPaymentRelevant = !['recruiting', 'replacement_recruiting', 'full', 'cancelled'].includes(status)
  const isDisputed = status === 'disputed'
  const isDisputeRaiser = isDisputed && !!myMember?.serviceInfoIssueNote
  const isDisputeEscalated = isDisputeRaiser && !!myMember?.disputeEscalatedAt;
  const isConfirmingLike = status === 'confirming' || (isDisputed && !isDisputeRaiser);
  const isInfoOverdue = status === 'info_overdue'
  const isActivationOverdue = status === 'activation_overdue'
  const needsFillInfo = !!sub && isPaymentRelevant && !hasServiceInfo && (status === 'pending_confirmation' || isInfoOverdue)
  const waitingForOthers = !!sub && hasServiceInfo && status === 'pending_confirmation'
  const waitingForActivation = !!sub && (status === 'pending_activation' || isActivationOverdue)
  const canConfirm = isConfirmingLike && !!myMember && !myMember.confirmedAt
  const alreadyConfirmed = isConfirmingLike && !!myMember?.confirmedAt

  return {
    isPaymentRelevant,
    showMessagesButton: isPaymentRelevant && status !== 'ended',
    needsFillInfo,
    waitingForOthers,
    waitingForActivation,
    canConfirm,
    alreadyConfirmed,
    isDisputed,
    isDisputeRaiser,
    isDisputeEscalated,
    isInfoOverdue,
    isActivationOverdue,
    canLeaveGroup: ['recruiting', 'full'].includes(status) && !!myMember,
    showReviewHostButton: ['active', 'ended'].includes(status),
    hasServiceInfoIssue,
    hasGroupServiceInfoIssue,
  }
}

export const DISPUTED_BANNER_TEXT = '回報問題處理中'
export const DISPUTE_ESCALATED_BANNER_TEXT = '客服處理中'

export function formatDisputeReason(issueNote) {
  if (!issueNote) return { types: '', detail: '' }
  const idx = issueNote.indexOf('\n')
  if (idx === -1) return { types: issueNote, detail: '' }
  return { types: issueNote.slice(0, idx), detail: issueNote.slice(idx + 1) }
}

export function getMemberGroupBadges({ status, sub, isSharedCredentials, flags }) {
  const { hasServiceInfoIssue, hasGroupServiceInfoIssue, needsFillInfo, waitingForOthers, waitingForActivation, canConfirm, isDisputed, isDisputeRaiser, isDisputeEscalated, alreadyConfirmed, isInfoOverdue, isActivationOverdue } = flags

  const statusBadgeOverride =
    hasServiceInfoIssue && status === 'pending_confirmation' ? { variant: 'disputed', label: '問題處理中' } :
    isInfoOverdue ? { variant: 'info_overdue', label: '帳號處理中' } :
    isActivationOverdue ? { variant: 'activation_overdue', label: '啟用逾期' } :
    alreadyConfirmed ? { variant: 'active' } :
    canConfirm && isDisputed ? 'confirming' :
    waitingForOthers && hasGroupServiceInfoIssue ? { variant: 'pending_activation', label: '待啟用服務' } :
    waitingForOthers ? { variant: 'active', label: isSharedCredentials ? '已提取完成' : '已填寫完成' } :
    waitingForActivation ? { variant: 'pending_activation', label: '待啟用服務' } :
    (status === 'recruiting' || status === 'replacement_recruiting') && !!sub ? 'member_joined' :
    status === 'full' ? { variant: 'full', label: '等待鎖定' } :
    status === 'pending_confirmation' ? { variant: 'pending_confirmation', label: isSharedCredentials ? '帳號提取中' : '資料填寫中' } :
    undefined

  const pendingBadge =
    hasServiceInfoIssue ? '帳號資訊有問題' :
    isInfoOverdue        ? '帳號資訊填寫已逾期，請盡快處理' :
    needsFillInfo       ? (isSharedCredentials ? '請提取帳號資訊' : '請填寫帳號資訊以完成加入流程') :
    waitingForOthers && hasGroupServiceInfoIssue ? '請等候團主啟用服務' :
    waitingForOthers    ? '已填寫完成' :
    isActivationOverdue  ? '團主逾期未啟用，可確認可用或回報問題' :
    waitingForActivation ? '請等候團主啟用服務' :
    canConfirm           ? '確認期進行中，請確認服務' :
    isDisputeEscalated    ? DISPUTE_ESCALATED_BANNER_TEXT :
    isDisputeRaiser      ? DISPUTED_BANNER_TEXT :
    status === 'full' && !!sub ? '請等待團主確認名單並鎖定群組' :
    (status === 'recruiting' || status === 'replacement_recruiting') && !!sub ? '已通過申請，需等待其他人加入' :
    undefined

  const pendingBadgeColor =
    (status === 'full' && !!sub) ? 'gray' :
    ((status === 'recruiting' || status === 'replacement_recruiting') && !!sub) ? 'success' :
    hasServiceInfoIssue ? 'danger' :
    isInfoOverdue ? 'danger' :
    isActivationOverdue ? 'danger' :
    waitingForOthers ? (hasGroupServiceInfoIssue ? 'warning' : 'success') :
    waitingForActivation ? 'warning' :
    canConfirm ? 'brand' :
    isDisputeRaiser ? 'danger' :
    undefined

  return { statusBadgeOverride, pendingBadge, pendingBadgeColor }
}
