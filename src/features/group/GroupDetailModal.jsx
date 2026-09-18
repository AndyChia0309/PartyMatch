import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { getServiceById } from '../../common/utils/serviceUtils'
import { hasFilledServiceInfo } from '../../common/utils/serviceInfoFields'
import { useApplicationStore } from '../../common/stores/useApplicationStore'
import { useMemberStore } from '../../common/stores/useMemberStore'
import { useSubscriptionStore } from '../../common/stores/useSubscriptionStore'
import { useFavoriteStore } from '../../common/stores/useFavoriteStore'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { useNotificationStore } from '../../common/stores/useNotificationStore'
import { usePendingRefreshStore } from '../../common/stores/usePendingRefreshStore'
import { finalizeLeaveGroup } from './utils/leaveGroupFlow'
import { isHistoryGroup } from '../../common/utils/groupStatusDisplay'
import { getMemberJoinedBadgeVariant } from '../../common/utils/memberGroupDisplay'
import { calcDisplayPrice } from '../../common/utils/pricingUtils'
import { byNewest } from '../../common/utils/date'
import { toast } from '../../common/utils/toast'
import ServiceLogo from '../../components/ui/ServiceLogo'
import { LOCKED_MESSAGE } from '../../common/layout/components/navConstants'
import { useIsDesktop } from '../../common/utils/hooks'
import { PANEL_OPENED_EVENT, broadcastPanelOpened } from '../../common/utils/panelBroadcast'
import { TokenBadge } from '../../components/ui/TokenAmount'
import ConfirmActionDialog from '../../components/ui/ConfirmActionDialog'
import CountdownText from '../../components/ui/primitives/CountdownText'
import GroupModalShell from '../../components/ui/group/GroupModalShell'
import GroupPriceSeatSummary from '../../components/ui/group/GroupPriceSeatSummary'
import MemberGroupView from '../subscriptions/components/MemberGroupView'
import ExploreGroupCard from '../explore/components/ExploreGroupCard'
import UserReviews from './components/UserReviews'
import ApplyModal from './components/ApplyModal'
import { buildMembersSubPanel } from './components/buildMembersSubPanel'
import { buildMobileFooter } from './components/buildMobileFooter';

async function initStoreWithRetry(store, attempts = 3, delayMs = 600) {
  for (let i = 0; i < attempts; i++) {
    await store.getState().init()
    if (!store.getState().error) return
    if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs))
  }
}

