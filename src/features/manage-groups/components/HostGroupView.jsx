import { useEffect, useState } from 'react'
import { Banknote, CheckCircle2, ClipboardList, Clock, Headset, Info, KeyRound, LockKeyhole, MessageCircle, PlayCircle, RefreshCw, Trash2, Users } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import ConfirmActionDialog from '../../../components/ui/ConfirmActionDialog'
import CountdownText from '../../../components/ui/primitives/CountdownText'
import GroupModalShell from '../../../components/ui/group/GroupModalShell'
import GroupModalSideBarItem from '../../../components/ui/group/GroupModalSideBarItem'
import ReviewUserModal from '../../subscriptions/components/ReviewUserModal'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { isSharedCredentialsMethod } from '../../../common/utils/serviceInfoFields'
import { canReportServiceIssue } from '../../../common/utils/groupStatus'
import { getHostGroupFlags, getHostStatusBadge, getHostPendingBadge } from '../../../common/utils/hostGroupDisplay'
import { DISPUTE_ESCALATED_BANNER_TEXT } from '../../../common/utils/memberGroupDisplay'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { useApplicationStore } from '../../../common/stores/useApplicationStore'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { useNotificationStore } from '../../../common/stores/useNotificationStore'
import { useReviewStore } from '../../../common/stores/useReviewStore'
import { fetchGroupTransactions } from '../../../common/api/groupsApi'
import { uploadServiceIssueEvidence, uploadPlatformReportEvidence } from '../../../common/api/storageApi'
import { createPlatformReport } from '../../../common/api/platformReportsApi'
import { useEvidenceUpload } from '../../../common/utils/hooks'
import { toast, dismissToast } from '../../../common/utils/toast'
import ActivateServiceModal from './ActivateServiceModal'
import ReportServiceIssueModal from './ReportServiceIssueModal'
import ReportPlatformIssueModal from '../../group/components/ReportPlatformIssueModal'
import LockGroupCredentialsModal from './LockGroupCredentialsModal'
import AdjustBillingDateModal from './AdjustBillingDateModal'
import { buildMembersPanel } from './host-group-view/buildMembersPanel'
import { buildApplicationsPanel } from './host-group-view/buildApplicationsPanel'
import { buildReviewHistoryPanel } from './host-group-view/buildReviewHistoryPanel'
import { buildBillingPanel } from './host-group-view/buildBillingPanel'
import { buildMemberInfoPanel } from './host-group-view/buildMemberInfoPanel'

