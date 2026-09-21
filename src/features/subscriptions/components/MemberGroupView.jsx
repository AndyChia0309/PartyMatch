import { useEffect, useState } from 'react'
import {
  Banknote, Headset, Info, LogOut, MessageCircle, Users, ClipboardEdit, KeyRound, ShieldAlert, Undo2,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import ConfirmActionDialog from '../../../components/ui/ConfirmActionDialog'
import ConfirmServiceModal from './ConfirmServiceModal'
import CountdownText from '../../../components/ui/primitives/CountdownText'
import GroupModalShell from '../../../components/ui/group/GroupModalShell'
import GroupModalSideBarItem from '../../../components/ui/group/GroupModalSideBarItem'
import UserReviews from '../../group/components/UserReviews'
import ReviewUserModal from './ReviewUserModal'
import FillServiceInfoModal from './FillServiceInfoModal'
import DisputeModal from './DisputeModal'
import ReportPlatformIssueModal from '../../group/components/ReportPlatformIssueModal'
import ReportFalseIssueModal from './ReportFalseIssueModal'
import { buildMembersPanel } from './member-group-view/buildMembersPanel'
import { buildPaymentsPanel } from './member-group-view/buildPaymentsPanel'
import { buildCredentialsPanel } from './member-group-view/buildCredentialsPanel'
import { usePlatformReportForm } from '../hooks/usePlatformReportForm'
import { useDisputeForm } from '../hooks/useDisputeForm'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { getSharingMethodConfig, hasFilledServiceInfo, isSharedCredentialsMethod, serviceHasProfileField } from '../../../common/utils/serviceInfoFields'
import { useCountdown } from '../../../common/utils/hooks'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useSubscriptionStore } from '../../../common/stores/useSubscriptionStore'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { useNotificationStore } from '../../../common/stores/useNotificationStore'
import { useReviewStore } from '../../../common/stores/useReviewStore'
import { fetchGroupTokenTransactions } from '../../../common/api/tokensApi'
import { createPlatformReport } from '../../../common/api/platformReportsApi'
import { remindActivationApi } from '../../../common/api/groupsApi'
import { toast } from '../../../common/utils/toast'
import { suppressNextToast } from '../../../common/utils/notificationToast'
import { isHistoryGroup } from '../../../common/utils/groupStatusDisplay'
import { getMemberGroupFlags, getMemberGroupBadges, DISPUTED_BANNER_TEXT, DISPUTE_ESCALATED_BANNER_TEXT } from '../../../common/utils/memberGroupDisplay'
import { isRecruitingLike } from '../../../common/utils/groupStatus'

const DISPUTE_COOLDOWN_MINUTES = 1

