import { useEffect } from 'react'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { useOpenGroupStore } from '../../common/stores/useOpenGroupStore'
import GroupViewModal from '../../components/ui/group/GroupViewModal'
import RenewalModal from './components/RenewalModal'
import { useHostActions } from './hooks/useHostActions';

export default function HostGroupModalHost() {
  const activeUser = useAuthStore(s => s.user)

  const {
    errors,
    submittingIds,
    viewGroupId, setViewGroupId,
    autoOpenLockGroup, setAutoOpenLockGroup,
    autoOpenActivate, setAutoOpenActivate,
    autoOpenApplications, setAutoOpenApplications,
    autoOpenBilling, setAutoOpenBilling,
    autoOpenMemberInfo, setAutoOpenMemberInfo,
    autoOpenMembers, setAutoOpenMembers,
    autoExpandMemberId, setAutoExpandMemberId,
    setRenewalModalGroupId,
    membersMap,
    renewalModalGroup,
    refreshGroups,
    handleLockGroup,
    handleRemoveMember,
    handleActivate,
    handleCancelGroup,
    handleStartRenewal,
    handleEndGroup,
    handleApprove,
    handleReportServiceInfoIssue,
    handleResolveDispute,
    handleEscalateDispute,
    handleRejectWithdrawal,
    handleReject,
    handleAdjustBillingDate,
  } = useHostActions(activeUser);

  useEffect(() => {
    useOpenGroupStore.getState().setHostOpenGroupId(viewGroupId)
  }, [viewGroupId]);

  if (!activeUser) return null

  return (
    <>
      <GroupViewModal
        isOpen={!!viewGroupId}
        onClose={() => { setViewGroupId(null); setAutoOpenLockGroup(false); setAutoOpenActivate(false); setAutoOpenApplications(false); setAutoOpenBilling(false); setAutoOpenMemberInfo(false); setAutoOpenMembers(false); setAutoExpandMemberId(null); refreshGroups() }}
        groupId={viewGroupId}
        onReportServiceInfoIssue={handleReportServiceInfoIssue}
        onResolveDispute={handleResolveDispute}
        onEscalateDispute={handleEscalateDispute}
        onRejectWithdrawal={handleRejectWithdrawal}
        onActivate={handleActivate}
        onLockGroup={handleLockGroup}
        onCancelGroup={handleCancelGroup}
        onRemoveMember={handleRemoveMember}
        onApprove={handleApprove}
        onReject={handleReject}
        onAdjustBillingDate={handleAdjustBillingDate}
        errors={errors}
        submittingIds={submittingIds}
        autoOpenLockGroup={autoOpenLockGroup}
        autoOpenActivate={autoOpenActivate}
        onAutoOpenActivateDone={() => setAutoOpenActivate(false)}
        autoOpenApplications={autoOpenApplications}
        autoOpenBilling={autoOpenBilling}
        autoOpenMemberInfo={autoOpenMemberInfo}
        autoOpenMembers={autoOpenMembers}
        autoExpandMemberId={autoExpandMemberId}
        onOpenRenewal={() => setRenewalModalGroupId(viewGroupId)}
      />
      {renewalModalGroup && (
        <RenewalModal
          isOpen
          onClose={() => setRenewalModalGroupId(null)}
          group={renewalModalGroup}
          members={membersMap[renewalModalGroup.id] ?? []}
          onStartRenewal={handleStartRenewal}
          onEndGroup={handleEndGroup}
        />
      )}
    </>
  )
}