export default function HostGroupView(
  { group, members, applications, onReportServiceInfoIssue, onResolveDispute, onEscalateDispute, onRejectWithdrawal, onRemoveMember, onActivate, onLockGroup, onCancelGroup, onApprove, onReject, onAdjustBillingDate, errors, submittingIds, onClose, autoOpenLockGroup, autoOpenActivate, onAutoOpenActivateDone, autoOpenApplications, autoOpenBilling, autoOpenMemberInfo, autoOpenMembers, autoExpandMemberId, onOpenRenewal, loading = false }
) {
  const [showActivate, setShowActivate]                   = useState(false)
  const [activateBillingDate, setActivateBillingDate]      = useState('')
  const [removingMember, setRemovingMember]               = useState(null)
  const [activePanel, setActivePanel]                     = useState(null);
  const [headerStatus, setHeaderStatus]                    = useState(group.status);
  const [panelTick, setPanelTick]                          = useState(0);
  const [dataSyncTick, setDataSyncTick]                     = useState(0);
  const [showReviewHistory, setShowReviewHistory]         = useState(false)
  const [reviewTargetMember, setReviewTargetMember]        = useState(null)
  const [showLockGroupConfirm, setShowLockGroupConfirm] = useState(false)
  const [checkingLock, setCheckingLock]                   = useState(false)
  const [showCancelConfirm, setShowCancelConfirm]         = useState(false)
  const [showPlatformReport, setShowPlatformReport]         = useState(false)
  const [platformReportDescription, setPlatformReportDescription] = useState('')
  const [submittingPlatformReport, setSubmittingPlatformReport]   = useState(false)
  const [transactions, setTransactions]                     = useState([])
  const [transactionsLoading, setTransactionsLoading]       = useState(false)
  const [showCredentialsModal, setShowCredentialsModal]     = useState(false)
  const [showPassword, setShowPassword]                     = useState(false)
  const [credentialValues, setCredentialValues]             = useState({})
  const [lockLoading, setLockLoading]                       = useState(false)
  const [showAdjustBillingDate, setShowAdjustBillingDate]   = useState(false)
  const [newBillingDate, setNewBillingDate]                 = useState('')
  const [billingDateNote, setBillingDateNote]               = useState('')
  const [adjustingBillingDate, setAdjustingBillingDate]     = useState(false)

  useEffect(() => {
    if (activePanel !== 'billing') return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactionsLoading(true)
    fetchGroupTransactions(group.id)
      .then(data => { if (active) setTransactions(data) })
      .catch(() => { if (active) setTransactions([]) })
      .finally(() => { if (active) setTransactionsLoading(false) })
    return () => { active = false }
  }, [activePanel, group.id, panelTick])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenLockGroup && group.status === 'full') setShowLockGroupConfirm(true)
  }, [autoOpenLockGroup]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onOpenHostGroup(e) {
      if ((e.detail?.groupId ?? e.detail?.openGroupId) !== group.id) return
      if (e.detail?.openApplications) {
        setPanelTick(t => t + 1);
        setActivePanel('applications')
        setShowReviewHistory(false)
        return
      }
      if (e.detail?.openMembers) {
        setShowCredentialsModal(false);
        setCredentialValues({})
        setShowLockGroupConfirm(false)
        setActivePanel('members')
        return
      }
      if (e.detail?.openMemberInfo) {
        setPanelTick(t => t + 1);
        setActivePanel('memberInfo')
        return
      }
      if (e.detail?.openLockGroup || e.detail?.openActivate || e.detail?.openBilling) return
      setShowCredentialsModal(false)
      setCredentialValues({})
      setShowLockGroupConfirm(false)
      setActivePanel(null)
      useGroupStore.getState().refreshGroup(group.id).catch(console.error)
    }
    window.addEventListener('pm:open-host-group', onOpenHostGroup)
    return () => window.removeEventListener('pm:open-host-group', onOpenHostGroup)
  }, [group.id])

  useEffect(() => {
    if (autoOpenApplications) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelTick(t => t + 1);
      setActivePanel('applications')
      setShowReviewHistory(false)
    }
  }, [autoOpenApplications])

  useEffect(() => {
    if (activePanel === 'applications') dismissToast(`pm-new_application-${group.id}`)
  }, [activePanel, group.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenMembers) setActivePanel('members')
  }, [autoOpenMembers])

  useEffect(() => {
    if (activePanel !== null)
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderStatus(group.status)
  }, [activePanel, group.status])

  useEffect(() => {
    if (activePanel === null)
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeaderStatus(group.status)
  }, [activePanel, dataSyncTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenMemberInfo) setActivePanel('memberInfo')
  }, [autoOpenMemberInfo])

  useEffect(() => {
    if (activePanel !== 'memberInfo')
      return;
    useMemberStore.getState().init().catch(console.error)
    const user = useAuthStore.getState().getProfile()
    if (!user) return
    useNotificationStore.getState().notifications
      .filter(n => n.type === 'service_info_filled' && n.userId === user.id && n.meta?.groupId === group.id && !n.isRead)
      .forEach(n => useNotificationStore.getState().markRead(n.id))
  }, [activePanel, group.id, panelTick])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenBilling) setActivePanel('billing')
  }, [autoOpenBilling])

  useEffect(() => {
    if (autoOpenActivate) { openActivate(); onAutoOpenActivateDone?.() }
  }, [autoOpenActivate]) // eslint-disable-line react-hooks/exhaustive-deps

  const serviceDef    = getServiceById(group.serviceId)
  const planDef       = serviceDef?.plans.find(p => p.name === group.planName)
  const pendingApps   = applications.filter(a => a.status === 'pending')
  const groupFull     = group.openSeats <= 0
  const { isRecruiting, isCancelled, hasBeenActive, showRenewal } = getHostGroupFlags(group.status, group.nextBillingDate);
  const canActivateNow = headerStatus === 'pending_activation';

  const currentUserId = useAuthStore(s => s.user?.id);
  const submitReview  = useReviewStore(s => s.submit)
  const notifications = useNotificationStore(s => s.notifications)
  const unseenMemberInfoCount = useNotificationStore(s => s.getUnseenServiceInfoCount(currentUserId, group.id))

  useEffect(() => {
    if (!currentUserId) return
    notifications
      .filter(n => n.userId === currentUserId && !n.isRead && n.meta?.groupId === group.id && n.type !== 'service_info_filled')
      .forEach(n => useNotificationStore.getState().markRead(n.id))
  }, [notifications, currentUserId, group.id]);

  const [memberChecks, setMemberChecks]             = useState({})
  const [serviceIssueMember, setServiceIssueMember] = useState(null)
  const [serviceIssueNote, setServiceIssueNote]     = useState('')
  const [activating, setActivating]                 = useState(false)
  const serviceIssueEvidence = useEvidenceUpload(uploadServiceIssueEvidence)
  const platformReportEvidence = useEvidenceUpload(uploadPlatformReportEvidence)

  async function handleSubmitPlatformReport() {
    if (!platformReportDescription.trim()) return
    setSubmittingPlatformReport(true)
    try {
      await createPlatformReport({
        groupId:     group.id,
        description: platformReportDescription.trim(),
        evidenceUrl: platformReportEvidence.key,
      })
      toast('回報已送出，客服會盡快協助處理', 'success')
      setShowPlatformReport(false)
      setPlatformReportDescription('')
      platformReportEvidence.reset()
    } catch (err) {
      toast(err?.message ?? '回報失敗，請稍後再試', 'error')
    } finally {
      setSubmittingPlatformReport(false)
    }
  }

  const allMembersChecked = members.length > 0 && members.every(m => memberChecks[m.id] && !m.serviceInfoIssueNote);

  function openActivate() {
    setActivateBillingDate('')
    setShowActivate(true)
  }

  function closeActivate() {
    setShowActivate(false)
    setMemberChecks({})
    setActivateBillingDate('')
  }

  const isFirstActivation = !group.hasActivatedOnce;

  async function handleActivateConfirm() {
    if (isFirstActivation && !activateBillingDate) return
    setActivating(true)
    try {
      await onActivate?.(isFirstActivation ? activateBillingDate : null)
      setShowActivate(false)
      setMemberChecks({})
      setActivateBillingDate('')
      onClose()
    } finally {
      setActivating(false)
    }
  }

  const lockGroupBanner = headerStatus === 'full' && (
    <div className="flex items-center justify-center bg-raised px-6 py-3 text-sm font-extrabold text-ink-2">
      招募完成，請點擊鎖定群組
    </div>
  )

  const needsCredentialsOnLock = isSharedCredentialsMethod(serviceDef?.sharingMethod);

  async function openLockFlow() {
    if (checkingLock) return
    setCheckingLock(true)
    const fresh = await useGroupStore.getState().refreshGroup(group.id).catch(() => null)
    setCheckingLock(false)
    if (fresh && fresh.status !== 'full') {
      toast('名額已變動，暫時無法鎖定', 'info')
      return
    }
    if (needsCredentialsOnLock) {
      setCredentialValues({})
      setShowCredentialsModal(true)
    } else {
      setShowLockGroupConfirm(true)
    }
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault()
    setLockLoading(true)
    try {
      const locked = await onLockGroup?.(JSON.stringify(credentialValues))
      if (locked) {
        setShowCredentialsModal(false)
        setCredentialValues({})
      }
    } finally {
      setLockLoading(false)
    }
  }

  async function handleAdjustBillingDateSubmit() {
    if (!newBillingDate || !billingDateNote.trim()) return
    setAdjustingBillingDate(true)
    try {
      await onAdjustBillingDate?.(newBillingDate, billingDateNote.trim())
      setShowAdjustBillingDate(false)
      setNewBillingDate('')
      setBillingDateNote('')
    } finally {
      setAdjustingBillingDate(false)
    }
  }

  const lockGroupCta = headerStatus === 'full' && (
    <div className="py-2">
      {showLockGroupConfirm ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            onClick={() => setShowLockGroupConfirm(false)}
            className="rounded-lg border border-line"
          >取消</Button>
          <Button
            variant="ink"
            onClick={() => { setShowLockGroupConfirm(false); onLockGroup?.(undefined) }}
            className="rounded-lg"
          >確認鎖定</Button>
        </div>
      ) : (
        <Button
          variant="ink"
          onClick={openLockFlow}
          disabled={checkingLock}
          className="w-full rounded-lg shadow-button"
        >
          <LockKeyhole size={15} strokeWidth={1.5} /> 鎖定群組
        </Button>
      )}
    </div>
  )

  const pendingConfirmationBanner = headerStatus === 'pending_confirmation' && (
    <div className="flex items-center justify-center gap-2 bg-info-subtle px-6 py-3 text-sm font-extrabold text-info-text">
      <Clock size={15} strokeWidth={1.5} />
      {needsCredentialsOnLock ? '等待成員提取帳號資訊' : '等待成員填寫服務帳號資訊'}
      {group.serviceInfoDeadline && (
        <>，剩餘 <CountdownText deadline={group.serviceInfoDeadline} /></>
      )}
    </div>
  )

  const confirmingBanner = headerStatus === 'confirming' && (
    <div className="flex items-center justify-center gap-2 bg-info-subtle px-6 py-3 text-sm font-extrabold text-info-text">
      <Clock size={15} strokeWidth={1.5} />確認期進行中

      {!group.billingDateAdjustedAt && (
        <button
          onClick={() => { setNewBillingDate(''); setBillingDateNote(''); setShowAdjustBillingDate(true) }}
          className="ml-1 shrink-0 rounded-full border border-info-text/40 px-2.5 py-0.5 text-xs font-semibold text-info-text transition-all hover:-translate-y-0.5 hover:bg-info-text/10"
        >
          調整扣款日
        </button>
      )}
    </div>
  )

  const escalatedDisputeMember = members.find(m => !!m.disputeEscalatedAt)
  const disputedBanner = headerStatus === 'disputed' && (
    <div className="flex items-center justify-center gap-2 bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
      <Clock size={15} strokeWidth={1.5} />
      {escalatedDisputeMember ? DISPUTE_ESCALATED_BANNER_TEXT : '收到問題回報，處理中'}
      {escalatedDisputeMember?.disputeDeadline && (
        <>，剩餘 <CountdownText deadline={escalatedDisputeMember.disputeDeadline} /></>
      )}
    </div>
  )

  const activateBanner = canActivateNow && (
    <div className="flex items-center justify-center gap-2 bg-warning-subtle px-6 py-3 text-sm font-extrabold text-warning-text">
      <CheckCircle2 strokeWidth={1.5} size={15} />
      請點擊啟用服務
      {group.activateDeadline && (
        <>，剩餘 <CountdownText deadline={group.activateDeadline} /></>
      )}
    </div>
  )

  const activateCta = canActivateNow && (
    <div className="py-2">
      <Button
        onClick={openActivate}
        className="w-full rounded-lg shadow-button"
      >
        <PlayCircle strokeWidth={1.5} size={15} /> 啟用服務
      </Button>
    </div>
  )

  const renewalCta = showRenewal && (
    <div className="py-2">
      <Button
        onClick={() => onOpenRenewal?.()}
        className="w-full rounded-lg shadow-button"
      >
        <RefreshCw size={15} strokeWidth={1.5} /> 續訂服務
      </Button>
    </div>
  )

  function openReviewHistory() {
    setShowReviewHistory(true)
    useApplicationStore.getState().init()
  }

  function openGroupMessages() {
    onClose()
    window.dispatchEvent(new CustomEvent('pm:open-messages', { detail: { groupId: group.id } }))
  }

  function buildSubPanel() {
    if (activePanel === 'members') {
      return buildMembersPanel({
        group, members, setActivePanel, onClose, setRemovingMember,
        onReviewMember: m => setReviewTargetMember(m),
        showReviewButton: hasBeenActive,
      })
    }
    if (activePanel === 'applications') {
      const approveWithSync = appId => onApprove?.(appId)?.finally(() => setDataSyncTick(t => t + 1));
      const rejectWithSync  = appId => onReject?.(appId)?.finally(() => setDataSyncTick(t => t + 1))
      return buildApplicationsPanel({ pendingApps, groupFull, errors, submittingIds, onApprove: approveWithSync, onReject: rejectWithSync, setShowReviewHistory: openReviewHistory })
    }
    if (activePanel === 'billing') {
      const pendingApplicantUserIds = new Set(pendingApps.map(a => a.applicantId ?? a.userId))
      return buildBillingPanel({ groupMembers: group.members, transactions, transactionsLoading, showRenewal, currentCycle: group.currentCycle, isCancelled, pendingApplicantUserIds })
    }
    if (activePanel === 'memberInfo') {
      return buildMemberInfoPanel({
        groupId: group.id,
        hostId: group.hostId,
        groupStatus: group.status,
        members,
        sharingMethod: serviceDef?.sharingMethod,
        sharedCredentials: group.sharedCredentials,
        serviceId: group.serviceId,
        canReportServiceIssue: canReportServiceIssue(group.status),
        onOpenServiceIssue: m => { setServiceIssueMember(m); setServiceIssueNote(m.serviceInfoIssueNote ?? '') },
        onResolveDispute: (memberId, note) => onResolveDispute?.(group.id, memberId, note),
        onEscalateDispute: (memberId, note) => onEscalateDispute?.(group.id, memberId, note),
        onRejectWithdrawal: memberId => onRejectWithdrawal?.(group.id, memberId),
        showPassword,
        onTogglePassword: () => setShowPassword(v => !v),
        autoExpandMemberId,
      });
    }
    return null
  }

  const isReviewHistory = showReviewHistory && activePanel === 'applications'

  async function goToPanel(panel) {
    setPanelTick(t => t + 1);
    setActivePanel(panel)
    setShowReviewHistory(false);
    await Promise.all([
      useGroupStore.getState().refreshGroup(group.id).catch(console.error),
      useMemberStore.getState().init().catch(console.error),
      useApplicationStore.getState().init().catch(console.error),
    ]);
    setDataSyncTick(t => t + 1)
  }

  function renderSideBar() {
    return (
      <>
        <GroupModalSideBarItem active={activePanel === null} onClick={() => goToPanel(null)}>
          <Info strokeWidth={1.5} size={17} /> 群組概覽
        </GroupModalSideBarItem>
        <GroupModalSideBarItem active={activePanel === 'members'} onClick={() => goToPanel('members')}>
          <Users strokeWidth={1.5} size={17} /> 群組名單
        </GroupModalSideBarItem>
        {isRecruiting && (
          <GroupModalSideBarItem
            active={activePanel === 'applications'}
            onClick={() => goToPanel('applications')}
            className="relative"
          >
            <span className="relative">
              <ClipboardList strokeWidth={1.5} size={17} />
              {pendingApps.length > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-text px-0.5 text-2xs font-bold text-white">
                  {pendingApps.length}
                </span>
              )}
            </span>
            申請管理
          </GroupModalSideBarItem>
        )}
        <GroupModalSideBarItem active={activePanel === 'billing'} onClick={() => goToPanel('billing')}>
          <Banknote strokeWidth={1.5} size={17} />
          收款管理
        </GroupModalSideBarItem>
        {!isRecruiting && !isCancelled && (
          <GroupModalSideBarItem active={activePanel === 'memberInfo'} onClick={() => goToPanel('memberInfo')} className="relative">
            <span className="relative">
              <KeyRound strokeWidth={1.5} size={17} />
              {unseenMemberInfoCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-text px-0.5 text-2xs font-bold text-white">
                  {unseenMemberInfoCount}
                </span>
              )}
            </span>
            帳號資訊
          </GroupModalSideBarItem>
        )}
        {isRecruiting ? (
          <GroupModalSideBarItem pinned tone="danger" onClick={() => setShowCancelConfirm(true)}>
            <Trash2 strokeWidth={1.5} size={17} /> 解散群組
          </GroupModalSideBarItem>
        ) : !isCancelled && (
          <>
            {group.status !== 'ended' && (
              <GroupModalSideBarItem
                pinned
                className="hidden md:flex"
                onClick={openGroupMessages}
              >
                <MessageCircle strokeWidth={1.5} size={17} /> 群組訊息
              </GroupModalSideBarItem>
            )}
            <GroupModalSideBarItem onClick={() => setShowPlatformReport(true)}>
              <Headset strokeWidth={1.5} size={17} /> 聯繫客服
            </GroupModalSideBarItem>
          </>
        )}
      </>
    )
  }

  const pendingBadge = getHostPendingBadge(group.status, needsCredentialsOnLock)

  return (
    <>

      {loading ? (
        <GroupModalShell loading onClose={onClose} group={group} service={serviceDef} plan={planDef} />
      ) : !showActivate && !serviceIssueMember && !showCredentialsModal && !showPlatformReport && (
      <GroupModalShell
        onClose={onClose}
        group={group}
        service={serviceDef}
        plan={planDef}
        hideRecruitBar={headerStatus !== 'recruiting'}
        headerBanner={lockGroupBanner || activateBanner || pendingConfirmationBanner || confirmingBanner || disputedBanner || undefined}
        centeredCta={lockGroupCta || activateCta || renewalCta || undefined}
        extraInfoRows={[]}
        statusBadgeOverride={getHostStatusBadge(headerStatus, needsCredentialsOnLock)}
        pendingBadge={pendingBadge?.text}
        pendingBadgeColor={pendingBadge?.color}
        subPanel={activePanel ? buildSubPanel() : null}
        onSubPanelBack={() => { setActivePanel(null); setShowReviewHistory(false) }}
        subSubPanel={
          isReviewHistory ? buildReviewHistoryPanel({ applications, groupFull, errors }) :
          null
        }
        onSubSubPanelBack={() => { setShowReviewHistory(false) }}
        panelKey={isReviewHistory ? 'reviewHistory' : `${activePanel ?? 'overview'}-${panelTick}`}
        sideBar={renderSideBar()}
        mobileFab={!isRecruiting && !isCancelled && group.status !== 'ended' && (
          <button
            type="button"
            onClick={openGroupMessages}
            aria-label="群組訊息"
            className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-floating transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand"
          >
            <MessageCircle strokeWidth={1.5} size={20} />
          </button>
        )}
      />
      )}
      <LockGroupCredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => { setShowCredentialsModal(false); setCredentialValues({}) }}
        serviceId={group.serviceId}
        serviceName={group.serviceName}
        values={credentialValues}
        setValues={setCredentialValues}
        onSubmit={handleCredentialsSubmit}
        loading={lockLoading}
      />
      <ActivateServiceModal
        isOpen={showActivate}
        onClose={closeActivate}
        onConfirm={handleActivateConfirm}
        group={group}
        members={members}
        memberChecks={memberChecks}
        setMemberChecks={setMemberChecks}
        allMembersChecked={allMembersChecked}
        isFirstActivation={isFirstActivation}
        billingDate={activateBillingDate}
        setBillingDate={setActivateBillingDate}
        loading={activating}
      />
      <ReportServiceIssueModal
        member={serviceIssueMember}
        sharingMethod={serviceDef?.sharingMethod}
        onClose={() => {
          setServiceIssueMember(null)
          setServiceIssueNote('')
          serviceIssueEvidence.reset()
        }}
        note={serviceIssueNote}
        setNote={setServiceIssueNote}
        evidenceUrl={serviceIssueEvidence.url}
        evidenceName={serviceIssueEvidence.name}
        evidenceUploading={serviceIssueEvidence.uploading}
        evidenceProgress={serviceIssueEvidence.progress}
        onEvidenceSelect={serviceIssueEvidence.onSelect}
        onRemoveEvidence={serviceIssueEvidence.onRemove}
        onSubmit={() => {
          if (!serviceIssueNote.trim() || !serviceIssueMember) return
          onReportServiceInfoIssue?.(serviceIssueMember, serviceIssueNote.trim(), serviceIssueEvidence.key || undefined)
          setServiceIssueMember(null)
          setServiceIssueNote('')
          serviceIssueEvidence.reset()
        }}
      />
      {reviewTargetMember && (
        <ReviewUserModal
          target={{
            name: reviewTargetMember.userName,
            avatarInitial: reviewTargetMember.userAvatarInitial,
            avatarColor: reviewTargetMember.userAvatarColor,
            presenceStatus: reviewTargetMember.userPresenceStatus,
          }}
          subtitle={`${group.serviceName} · ${group.planName}`}
          onSubmit={({ rating, comment }) => submitReview({ groupId: group.id, revieweeId: reviewTargetMember.userId, rating, comment })}
          onClose={() => setReviewTargetMember(null)}
        />
      )}
      <ReportPlatformIssueModal
        isOpen={showPlatformReport}
        onClose={() => {
          setShowPlatformReport(false)
          setPlatformReportDescription('')
          platformReportEvidence.reset()
        }}
        description={platformReportDescription}
        setDescription={setPlatformReportDescription}
        evidenceUrl={platformReportEvidence.url}
        evidenceName={platformReportEvidence.name}
        evidenceUploading={platformReportEvidence.uploading}
        evidenceProgress={platformReportEvidence.progress}
        onEvidenceSelect={platformReportEvidence.onSelect}
        onRemoveEvidence={platformReportEvidence.onRemove}
        submitting={submittingPlatformReport}
        onSubmit={handleSubmitPlatformReport}
      />
      <AdjustBillingDateModal
        open={showAdjustBillingDate}
        currentDate={group.nextBillingDate}
        newDate={newBillingDate}
        setNewDate={setNewBillingDate}
        note={billingDateNote}
        setNote={setBillingDateNote}
        saving={adjustingBillingDate}
        onClose={() => { setShowAdjustBillingDate(false); setNewBillingDate(''); setBillingDateNote('') }}
        onSubmit={handleAdjustBillingDateSubmit}
      />
      {showCancelConfirm && (
        <ConfirmActionDialog
          title="解散群組"
          message={`確定要解散「${group.serviceName}」群組嗎？所有代管費用將退還給成員，此操作無法撤回。`}
          confirmLabel="解散群組"
          danger
          onConfirm={() => { setShowCancelConfirm(false); onCancelGroup?.() }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {removingMember && (
        <ConfirmActionDialog
          title="移除成員"
          message={`確定要將「${removingMember.userName}」移出群組嗎？`}
          confirmLabel="移除"
          danger
          onConfirm={() => {
            onRemoveMember?.(removingMember)?.finally(() => setDataSyncTick(t => t + 1))
            setRemovingMember(null)
          }}
          onCancel={() => setRemovingMember(null)}
        />
      )}
    </>
  );
}