export default function MemberGroupView({ group, onLeaveGroup, onClose, autoOpenCredentialsTick, autoOpenReviewTick, autoScrollToComments, onAutoScrollToCommentsDone, loading = false }) {
  const [activePanel, setActivePanel] = useState(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const [showFillInfo, setShowFillInfo] = useState(false)
  const [showReportFalseIssue, setShowReportFalseIssue] = useState(false)
  const [fillValues, setFillValues] = useState({})
  const [fillLoading, setFillLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [confirmServiceAgreed, setConfirmServiceAgreed] = useState(false)
  const [reviewPrompt, setReviewPrompt] = useState(null);
  const platformReport = usePlatformReportForm(group.id)
  const dispute = useDisputeForm(group.id)
  const [transactions, setTransactions] = useState([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [headerTick, setHeaderTick] = useState(0)
  const [panelViewTick, setPanelViewTick] = useState(0)

  useEffect(() => {
    if (autoOpenCredentialsTick) selectPanel('credentials')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCredentialsTick]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenReviewTick) setReviewPrompt({ closeOnDone: false })
  }, [autoOpenReviewTick]);

  useEffect(() => {
    if (activePanel !== 'payments' && !confirmDialog) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactionsLoading(true)
    fetchGroupTokenTransactions(group.id)
      .then(({ transactions: groupTransactions }) => {
        if (active) setTransactions(groupTransactions)
      })
      .catch(() => { if (active) setTransactions([]) })
      .finally(() => { if (active) setTransactionsLoading(false) })
    return () => { active = false }
  }, [activePanel, confirmDialog, group.id, headerTick])


  const currentUser = useAuthStore(s => s.user)

  const notifications = useNotificationStore(s => s.notifications)
  useEffect(() => {
    if (!currentUser?.id) return
    notifications
      .filter(n => n.userId === currentUser.id && !n.isRead && n.meta?.groupId === group.id && n.type !== 'credential_comment')
      .forEach(n => useNotificationStore.getState().markRead(n.id))
  }, [notifications, currentUser?.id, group.id])

  const hasUnseenCredentialComment = useNotificationStore(s => s.hasUnseenCredentialComment(currentUser?.id, group.id))

  const allMembers  = useMemberStore(s => s.members)
  const subscriptions = useSubscriptionStore(s => s.subscriptions)
  const fillServiceInfo = useMemberStore(s => s.fillServiceInfo)
  const markConfirmed   = useMemberStore(s => s.markConfirmed)
  const confirmService  = useGroupStore(s => s.confirmService)
  const submitReview    = useReviewStore(s => s.submit)
  const members     = allMembers.filter(m => m.groupId === group.id)
  const sub         = currentUser ? (subscriptions.find(s => s.userId === currentUser.id && s.groupId === group.id) ?? null) : null
  const myMember    = currentUser ? members.find(m => m.userId === currentUser.id) ?? null : null

  const serviceDef        = getServiceById(group.serviceId)
  const planDef           = serviceDef?.plans.find(p => p.name === group.planName)

  const isSharedCredentials = isSharedCredentialsMethod(serviceDef?.sharingMethod);
  const showsProfileName    = isSharedCredentials && serviceHasProfileField(serviceDef?.id)
  const hasServiceInfoIssue = (!!myMember?.serviceInfoIssueNote || !!myMember?.hasServiceInfoIssue) && group.status !== 'disputed' && !isHistoryGroup(group);
  const hasGroupServiceInfoIssue = members.some(m => !!m.serviceInfoIssueNote || !!m.hasServiceInfoIssue) && group.status !== 'disputed' && !isHistoryGroup(group);
  const sharingMethodConfig = getSharingMethodConfig(serviceDef?.sharingMethod, serviceDef?.id, { hasServiceInfoIssue })
  const hasServiceInfo      = hasFilledServiceInfo(myMember?.serviceInfo, serviceDef?.sharingMethod, serviceDef?.id) && !hasServiceInfoIssue

  const memberFlags = getMemberGroupFlags({ status: group.status, sub, myMember, hasServiceInfo, hasServiceInfoIssue, hasGroupServiceInfoIssue })
  const {
    isPaymentRelevant, showMessagesButton, needsFillInfo, waitingForOthers, waitingForActivation,
    canConfirm, isDisputeRaiser, isDisputeEscalated, canLeaveGroup, showReviewHostButton,
    isInfoOverdue, isActivationOverdue,
  } = memberFlags
  const canViewCredentials  = isPaymentRelevant;

  async function selectPanel(panel) {
    setActivePanel(panel);
    setPanelViewTick(t => t + 1);
    await Promise.all([
      useGroupStore.getState().refreshGroup(group.id).catch(console.error),
      useMemberStore.getState().init().catch(console.error),
      useSubscriptionStore.getState().init().catch(console.error),
    ]);
    setHeaderTick(t => t + 1)
  }

  function openMessages() {
    onClose()
    window.dispatchEvent(new CustomEvent('pm:open-messages', { detail: { groupId: group.id } }))
  }

  function openDmWithHost() {
    onClose()
    window.dispatchEvent(new CustomEvent('pm:open-dm', {
      detail: { hostId: group.hostId, hostName: group.hostName, hostAvatarInitial: group.hostAvatarInitial, hostAvatarColor: group.hostAvatarColor },
    }))
  }

  const hostReviews = (
    <UserReviews
      userId={group.hostId}
      userName={group.hostName}
      avatarInitial={group.hostAvatarInitial}
      avatarColor={group.hostAvatarColor}
      presenceStatus={group.hostPresenceStatus}
      bio={group.hostBio}
      roleLabel="團主"
      title="團主評價"
      headerClassName="text-lg font-black text-brand"
      onDm={openDmWithHost}
      scrollable
    />
  )

  async function handleConfirmService() {
    setConfirmLoading(true)
    try {
      const res = await confirmService(group.id)
      setConfirmDialog(false)
      setConfirmServiceAgreed(false)
      if (res.released) {
        useSubscriptionStore.getState().init().catch(console.error)
        suppressNextToast('escrow_released_member', group.id)
        toast('確認完成，款項已撥付給團主！', 'success')
        setReviewPrompt({ closeOnDone: true })
      } else {
        if (myMember) markConfirmed(myMember.id)
        toast('已確認，等待其他成員確認中', 'success')
      }
      setHeaderTick(t => t + 1)
    } catch (err) {
      toast(err?.message ?? '確認失敗，請稍後再試', 'error')
    } finally {
      setConfirmLoading(false)
    }
  }

  const fillValid = myMember && sharingMethodConfig.fields.every(({ key, type }) =>
    type === 'checkbox' ? fillValues[key] === true : !!fillValues[key]?.trim()
  )

  async function handleFillSubmit(e) {
    e.preventDefault()
    if (!fillValid) return
    setFillLoading(true)
    try {
      const serviceInfo = Object.fromEntries(
        sharingMethodConfig.fields.map(({ key, type }) => [key, type === 'checkbox' ? true : fillValues[key].trim()])
      )
      await fillServiceInfo(myMember.id, group.id, serviceInfo)
      await Promise.all([
        useGroupStore.getState().refreshGroup(group.id).catch(console.error),
        useMemberStore.getState().init().catch(console.error),
        useSubscriptionStore.getState().init().catch(console.error),
      ])
      setShowFillInfo(false)
      toast('帳號資訊已送出', 'success')
      setHeaderTick(t => t + 1)
    } catch (err) {
      toast(err?.message ?? '送出失敗，請稍後再試', 'error')
    } finally {
      setFillLoading(false)
    }
  }

  function openFillInfoModal() {
    setFillValues(myMember?.serviceInfo ?? {})
    setShowFillInfo(true)
    if (isSharedCredentials && !hasServiceInfoIssue && myMember?.id) {
      useMemberStore.getState().notifyExtractionStart(myMember.id)
    }
  }

  async function handleReportFalseIssue(note) {
    try {
      await createPlatformReport({ groupId: group.id, description: `團主回報的問題：${myMember?.serviceInfoIssueNote ?? ''}\n\n我認為這筆回報不實，說明：${note}` })
      toast('已送出，客服會盡快協助處理', 'success')
      setShowReportFalseIssue(false)
    } catch (err) {
      toast(err?.message ?? '送出失敗，請稍後再試', 'error')
    }
  }

  const fillInfoCta = hasServiceInfoIssue ? (
    <div className="grid grid-cols-2 gap-2 p-2">
      <Button
        variant="destructive"
        onClick={openFillInfoModal}
        className="rounded-lg shadow-button"
      >
        <ClipboardEdit strokeWidth={1.5} size={15} />
        修正帳號資訊
      </Button>
      <Button
        variant="ghost"
        onClick={() => setShowReportFalseIssue(true)}
        className="rounded-lg border border-danger/60 text-danger-text hover:bg-danger-subtle"
      >
        <ShieldAlert strokeWidth={1.5} size={15} />
        回報不實
      </Button>
    </div>
  ) : needsFillInfo && (
    <div className="py-2">
      <Button
        onClick={openFillInfoModal}
        className="w-full rounded-lg shadow-button"
      >
        <ClipboardEdit strokeWidth={1.5} size={15} />
        {isSharedCredentials ? '提取帳號資訊' : '填寫帳號資訊'}
      </Button>
    </div>
  );

  const disputeCooldownEndsAt = myMember?.lastDisputeActionAt
    ? new Date(new Date(myMember.lastDisputeActionAt).getTime() + DISPUTE_COOLDOWN_MINUTES * 60 * 1000)
    : null
  const { label: disputeCooldownLabel, expired: disputeCooldownExpired } = useCountdown(disputeCooldownEndsAt)
  const disputeOnCooldown = !!disputeCooldownEndsAt && !disputeCooldownExpired

  const confirmCta = canConfirm && (
    <div className="grid grid-cols-2 gap-2 p-2">
      <Button
        onClick={() => setConfirmDialog(true)}
        disabled={confirmLoading}
        className="rounded-lg shadow-button"
      >
        確認服務
      </Button>
      <Button
        variant="destructive"
        onClick={dispute.open}
        disabled={disputeOnCooldown}
        className="rounded-lg shadow-button"
      >
        {disputeOnCooldown ? disputeCooldownLabel : '回報問題'}
      </Button>
    </div>
  )

  const withdrawCta = isDisputeRaiser && (
    <div className="py-2">
      <Button
        variant="destructive"
        onClick={() => setWithdrawConfirm(true)}
        disabled={dispute.withdrawing}
        className="w-full rounded-lg shadow-button"
      >
        <Undo2 strokeWidth={1.5} size={15} />
        撤銷回報
      </Button>
    </div>
  )

  const [remindingActivation, setRemindingActivation] = useState(false)
  async function handleRemindActivation() {
    setRemindingActivation(true)
    try {
      await remindActivationApi(group.id)
      toast('已提醒團主盡快啟用服務', 'success')
    } catch (err) {
      toast(err?.message ?? '送出失敗，請稍後再試', 'error')
    } finally {
      setRemindingActivation(false)
    }
  }

  const activationOverdueCta = isActivationOverdue && (
    <div className="grid grid-cols-2 gap-2 p-2">
      <Button
        onClick={handleRemindActivation}
        disabled={remindingActivation}
        className="rounded-lg shadow-button"
      >
        {remindingActivation ? '送出中…' : '服務已可使用'}
      </Button>
      <Button
        variant="destructive"
        onClick={dispute.open}
        disabled={disputeOnCooldown}
        className="rounded-lg shadow-button"
      >
        {disputeOnCooldown ? disputeCooldownLabel : '回報問題'}
      </Button>
    </div>
  )

  const hideRecruitBarLive = !isRecruitingLike(group.status)

  const headerBannerLive = (
    hasServiceInfoIssue ? (
      <div className="flex items-center justify-center bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        帳號資訊有問題，請修正或提出回報不實
      </div>
    ) : needsFillInfo ? (
      <div className="flex items-center justify-center gap-2 bg-brand-subtle px-6 py-3 text-sm font-extrabold text-brand">
        {isInfoOverdue
          ? '帳號資訊填寫已逾期，請盡快處理'
          : (
            <>
              {isSharedCredentials ? '請提取帳號資訊' : '請填寫帳號資訊'}
              {group.serviceInfoDeadline && (
                <>，剩餘 <CountdownText deadline={group.serviceInfoDeadline} /></>
              )}
            </>
          )}
      </div>
    ) : isInfoOverdue ? (
      <div className="flex items-center justify-center bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        帳號資訊已逾期，團主正在處理中
      </div>
    ) : isActivationOverdue ? (
      <div className="flex items-center justify-center bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        團主逾期未啟用，可確認服務已可使用或回報問題
      </div>
    ) : waitingForOthers && !hasGroupServiceInfoIssue ? (
      <div className="flex items-center justify-center bg-success-subtle px-6 py-3 text-sm font-extrabold text-success-text">
        {isSharedCredentials ? '已提取帳號資訊，請等候其他成員' : '已填寫帳號資訊，請等候其他成員'}
      </div>
    ) : waitingForActivation || (waitingForOthers && hasGroupServiceInfoIssue) ? (
      <div className="flex items-center justify-center gap-2 bg-warning-subtle px-6 py-3 text-sm font-extrabold text-warning-text">
        請等候團主啟用服務
        {group.activateDeadline && (
          <>，剩餘 <CountdownText deadline={group.activateDeadline} /></>
        )}
      </div>
    ) : canConfirm ? (
      <div className="flex items-center justify-center gap-2 bg-info-subtle px-6 py-3 text-sm font-extrabold text-info-text">
        {group.billingDateAdjustedAt
          ? '扣款日期已調整，請確認服務'
          : '服務已啟用，請確認是否正常'}
        {myMember?.confirmDeadline && (
          <>，剩餘 <CountdownText deadline={myMember.confirmDeadline} /></>
        )}
      </div>
    ) : isDisputeEscalated ? (
      <div className="flex items-center justify-center gap-2 bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        {DISPUTE_ESCALATED_BANNER_TEXT}
        {myMember?.disputeDeadline && (
          <>，剩餘 <CountdownText deadline={myMember.disputeDeadline} /></>
        )}
      </div>
    ) : isDisputeRaiser ? (
      <div className="flex items-center justify-center bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        {DISPUTED_BANNER_TEXT}
      </div>
    ) : undefined
  )

  const centeredCtaLive = fillInfoCta || confirmCta || withdrawCta || activationOverdueCta || undefined

  const {
    statusBadgeOverride: statusBadgeOverrideLive,
    pendingBadge: pendingBadgeLive,
    pendingBadgeColor: pendingBadgeColorLive,
  } = getMemberGroupBadges({ status: group.status, sub, isSharedCredentials, flags: memberFlags })

  const [frozenHeader, setFrozenHeader] = useState({
    hideRecruitBar: hideRecruitBarLive,
    banner: headerBannerLive,
    cta: centeredCtaLive,
    statusBadgeOverride: statusBadgeOverrideLive,
    pendingBadge: pendingBadgeLive,
    pendingBadgeColor: pendingBadgeColorLive,
  })

  useEffect(() => {
    if (activePanel === null)
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrozenHeader({
      hideRecruitBar: hideRecruitBarLive,
      banner: headerBannerLive,
      cta: centeredCtaLive,
      statusBadgeOverride: statusBadgeOverrideLive,
      pendingBadge: pendingBadgeLive,
      pendingBadgeColor: pendingBadgeColorLive,
    })
  }, [activePanel, headerTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = activePanel === null
    ? {
        hideRecruitBar: hideRecruitBarLive,
        banner: headerBannerLive,
        cta: centeredCtaLive,
        statusBadgeOverride: statusBadgeOverrideLive,
        pendingBadge: pendingBadgeLive,
        pendingBadgeColor: pendingBadgeColorLive,
      }
    : frozenHeader;

  function buildSubPanel() {
    if (activePanel === 'members') {
      return buildMembersPanel({ group, members, currentUser, myMember, showReviewHostButton, setActivePanel, onClose, setReviewPrompt })
    }

    if (activePanel === 'payments') return buildPaymentsPanel({ group, member: myMember, transactions, transactionsLoading })
    if (activePanel === 'credentials') {
      return buildCredentialsPanel({
        group,
        viewerName: myMember?.userName,
        showPassword,
        onTogglePassword: () => setShowPassword(v => !v),
        isSharedCredentials,
        hasExtracted: hasServiceInfo || hasServiceInfoIssue,
        autoScrollToComments,
        onAutoScrollToCommentsDone,
        memberServiceInfo: myMember?.serviceInfo,
        memberServiceFields: sharingMethodConfig.fields,
        memberStatuses: members
          .map(m => {
            const isSelf = m.userId === currentUser?.id
            const memberHasServiceInfo = m.hasServiceInfo ?? hasFilledServiceInfo(m.serviceInfo, serviceDef?.sharingMethod, serviceDef?.id)
            return {
              id: m.id,
              userName: m.userName,
              userAvatarInitial: m.userAvatarInitial,
              userAvatarColor: m.userAvatarColor,
              userPresenceStatus: m.userPresenceStatus,
              isSelf,
              profileName: showsProfileName ? m.serviceInfo?.memberProfileName ?? null : null,
              extractionStartedAt: m.extractionStartedAt,
              hasServiceInfo: memberHasServiceInfo,
              hasServiceInfoIssue: !!m.serviceInfoIssueNote || !!m.hasServiceInfoIssue,
              issueNote: isSelf ? m.serviceInfoIssueNote : null,
              serviceInfoIssueEvidenceUrl: isSelf ? m.serviceInfoIssueEvidenceUrl : null,
              serviceInfoIssueDeadline: m.serviceInfoIssueDeadline,
              disputeEvidenceUrl: isSelf ? m.disputeEvidenceUrl : null,
              disputeDeadline: m.disputeDeadline,
              disputeEscalatedAt: m.disputeEscalatedAt,
              confirmedAt: m.confirmedAt,
              confirmDeadline: m.confirmDeadline,
            }
          }),
      })
    }

    return null
  }

  function renderSideBar() {
    return (
      <>
        <GroupModalSideBarItem active={activePanel === null} onClick={() => selectPanel(null)}>
          <Info strokeWidth={1.5} size={17} /> 群組概覽
        </GroupModalSideBarItem>
        <GroupModalSideBarItem active={activePanel === 'members'} onClick={() => selectPanel('members')}>
          <Users strokeWidth={1.5} size={17} /> 群組名單
        </GroupModalSideBarItem>
        {!!sub && (
          <GroupModalSideBarItem active={activePanel === 'payments'} onClick={() => selectPanel('payments')}>
            <Banknote strokeWidth={1.5} size={17} /> 付款管理
          </GroupModalSideBarItem>
        )}
        {canViewCredentials && (
          <GroupModalSideBarItem active={activePanel === 'credentials'} onClick={() => selectPanel('credentials')} className="relative">
            <span className="relative">
              <KeyRound strokeWidth={1.5} size={17} />
              {hasUnseenCredentialComment && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning-text" />
              )}
            </span>
            帳號資訊
          </GroupModalSideBarItem>
        )}
        {showMessagesButton && (
          <GroupModalSideBarItem pinned className="hidden md:flex" onClick={openMessages}>
            <MessageCircle strokeWidth={1.5} size={17} /> 群組訊息
          </GroupModalSideBarItem>
        )}
        <GroupModalSideBarItem pinned={!showMessagesButton} onClick={() => platformReport.setShow(true)}>
          <Headset strokeWidth={1.5} size={17} /> 聯繫客服
        </GroupModalSideBarItem>
        {canLeaveGroup && (
          <GroupModalSideBarItem tone="danger" onClick={() => setLeaveConfirm(true)}>
            <LogOut strokeWidth={1.5} size={17} /> 退出群組
          </GroupModalSideBarItem>
        )}
      </>
    )
  }

  return (
    <>

      {loading ? (
        <GroupModalShell loading onClose={onClose} group={group} service={serviceDef} plan={planDef} />
      ) : !showFillInfo && !showReportFalseIssue && !dispute.show && !confirmDialog && !reviewPrompt && !platformReport.show && (
      <GroupModalShell
        onClose={onClose}
        group={group}
        service={serviceDef}
        plan={planDef}
        hideRecruitBar={header.hideRecruitBar}
        headerBanner={header.banner}
        extraInfoRows={[]}
        centeredCta={header.cta}
        statusBadgeOverride={header.statusBadgeOverride}
        pendingBadge={header.pendingBadge}
        pendingBadgeColor={header.pendingBadgeColor}
        sideBar={renderSideBar()}
        subPanel={activePanel ? buildSubPanel() : null}
        onSubPanelBack={() => setActivePanel(null)}
        panelKey={`${activePanel ?? 'overview'}-${panelViewTick}`}
        mobileReviewsSection={hostReviews}
        mobileFab={showMessagesButton && (
          <button
            type="button"
            onClick={openMessages}
            aria-label="群組訊息"
            className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-floating transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand"
          >
            <MessageCircle strokeWidth={1.5} size={20} />
          </button>
        )}
      >
      </GroupModalShell>
      )}
      <FillServiceInfoModal
        isOpen={showFillInfo}
        onClose={() => setShowFillInfo(false)}
        group={group}
        serviceInfo={myMember?.serviceInfo}
        sharingMethod={serviceDef?.sharingMethod}
        sharingMethodConfig={sharingMethodConfig}
        fillValues={fillValues}
        setFillValues={setFillValues}
        fillValid={fillValid}
        fillLoading={fillLoading}
        onSubmit={handleFillSubmit}
        viewerName={myMember?.userName}
        hasServiceInfoIssue={hasServiceInfoIssue}
        issueNote={myMember?.serviceInfoIssueNote}
      />
      <ReportFalseIssueModal
        isOpen={showReportFalseIssue}
        issueNote={myMember?.serviceInfoIssueNote}
        onClose={() => setShowReportFalseIssue(false)}
        onSubmit={handleReportFalseIssue}
      />
      <ReportPlatformIssueModal
        isOpen={platformReport.show}
        onClose={platformReport.close}
        description={platformReport.description}
        setDescription={platformReport.setDescription}
        evidenceUrl={platformReport.evidence.url}
        evidenceName={platformReport.evidence.name}
        evidenceUploading={platformReport.evidence.uploading}
        evidenceProgress={platformReport.evidence.progress}
        onEvidenceSelect={platformReport.evidence.onSelect}
        onRemoveEvidence={platformReport.evidence.onRemove}
        submitting={platformReport.submitting}
        onSubmit={platformReport.submit}
      />
      <DisputeModal
        isOpen={dispute.show}
        onClose={() => dispute.setShow(false)}
        onSubmit={dispute.submit}
        disputeReasons={dispute.reasons}
        onToggleReason={dispute.toggleReason}
        disputeDetail={dispute.detail}
        setDisputeDetail={dispute.setDetail}
        disputeLoading={dispute.loading}
        evidenceUrl={dispute.evidence.url}
        evidenceName={dispute.evidence.name}
        evidenceUploading={dispute.evidence.uploading}
        evidenceProgress={dispute.evidence.progress}
        onEvidenceSelect={dispute.evidence.onSelect}
        onRemoveEvidence={dispute.evidence.onRemove}
      />
      {confirmDialog && (
        <ConfirmServiceModal
          isOpen={confirmDialog}
          onClose={() => { setConfirmDialog(false); setConfirmServiceAgreed(false) }}
          onConfirm={handleConfirmService}
          group={group}
          service={serviceDef}
          plan={planDef}
          confirmed={confirmServiceAgreed}
          setConfirmed={setConfirmServiceAgreed}
          loading={confirmLoading}
          transactions={transactions}
          transactionsLoading={transactionsLoading}
        />
      )}
      {leaveConfirm && (
        <ConfirmActionDialog
          title="退出群組"
          message={`確定要退出「${group.serviceName}」群組嗎？退出後名額將釋出，且需等待 1 分鐘後才能重新提出申請。`}
          confirmLabel="退出"
          danger
          onConfirm={() => { setLeaveConfirm(false); onLeaveGroup?.() }}
          onCancel={() => setLeaveConfirm(false)}
        />
      )}
      {withdrawConfirm && (
        <ConfirmActionDialog
          title="撤銷回報問題"
          message="確定要撤銷這次的回報問題嗎？撤銷後會回到確認期，需要重新確認服務。"
          confirmLabel="撤銷"
          danger
          onConfirm={() => { setWithdrawConfirm(false); dispute.withdraw() }}
          onCancel={() => setWithdrawConfirm(false)}
        />
      )}
      {reviewPrompt && (
        <ReviewUserModal
          target={{
            name: group.hostName,
            avatarInitial: group.hostAvatarInitial,
            avatarColor: group.hostAvatarColor,
            presenceStatus: group.hostPresenceStatus,
          }}
          subtitle={`${group.serviceName} · ${group.planName}`}
          onSubmit={({ rating, comment }) => submitReview({ groupId: group.id, revieweeId: group.hostId, rating, comment })}
          onClose={() => { const { closeOnDone } = reviewPrompt; setReviewPrompt(null); if (closeOnDone) onClose() }}
        />
      )}
    </>
  );
}