export default function GroupDetailModal() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showApply, setShowApply]           = useState(false)
  const [applyMessage, setApplyMessage]     = useState('')
  const [applyAgreed, setApplyAgreed]       = useState(false)
  const [showMembers, setShowMembers]           = useState(false)
  const [leaveConfirm, setLeaveConfirm]         = useState(false)
  const [leaving, setLeaving]                   = useState(false)
  const [cancelConfirm, setCancelConfirm]       = useState(false)
  const [cancelling, setCancelling]             = useState(false)
  const [applying, setApplying]                 = useState(false)
  const [autoOpenCredentialsTick, setAutoOpenCredentialsTick] = useState(0)
  const [autoOpenReviewTick, setAutoOpenReviewTick] = useState(0)
  const [autoScrollToComments, setAutoScrollToComments] = useState(false)
  const picksScrollRef = useRef(null)
  const picksObserverRef = useRef(null)
  const [picksAtStart, setPicksAtStart] = useState(true)
  const [picksAtEnd, setPicksAtEnd]     = useState(true)

  function measurePicksScroll(el) {
    setPicksAtStart(el.scrollLeft <= 0);
    setPicksAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }

  function picksScrollCallbackRef(el) {
    picksObserverRef.current?.disconnect()
    picksObserverRef.current = null
    picksScrollRef.current = el
    if (!el) return
    measurePicksScroll(el)
    const observer = new ResizeObserver(() => measurePicksScroll(el))
    observer.observe(el)
    picksObserverRef.current = observer
  }

  function scrollPicks(direction) {
    const el = picksScrollRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
  }

  function handlePicksScroll(e) {
    measurePicksScroll(e.currentTarget)
  }

  const groupId      = new URLSearchParams(location.search).get('group')
  const isOpen       = !!groupId
  const isDesktop    = useIsDesktop()
  const activeUser   = useAuthStore(s => s.user)
  const activeUserId = activeUser?.id

  const groups       = useGroupStore(s => s.groups);
  const applications = useApplicationStore(s => s.applications)
  const members      = useMemberStore(s => s.members)
  const isFav        = useFavoriteStore(s => groupId && activeUserId ? s.isFavorited(activeUserId, groupId) : false);

  const liveGroup     = isOpen ? (groups.find(g => g.id === groupId) ?? null) : null;
  const [lastGroup, setLastGroup] = useState(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (liveGroup) setLastGroup({ id: groupId, data: liveGroup })
  }, [liveGroup, groupId])
  const group        = liveGroup ?? (isOpen && lastGroup?.id === groupId ? lastGroup.data : null)
  const memberRecord = group && activeUserId ? (members.find(m => m.userId === activeUserId && m.groupId === group.id) ?? null) : null

  const groupIdRef = useRef(groupId)
  useEffect(() => { groupIdRef.current = groupId })

  const [freshGroupId, setFreshGroupId] = useState(null)
  useEffect(() => {
    if (!groupId) return
    let active = true
    useGroupStore.getState().refreshGroup(groupId)
      .catch(console.error)
      .finally(() => { if (active) setFreshGroupId(groupId) })
    return () => { active = false }
  }, [groupId]);
  const groupDataPending = isOpen && !!groupId && freshGroupId !== groupId

  useEffect(() => {
    if (!groupId || !activeUserId) return
    useApplicationStore.getState().init().catch(console.error)
    useMemberStore.getState().init().catch(console.error)
    useSubscriptionStore.getState().init().catch(console.error)
  }, [groupId, activeUserId]);

  const [refreshedGroupId, setRefreshedGroupId] = useState(null)
  const refreshedGroupIdRef = useRef(refreshedGroupId)
  useEffect(() => { refreshedGroupIdRef.current = refreshedGroupId })
  const membershipRefreshing = !!groupId && refreshedGroupId !== groupId
  const [loadingGuess, setLoadingGuess] = useState({ isMember: false, wide: false })
  useLayoutEffect(() => {
    if (!membershipRefreshing) return
    const recentApproval = !!activeUserId && useNotificationStore.getState().notifications.some(
      n => n.type === 'application_approved' && !n.isRead && n.userId === activeUserId && n.meta?.groupId === groupId
    )
    const freshMembers  = useMemberStore.getState().members
    const freshIsMember = !!activeUserId && (recentApproval || freshMembers.some(m => m.userId === activeUserId && m.groupId === groupId))
    const freshIsHost   = group?.hostId === activeUserId
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingGuess({
      isMember: freshIsMember && !freshIsHost,
      wide:     !freshIsMember && !freshIsHost && isDesktop,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipRefreshing, groupId]);
  useEffect(() => {
    if (!groupId) return
    if (!membershipRefreshing) return
    let active = true
    const startedAt = Date.now()
    const tasks = activeUserId ? [
      initStoreWithRetry(useApplicationStore),
      initStoreWithRetry(useMemberStore),
      initStoreWithRetry(useSubscriptionStore),
    ] : []
    Promise.all(tasks).then(() => new Promise(resolve => setTimeout(resolve, Math.max(0, 1500 - (Date.now() - startedAt)))))
      .then(() => { if (active) setRefreshedGroupId(groupId) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipRefreshing, groupId]);

  const notificationsForReadCheck = useNotificationStore(s => s.notifications)
  useEffect(() => {
    if (!activeUserId || !groupId) return
    notificationsForReadCheck
      .filter(n => n.userId === activeUserId && !n.isRead && n.meta?.groupId === groupId && n.type !== 'credential_comment')
      .forEach(n => useNotificationStore.getState().markRead(n.id))
  }, [notificationsForReadCheck, activeUserId, groupId]);

  useEffect(() => {
    if (groupId) usePendingRefreshStore.getState().clearGroup(groupId)
  }, [groupId]);

  function resetApply() {
    setShowApply(false); setApplyMessage(''); setApplyAgreed(false)
  }

  function resetSubViews() {
    resetApply()
    setAutoScrollToComments(false)
    setShowMembers(false); setLeaveConfirm(false); setCancelConfirm(false)
  }

  const locationRef = useRef(location)
  useEffect(() => { locationRef.current = location })

  function pushGroupUrl(id) {
    const params = new URLSearchParams(locationRef.current.search)
    if (params.get('group') === (id ?? null)) return
    if (id) params.set('group', id)
    else params.delete('group')
    navigate({ pathname: locationRef.current.pathname, search: params.toString() ? `?${params}` : '' })
  }

  useEffect(() => {
    function onOpen(e) {
      resetSubViews()
      const gId = e.detail?.groupId ?? null;
      if (gId) window.dispatchEvent(new CustomEvent('pm:close-host-group'))
      const hasUnreadForGroup = !!activeUserId && gId &&
        useNotificationStore.getState().getUnreadCountForGroup(activeUserId, gId) > 0;
      if (gId && (gId !== refreshedGroupIdRef.current || hasUnreadForGroup)) setRefreshedGroupId(null)
      if (gId && gId !== groupIdRef.current) {
        setFreshGroupId(null)
      } else if (gId) {
        useGroupStore.getState().refreshGroup(gId).catch(console.error)
        useMemberStore.getState().init().catch(console.error)
        useApplicationStore.getState().init().catch(console.error)
        useSubscriptionStore.getState().init().catch(console.error)
      }
      pushGroupUrl(gId)
      if (e.detail?.openCredentials) setAutoOpenCredentialsTick(t => t + 1)
      if (e.detail?.openReview) setAutoOpenReviewTick(t => t + 1)
      if (e.detail?.scrollToComments) setAutoScrollToComments(true)
      broadcastPanelOpened('group-detail')
    }
    function onCloseGroupDetail() { pushGroupUrl(null) }
    function onPanelOpened(e) {
      if (e.detail?.panelId !== 'group-detail') onCloseGroupDetail()
    }
    window.addEventListener('pm:open-group', onOpen)
    window.addEventListener('pm:close-group-detail', onCloseGroupDetail)
    window.addEventListener(PANEL_OPENED_EVENT, onPanelOpened)
    return () => {
      window.removeEventListener('pm:open-group', onOpen)
      window.removeEventListener('pm:close-group-detail', onCloseGroupDetail)
      window.removeEventListener(PANEL_OPENED_EVENT, onPanelOpened)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.state?.reopenGroupModalId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetApply()
      navigate(location.pathname + location.search, { replace: true, state: null })
      pushGroupUrl(location.state.reopenGroupModalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const service = group ? getServiceById(group.serviceId) : null
  const plan    = service?.plans.find(p => p.name === group?.planName)

  const hasServiceInfoIssue = !!memberRecord?.serviceInfoIssueNote && !isHistoryGroup(group ?? {})
  const hasServiceInfo      = hasFilledServiceInfo(memberRecord?.serviceInfo, service?.sharingMethod, service?.id) && !hasServiceInfoIssue

  const picks = useMemo(() => {
    if (!group) return []
    const recruiting = groups.filter(g =>
      ((g.status === 'recruiting' && g.openSeats > 0) || g.status === 'full') && g.id !== group.id && g.hostId !== activeUserId
    ).sort(byNewest)
    return [
      ...recruiting.filter(g => g.serviceId === group.serviceId),
      ...recruiting.filter(g => g.serviceId !== group.serviceId),
    ]
  }, [group, groups, activeUserId])

  useLayoutEffect(() => {
    if (picksScrollRef.current) measurePicksScroll(picksScrollRef.current)
  }, [picks]);

  const viewerBlocked = useMemo(() => {
    if (!isOpen || !group || groupDataPending || membershipRefreshing || leaving || group.status === 'recruiting') return false
    const viewerIsHost = group.hostId === activeUserId
    const viewerIsMember = activeUserId ? members.some(m => m.userId === activeUserId && m.groupId === group.id) : false
    const viewerApp = activeUserId ? useApplicationStore.getState().getByUserAndGroup(activeUserId, group.id) : null
    const viewerAppStatus = viewerApp?.status
    const viewerHasActiveApp = !!viewerApp && viewerAppStatus !== 'rejected' && viewerAppStatus !== 'removed' && viewerAppStatus !== 'left' && viewerAppStatus !== 'cancelled'
    return !(viewerIsHost || viewerIsMember || viewerHasActiveApp)
  }, [isOpen, group, groupDataPending, membershipRefreshing, leaving, activeUserId, members])

  useEffect(() => {
    if (!viewerBlocked || !group) return
    const refreshAction = {
      label: '重新整理',
      onClick: () => useGroupStore.getState().init({ all: true }),
    }
    if (group.status === 'full') {
      const wasFavorited = !!activeUserId && useFavoriteStore.getState().isFavorited(activeUserId, group.id)
      if (wasFavorited) useFavoriteStore.getState().toggle(activeUserId, group.id)
      toast(wasFavorited ? '此群組已額滿，已取消收藏' : '此群組已額滿', 'info', { action: refreshAction })
    } else {
      useGroupStore.getState().removeFromList(group.id)
      toast('此群組已不開放', 'info', { action: refreshAction })
    }
    pushGroupUrl(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerBlocked, group, activeUserId]);

  const memberGroupIds  = useMemo(
    () => new Set(members.filter(m => m.userId === activeUserId).map(m => m.groupId)),
    [members, activeUserId],
  )
  const appliedGroupIds = useMemo(
    () => activeUserId
      ? new Set(applications.filter(a => (a.applicantId ?? a.userId) === activeUserId && a.status === 'pending').map(a => a.groupId))
      : new Set(),
    [applications, activeUserId],
  )

  if (!isOpen || !group || groupDataPending || viewerBlocked) return null

  const isHost           = group.hostId === activeUserId
  const isMember         = activeUserId ? members.some(m => m.userId === activeUserId && m.groupId === group.id) : false
  const isPaymentPhase      = ['pending_confirmation', 'pending_activation', 'active'].includes(group.status)
  const needsFillInfo       = isMember && isPaymentPhase && !hasServiceInfo
  const isWaitingMembers = isMember && ['recruiting', 'full'].includes(group.status)
  const isFull           = (group.openSeats ?? 0) <= 0

  const app          = activeUserId ? useApplicationStore.getState().getByUserAndGroup(activeUserId, group.id) : null;
  const appStatus    = app?.status
  const hasActiveApp = !!app && appStatus !== 'rejected' && appStatus !== 'removed' && appStatus !== 'left' && appStatus !== 'cancelled' && !(appStatus === 'approved' && !isMember)
  const isPendingApp = appStatus === 'pending'

  const canApply = !isHost && !isMember && !hasActiveApp && !isFull && !!activeUserId && group.status === 'recruiting'

  function handleClose() {
    const params = new URLSearchParams(location.search);
    if (params.has('group')) {
      params.delete('group')
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true })
    }
  }

  function handleApplyClick() {
    if (group.status !== 'recruiting') {
      toast('此群組已不開放申請', 'error')
      return
    }
    const price = calcDisplayPrice(group.pricePerSeat, group.billingCycle)
    const balance = activeUser?.tokenBalance ?? 0
    if (price > balance) {
      toast('PM幣不足', 'error', {
        icon: <TokenBadge />,
        action: { label: '前往儲值', onClick: () => window.dispatchEvent(new CustomEvent('pm:open-topup')) },
      })
      return
    }
    setShowApply(true)
  }

  async function handleCancel() {
    if (cancelling || !app) return
    setCancelling(true)
    try {
      await useApplicationStore.getState().cancel(app.id)
      toast('已取消申請')
      setCancelConfirm(false)
      handleClose()
    } catch (err) {
      if (err?.response?.status === 409) {
        toast('發生錯誤，請重新整理', 'error', {
          id: 'pm-cancel-application-conflict',
          persistent: true,
          action: { label: '重新整理', onClick: () => window.location.reload() },
        })
      } else {
        toast(err?.response?.data?.message ?? err?.message ?? '取消申請失敗，請稍後再試', 'error')
      }
      setCancelConfirm(false)
    } finally {
      setCancelling(false)
    }
  }

  async function handleApply() {
    if (!applyAgreed || applying) return
    setApplying(true)
    try {
      await useApplicationStore.getState().create({
        groupId: group.id,
        groupName: group.groupName || group.serviceName,
        serviceId: group.serviceId,
        serviceName: group.serviceName,
        planName: group.planName,
        hostId: group.hostId,
        hostName: group.hostName,
        hostAvatarInitial: group.hostAvatarInitial,
        hostAvatarColor: group.hostAvatarColor,
        message: applyMessage,
      }, useAuthStore.getState().getProfile())
      handleClose()
      toast(`${group.planName ?? group.serviceName} 申請已送出！`, 'success', {
        icon: <ServiceLogo serviceId={group.serviceId} size={20} />,
        action: { label: '前往查看', onClick: () => window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: group.id } })) },
      })
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? '申請失敗，請稍後再試'
      const code = err?.response?.data?.code
      if (code === 'INSUFFICIENT_BALANCE') {
        toast('PM幣不足', 'error', {
          icon: <TokenBadge />,
          action: { label: '前往儲值', onClick: () => window.dispatchEvent(new CustomEvent('pm:open-topup')) },
        })
        useAuthStore.getState().refreshTokenBalance().catch(console.error)
      } else if (code === 'GROUP_NOT_RECRUITING') {
        toast('慢了一步，這個群組剛好被團主解散或已額滿，無法申請', 'error');
        useGroupStore.getState().refreshGroup(group.id).catch(console.error)
      } else if (code === 'REAPPLY_COOLDOWN') {
        const cooldownEnds = err?.response?.data?.cooldownEnds
        toast(cooldownEnds ? <span>剩餘 <CountdownText deadline={cooldownEnds} /> 後可重新申請</span> : msg, 'error')
      } else if (code === 'CREDIT_SCORE_TOO_LOW') {
        toast('信用分數不足，無法申請此群組', 'error')
      } else {
        toast(msg, 'error')
      }
    } finally {
      setApplying(false)
    }
  }

  function handleLeave() {
    setLeaveConfirm(false);
    setLeaving(true)
    const startedAt = Date.now()
    finalizeLeaveGroup(
      groupId,
      { id: activeUserId, name: activeUser?.name ?? activeUser?.displayName ?? '成員' },
    ).catch(console.error).finally(() => {
      setTimeout(() => setLeaving(false), Math.max(0, 800 - (Date.now() - startedAt)))
    })
  }
  function openDm() {
    handleClose()
    window.dispatchEvent(new CustomEvent('pm:open-dm', {
      detail: { hostId: group.hostId, hostName: group.hostName, hostAvatarInitial: group.hostAvatarInitial, hostAvatarColor: group.hostAvatarColor },
    }))
  }
  function toggleFav() {
    if (activeUserId) {
      useFavoriteStore.getState().toggle(activeUserId, group.id)
      return
    }
    toast(LOCKED_MESSAGE, 'info', {
      action: {
        label: '前往登入',
        onClick: () => navigate('/login', { state: { from: location.pathname + location.search, reopenGroupModalId: group.id } }),
      },
    })
  }

  const reviews = (
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
      onDm={activeUserId && !isHost ? openDm : undefined}
      scrollable
      topPadding={!isDesktop}
      squareDmButton={isDesktop}
    />
  )

  const picksInner = (
    <>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-brand">
        <Sparkles size={16} strokeWidth={1.5} className="shrink-0" />
        其他推薦群組
      </h3>
      <div className="relative">
        {!picksAtStart && (
          <button
            type="button"
            onClick={() => scrollPicks(-1)}
            aria-label="往左看更多"
            className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-canvas text-ink-3 shadow-floating transition-colors hover:bg-raised hover:text-ink can-hover:grid"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
        )}
        <div
          ref={picksScrollCallbackRef}
          onScroll={handlePicksScroll}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {picks.map(g => (
            <div key={g.id} className="w-full shrink-0 snap-center">
              <ExploreGroupCard group={g} isApplied={appliedGroupIds.has(g.id)} isMember={memberGroupIds.has(g.id)} />
            </div>
          ))}
        </div>
        {!picksAtEnd && (
          <button
            type="button"
            onClick={() => scrollPicks(1)}
            aria-label="往右看更多"
            className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-canvas text-ink-3 shadow-floating transition-colors hover:bg-raised hover:text-ink can-hover:grid"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </>
  )

  const showDesktopAside = isDesktop && !showMembers;
  const hideRecruitBarBase = isHost || group.status !== 'recruiting'
  const footerCta = buildMobileFooter({
    group, activeUserId, navigate, handleClose,
    isHost, isWaitingMembers, needsFillInfo, hasServiceInfoIssue,
    isSharedCredentials: service?.sharingMethod === 'shared_credentials',
    isMember, isPendingApp, isFull, canApply, isFav,
    setCancelConfirm,
    setShowMembers, setLeaveConfirm, onApplyClick: handleApplyClick, toggleFav,
    padded: !showDesktopAside,
    redirectAfterLogin: { from: location.pathname + location.search, reopenGroupModalId: group.id },
  })

  return (
    <>

      <ApplyModal
        group={group}
        isOpen={showApply}
        onClose={resetApply}
        applyMessage={applyMessage}
        setApplyMessage={setApplyMessage}
        applyAgreed={applyAgreed}
        setApplyAgreed={setApplyAgreed}
        applying={applying}
        onApply={handleApply}
      />

      {leaving ? (
        <GroupModalShell loading onClose={handleClose} group={group} service={service} plan={plan} desktopAsideTop={isDesktop ? true : undefined} />
      ) : (membershipRefreshing ? loadingGuess.isMember : isMember && !isHost) ? (
        <MemberGroupView loading={membershipRefreshing} group={group} onLeaveGroup={handleLeave} onClose={handleClose} autoOpenCredentialsTick={autoOpenCredentialsTick} autoOpenReviewTick={autoOpenReviewTick} autoScrollToComments={autoScrollToComments} onAutoScrollToCommentsDone={() => setAutoScrollToComments(false)} />
      ) : membershipRefreshing ? (
        <GroupModalShell
          loading
          onClose={handleClose}
          group={group}
          service={service}
          plan={plan}
          desktopAsideTop={loadingGuess.wide ? true : undefined}
        />
      ) : !showApply && (
        <GroupModalShell
          onClose={handleClose}
          group={group}
          service={service}
          plan={plan}
          hideRecruitBar={hideRecruitBarBase || showDesktopAside}
          extraInfoRows={[]}
          statusBadgeOverride={
            getMemberJoinedBadgeVariant(group.status, isMember) ??
            (isPendingApp ? { variant: 'pending', label: '審核中' } : undefined)
          }
          subPanel={showMembers ? buildMembersSubPanel({ group, groupId, members, activeUserId, setShowMembers, openDm }) : null}
          onSubPanelBack={() => { setShowMembers(false); resetApply() }}
          panelKey={showMembers ? 'members' : `overview-${groupId}`}
          headerBanner={
            isWaitingMembers ? (
              <div className="flex items-center justify-center gap-2 bg-success-subtle px-6 py-3 text-sm font-medium text-success-text">
                <CheckCircle2 strokeWidth={1.5} size={15} />
                {group.status === 'full' ? '招募完成，等待團主鎖定群組' : '已通過申請，需等待其他人加入'}
              </div>
            ) : isPendingApp ? (
              <div className="flex items-center justify-center gap-2 bg-warning-subtle px-6 py-3 text-sm font-medium text-warning-text">
                <CheckCircle2 strokeWidth={1.5} size={15} />已送出申請，等待團主審核
              </div>
            ) : undefined
          }
          mobileReviewsSection={showDesktopAside ? undefined : reviews}
          mobileFooter={showDesktopAside ? undefined : footerCta}
          afterColumns={picks.length > 0 && (
            <div className="border-t border-line px-6 pb-4 pt-5">{picksInner}</div>
          )}
          desktopAsideTop={showDesktopAside && reviews}
          desktopAsideBottom={showDesktopAside && (
            <div className="space-y-4">
              {!hideRecruitBarBase && <GroupPriceSeatSummary group={group} />}
              {footerCta}
            </div>
          )}
        >
        </GroupModalShell>
      )}

      {leaveConfirm && (
        <ConfirmActionDialog
          title="確認退出群組？"
          message={`退出後將釋出名額，且需等待 1 分鐘後才能重新申請加入「${group?.serviceName}」。`}
          confirmLabel="退出群組"
          danger
          onConfirm={handleLeave}
          onCancel={() => setLeaveConfirm(false)}
        />
      )}

      {cancelConfirm && (
        <ConfirmActionDialog
          title="確認取消申請？"
          message={`取消後代管的PM幣將會退還，需重新申請才能加入「${group?.serviceName}」。`}
          confirmLabel="取消申請"
          danger
          onConfirm={handleCancel}
          onCancel={() => setCancelConfirm(false)}
        />
      )}
    </>
  );
}
