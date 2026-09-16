import { useEffect, useState } from 'react'
import {
  Banknote, CheckCircle2, Clock, Headset, Info, LogOut, MessageCircle, Users, ClipboardEdit, KeyRound, Undo2,
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
import { buildMembersPanel } from './member-group-view/buildMembersPanel'
import { buildPaymentsPanel } from './member-group-view/buildPaymentsPanel'
import { buildCredentialsPanel } from './member-group-view/buildCredentialsPanel'
import { usePlatformReportForm } from '../hooks/usePlatformReportForm'
import { useDisputeForm } from '../hooks/useDisputeForm'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { getSharingMethodConfig, hasFilledServiceInfo, isSharedCredentialsMethod, serviceHasProfileField } from '../../../common/utils/serviceInfoFields'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useSubscriptionStore } from '../../../common/stores/useSubscriptionStore'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { useNotificationStore } from '../../../common/stores/useNotificationStore'
import { useReviewStore } from '../../../common/stores/useReviewStore'
import { fetchGroupTokenTransactions } from '../../../common/api/tokensApi'
import { toast } from '../../../common/utils/toast'
import { isHistoryGroup } from '../../../common/utils/groupStatusDisplay'
import { getMemberGroupFlags, getMemberGroupBadges, DISPUTED_BANNER_TEXT, DISPUTE_ESCALATED_BANNER_TEXT } from '../../../common/utils/memberGroupDisplay'

