import { useEffect, useState } from 'react'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { useApplicationStore } from '../../../common/stores/useApplicationStore'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { usePendingRefreshStore } from '../../../common/stores/usePendingRefreshStore'
import { startPolling } from '../../../common/utils/poller'
import HostGroupView from '../../../features/manage-groups/components/HostGroupView'
import MemberGroupView from '../../../features/subscriptions/components/MemberGroupView'

const GROUP_POLL_INTERVAL_MS = 15000

export default function GroupViewModal({
  isOpen, onClose, groupId,
  onReportServiceInfoIssue, onResolveDispute, onEscalateDispute, onRejectWithdrawal, onActivate, onLockGroup, onCancelGroup, onRemoveMember,
  onLeaveGroup, onApprove, onReject, onAdjustBillingDate, errors, submittingIds,
  autoOpenLockGroup, autoOpenActivate, onAutoOpenActivateDone, autoOpenApplications, autoOpenBilling, autoOpenMemberInfo, autoOpenMembers,
  autoExpandMemberId, onOpenRenewal, autoOpenCredentials,
}) {
  const groups       = useGroupStore(s => s.groups);
  const allMembers   = useMemberStore(s => s.members)
  const applicationsState = useApplicationStore(s => s.applications)
  const currentUser  = useAuthStore(s => s.user)

  const [refreshedGroupId, setRefreshedGroupId] = useState(null)
  const dataRefreshing = isOpen && !!groupId && refreshedGroupId !== groupId
  useEffect(() => {
    if (!isOpen || !groupId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefreshedGroupId(null)
      return
    }
    if (!dataRefreshing) return
    let active = true
    const startedAt = Date.now()
    Promise.all([
      useGroupStore.getState().refreshGroup(groupId).catch(console.error),
      useMemberStore.getState().init().catch(console.error),
      useApplicationStore.getState().init().catch(console.error),
    ]).then(() => new Promise(resolve => setTimeout(resolve, Math.max(0, 1500 - (Date.now() - startedAt)))))
      .then(() => { if (active) setRefreshedGroupId(groupId) })
    return () => { active = false }
  }, [dataRefreshing, isOpen, groupId])

  useEffect(() => {
    if (!isOpen || !groupId)
      return;
    const stop = startPolling(async () => {
      await Promise.all([
        useGroupStore.getState().refreshGroup(groupId).catch(console.error),
        useMemberStore.getState().init().catch(console.error),
      ])
    }, GROUP_POLL_INTERVAL_MS)
    return stop
  }, [isOpen, groupId]);

  useEffect(() => {
    if (isOpen && groupId) usePendingRefreshStore.getState().clearGroup(groupId)
  }, [isOpen, groupId]);

  if (!isOpen || !groupId) return null
  const group = groups.find(g => g.id === groupId) ?? null
  if (!group) return null

  const isHost       = currentUser?.id === group.hostId
  const members      = allMembers.filter(m => m.groupId === groupId)
  const applications = isHost
    ? applicationsState
        .filter(a => a.groupId === groupId)
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    : []

  if (isHost) return (
    <HostGroupView
      loading={dataRefreshing}
      group={group} members={members} applications={applications}
      onReportServiceInfoIssue={onReportServiceInfoIssue}
      onResolveDispute={onResolveDispute}
      onEscalateDispute={onEscalateDispute}
      onRejectWithdrawal={onRejectWithdrawal}
      onRemoveMember={onRemoveMember}
      onActivate={onActivate} onLockGroup={onLockGroup} onCancelGroup={onCancelGroup}
      onApprove={onApprove} onReject={onReject} onAdjustBillingDate={onAdjustBillingDate}
      errors={errors} submittingIds={submittingIds} onClose={onClose}
      autoOpenLockGroup={autoOpenLockGroup}
      autoOpenActivate={autoOpenActivate}
      onAutoOpenActivateDone={onAutoOpenActivateDone}
      autoOpenApplications={autoOpenApplications}
      autoOpenBilling={autoOpenBilling}
      autoOpenMemberInfo={autoOpenMemberInfo}
      autoOpenMembers={autoOpenMembers}
      autoExpandMemberId={autoExpandMemberId}
      onOpenRenewal={onOpenRenewal}
    />
  )
  return <MemberGroupView loading={dataRefreshing} group={group} onLeaveGroup={onLeaveGroup} onClose={onClose} autoOpenCredentials={autoOpenCredentials} />
}
