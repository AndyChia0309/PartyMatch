import { isEffectivelyActive, canReportServiceIssue } from './groupStatus'
import { hasFilledServiceInfo, isSharedCredentialsMethod } from './serviceInfoFields'

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

export function getSubscriptionBadgeStatus(sub) {
  const status = sub.groupStatus ?? sub.status;
  const effectiveStatus = status === 'disputed' && !sub.serviceInfoIssueNote ? 'confirming' : status;
  return isEffectivelyActive(effectiveStatus, sub.confirmedAt) ? 'active' : effectiveStatus
}

export function getSubscriptionBillingDisplay(rawStatus) {
  const isPreBillingLock = canReportServiceIssue(rawStatus)
  const showsBillingDate = isPreBillingLock || rawStatus === 'confirming' || rawStatus === 'disputed'
  return { isPreBillingLock, showsBillingDate }
}

export function getSubscriptionCardBadge(sub, { sharingMethod, displayStatus }) {
  const isSharedCredentials = isSharedCredentialsMethod(sharingMethod)
  const waitingForOthers = displayStatus === 'pending_confirmation' &&
    hasFilledServiceInfo(sub.serviceInfo, sharingMethod) && !sub.serviceInfoIssueNote

  return {
    status: waitingForOthers ? 'active' : displayStatus === 'recruiting' ? 'member_joined' : displayStatus,
    label:
      waitingForOthers ? (isSharedCredentials ? '已提取完成' : '已填寫完成') :
      displayStatus === 'full' ? '等待鎖定' :
      displayStatus === 'pending_confirmation' ? (isSharedCredentials ? '帳號提取中' : '資料填寫中') :
      undefined,
  }
}

export function getMemberGroupFlags({ status, sub, myMember, hasServiceInfo, hasServiceInfoIssue }) {
  const isPaymentRelevant = !['recruiting', 'full', 'cancelled'].includes(status)
  const isDisputed = status === 'disputed'
  const isDisputeRaiser = isDisputed && !!myMember?.serviceInfoIssueNote
  const isDisputeEscalated = isDisputeRaiser && !!myMember?.disputeEscalatedAt;
  const isConfirmingLike = status === 'confirming' || (isDisputed && !isDisputeRaiser);
  const needsFillInfo = !!sub && isPaymentRelevant && !hasServiceInfo && status === 'pending_confirmation'
  const waitingForOthers = !!sub && hasServiceInfo && status === 'pending_confirmation'
  const canConfirm = isConfirmingLike && !!myMember && !myMember.confirmedAt
  const alreadyConfirmed = isConfirmingLike && !!myMember?.confirmedAt

  return {
    isPaymentRelevant,
    showMessagesButton: isPaymentRelevant && status !== 'ended',
    needsFillInfo,
    waitingForOthers,
    canConfirm,
    alreadyConfirmed,
    isDisputed,
    isDisputeRaiser,
    isDisputeEscalated,
    canLeaveGroup: ['recruiting', 'full'].includes(status) && !!myMember,
    showReviewHostButton: ['active', 'ended'].includes(status),
    hasServiceInfoIssue,
  }
}

export const DISPUTED_BANNER_TEXT = '問題回報處理中'
export const DISPUTE_ESCALATED_BANNER_TEXT = '平台介入處理中'

export function formatDisputeReason(issueNote) {
  if (!issueNote) return { types: '', detail: '' }
  const idx = issueNote.indexOf('\n')
  if (idx === -1) return { types: issueNote, detail: '' }
  return { types: issueNote.slice(0, idx), detail: issueNote.slice(idx + 1) }
}

export function getMemberGroupBadges({ status, sub, isSharedCredentials, flags }) {
  const { hasServiceInfoIssue, needsFillInfo, waitingForOthers, canConfirm, isDisputed, isDisputeRaiser, isDisputeEscalated, alreadyConfirmed } = flags

  const statusBadgeOverride =
    alreadyConfirmed ? { variant: 'active' } :
    canConfirm && isDisputed ? 'confirming' :
    waitingForOthers ? { variant: 'active', label: isSharedCredentials ? '已提取完成' : '已填寫完成' } :
    status === 'recruiting' && !!sub ? 'member_joined' :
    status === 'full' ? { variant: 'full', label: '等待鎖定' } :
    status === 'pending_confirmation' ? { variant: 'pending_confirmation', label: isSharedCredentials ? '帳號提取中' : '資料填寫中' } :
    undefined

  const pendingBadge =
    hasServiceInfoIssue ? '帳號資訊有問題' :
    needsFillInfo       ? (isSharedCredentials ? '請提取帳號資訊' : '請填寫服務帳號以完成加入流程') :
    waitingForOthers    ? '已填寫完成' :
    canConfirm           ? '確認期進行中，請確認服務' :
    isDisputeEscalated    ? DISPUTE_ESCALATED_BANNER_TEXT :
    isDisputeRaiser      ? DISPUTED_BANNER_TEXT :
    status === 'full' && !!sub ? '招募完成，等待團主鎖定群組' :
    status === 'recruiting' && !!sub ? '已通過申請，需等待其他人加入' :
    undefined

  const pendingBadgeColor =
    (status === 'full' && !!sub) ? 'gray' :
    (status === 'recruiting' && !!sub) ? 'success' :
    hasServiceInfoIssue ? 'danger' :
    waitingForOthers ? 'success' :
    canConfirm ? 'brand' :
    isDisputeRaiser ? 'danger' :
    undefined

  return { statusBadgeOverride, pendingBadge, pendingBadgeColor }
}