export default function MemberGroupView({ group, onLeaveGroup, onClose, autoOpenCredentials, loading = false }) {
  const [activePanel, setActivePanel] = useState(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const [showFillInfo, setShowFillInfo] = useState(false)
  const [fillValues, setFillValues] = useState({})
  const [fillLoading, setFillLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [confirmServiceAgreed, setConfirmServiceAgreed] = useState(false)
  const [reviewPrompt, setReviewPrompt] = useState(null);
  const platformReport = usePlatformReportForm(group.id)
  const dispute = useDisputeForm(group.id, onClose)
  const [transactions, setTransactions] = useState([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [headerTick, setHeaderTick] = useState(0)
  const [panelViewTick, setPanelViewTick] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpenCredentials) setActivePanel('credentials')
  }, [autoOpenCredentials]);

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

  const unreadForGroup = useNotificationStore(s => s.getUnreadCountForGroup(currentUser?.id, group.id))
  useEffect(() => {
    if (currentUser?.id && unreadForGroup > 0) {
      useNotificationStore.getState().markReadForGroup(currentUser.id, group.id)
    }
  }, [currentUser?.id, group.id, unreadForGroup])

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
  const hasServiceInfoIssue = !!myMember?.serviceInfoIssueNote && group.status !== 'disputed' && !isHistoryGroup(group);
  const sharingMethodConfig = getSharingMethodConfig(serviceDef?.sharingMethod, serviceDef?.id, { hasServiceInfoIssue })
  const hasServiceInfo      = hasFilledServiceInfo(myMember?.serviceInfo, serviceDef?.sharingMethod, serviceDef?.id) && !hasServiceInfoIssue

  const memberFlags = getMemberGroupFlags({ status: group.status, sub, myMember, hasServiceInfo, hasServiceInfoIssue })
  const {
    isPaymentRelevant, showMessagesButton, needsFillInfo, waitingForOthers,
    canConfirm, isDisputeRaiser, isDisputeEscalated, canLeaveGroup, showReviewHostButton,
  } = memberFlags
  const canViewCredentials  = isPaymentRelevant && (hasServiceInfo || hasServiceInfoIssue);

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
        toast('確認完成，款項已撥付給團主！', 'success')
      } else {
        if (myMember) markConfirmed(myMember.id)
        toast('已確認，等待其他成員確認中', 'success')
      }
      setReviewPrompt({ closeOnDone: !!res.released })
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

  const fillInfoCta = (needsFillInfo || hasServiceInfoIssue) && (
    <div className="py-2">
      <Button
        variant={hasServiceInfoIssue ? 'destructive' : 'default'}
        onClick={openFillInfoModal}
        className="w-full rounded-lg shadow-button"
      >
        <ClipboardEdit strokeWidth={1.5} size={15} />
        {hasServiceInfoIssue ? '修正帳號資訊' : isSharedCredentials ? '提取帳號資訊' : '填寫帳號'}
      </Button>
    </div>
  );

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
        className="rounded-lg shadow-button"
      >
        回報問題
      </Button>
    </div>
  )

  const withdrawCta = isDisputeRaiser && !isDisputeEscalated && (
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

  const hideRecruitBarLive = group.status !== 'recruiting'

  const headerBannerLive = (
    hasServiceInfoIssue ? (
      <div className="flex items-center justify-center bg-warning-subtle px-6 py-3 text-sm font-extrabold text-warning-text">
        帳號資訊有問題，請點擊「修正帳號資訊」
      </div>
    ) : needsFillInfo ? (
      <div className="flex items-center justify-center gap-2 bg-brand-subtle px-6 py-3 text-sm font-extrabold text-brand">
        <Clock size={15} strokeWidth={1.5} />
        {isSharedCredentials ? '請提取帳號資訊' : '請填寫服務帳號'}
        {group.serviceInfoDeadline && (
          <>，剩餘 <CountdownText deadline={group.serviceInfoDeadline} /></>
        )}
      </div>
    ) : waitingForOthers ? (
      <div className="flex items-center justify-center gap-2 bg-success-subtle px-6 py-3 text-sm font-extrabold text-success-text">
        <CheckCircle2 size={15} strokeWidth={1.5} />
        {isSharedCredentials ? '已提取帳號資訊，等待其他成員完成' : '已填寫服務帳號，等待其他成員完成填寫'}
      </div>
    ) : canConfirm ? (
      <div className="flex items-center justify-center gap-2 bg-info-subtle px-6 py-3 text-sm font-extrabold text-info-text">
        <Clock size={15} strokeWidth={1.5} />
        服務已啟用，請確認是否正常
        {myMember?.confirmDeadline && (
          <>，剩餘 <CountdownText deadline={myMember.confirmDeadline} /></>
        )}
      </div>
    ) : isDisputeEscalated ? (
      <div className="flex items-center justify-center gap-2 bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        <Clock size={15} strokeWidth={1.5} />
        {DISPUTE_ESCALATED_BANNER_TEXT}
        {myMember?.disputeDeadline && (
          <>，剩餘 <CountdownText deadline={myMember.disputeDeadline} /></>
        )}
      </div>
    ) : isDisputeRaiser ? (
      <div className="flex items-center justify-center gap-2 bg-danger-subtle px-6 py-3 text-sm font-extrabold text-danger-text">
        <Clock size={15} strokeWidth={1.5} />
        {DISPUTED_BANNER_TEXT}
      </div>
    ) : undefined
  )

  const centeredCtaLive = fillInfoCta || confirmCta || withdrawCta || undefined

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
        viewerAvatarInitial: myMember?.userAvatarInitial,
        viewerAvatarColor: myMember?.userAvatarColor,
        viewerPresenceStatus: myMember?.userPresenceStatus,
        showPassword,
        onTogglePassword: () => setShowPassword(v => !v),
        issueNote: myMember?.serviceInfoIssueNote,
        evidenceUrl: myMember?.disputeEvidenceUrl ?? myMember?.serviceInfoIssueEvidenceUrl,
        disputeDeadline: myMember?.disputeDeadline,
        isDisputeEscalated,
        isSharedCredentials,
        memberServiceInfo: myMember?.serviceInfo,
        memberServiceFields: sharingMethodConfig.fields,
        memberProfiles: showsProfileName
          ? members.map(m => ({
            id: m.id,
            userName: m.userName,
            userAvatarInitial: m.userAvatarInitial,
            userAvatarColor: m.userAvatarColor,
            userPresenceStatus: m.userPresenceStatus,
            profileName: m.serviceInfo?.memberProfileName ?? null,
            isSelf: m.userId === currentUser?.id,
          }))
          : [],
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
          <GroupModalSideBarItem active={activePanel === 'credentials'} onClick={() => selectPanel('credentials')}>
            <KeyRound strokeWidth={1.5} size={17} /> 帳號資訊
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
      ) : !showFillInfo && !dispute.show && !confirmDialog && !reviewPrompt && !platformReport.show && (
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
          title="撤銷問題回報"
          message="確定要撤銷這次的問題回報嗎？撤銷後會回到確認期，需要重新確認服務或再次回報問題。"
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
