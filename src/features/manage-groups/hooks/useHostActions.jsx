import { useEffect, useMemo, useState } from 'react'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useApplicationStore } from '../../../common/stores/useApplicationStore'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { useSubscriptionStore } from '../../../common/stores/useSubscriptionStore'
import { createGroupConversation, removeParticipantFromConversation, sendSystemMessage } from '../../../common/api/messagesApi'
import { toast } from '../../../common/utils/toast'
import { suppressNextToast, BACKGROUND_NOTIFICATION_TOAST_DURATION } from '../../../common/utils/notificationToast'
import { useConversationStore } from '../../../common/stores/useConversationStore'
import { useNotificationStore } from '../../../common/stores/useNotificationStore'
import { isHistoryGroup } from '../../../common/utils/groupStatusDisplay'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { isSharedCredentialsMethod } from '../../../common/utils/serviceInfoFields'
import { PANEL_OPENED_EVENT, broadcastPanelOpened } from '../../../common/utils/panelBroadcast'
import ServiceLogo from '../../../components/ui/ServiceLogo'

const getGroupById     = (id)      => useGroupStore.getState().getById(id);
const getGroupsByHostId = (hostId) => useGroupStore.getState().getByHostId(hostId)
const lockGroup           = (id, sharedCredentials) => useGroupStore.getState().lockGroup(id, sharedCredentials)
const activateService     = (id, nextBillingDate) => useGroupStore.getState().activateService(id, nextBillingDate)
const adjustBillingDate   = (id, payload) => useGroupStore.getState().adjustBillingDate(id, payload)
const startRenewalCycle = (id, renewingUserIds) => useGroupStore.getState().startRenewalCycle(id, renewingUserIds)
const endGroup         = (id)      => useGroupStore.getState().endGroup(id)

const getApplicationByUserAndGroup = (uid, gid)   => useApplicationStore.getState().getByUserAndGroup(uid, gid)
const getApplicationsByHostId      = (hid, grps)  => useApplicationStore.getState().getByHostId(hid, grps)
const updateApplicationStatus      = (id, status) => useApplicationStore.getState().updateStatus(id, status)

const getMembersByGroupId        = (gid)    => useMemberStore.getState().getByGroupId(gid)
const isUserGroupMember          = (uid, gid) => useMemberStore.getState().isMember(uid, gid)
const removeMember               = (id)     => useMemberStore.getState().remove(id)

const getSubscriptionByUserAndGroup   = (uid, gid) => useSubscriptionStore.getState().getByUserAndGroup(uid, gid)
const removeSubscription              = (id)     => useSubscriptionStore.getState().removeLocal(id)

const addConversationOptimistic  = (conv)    => useConversationStore.getState().addConversationOptimistic(conv)
const getConvByGroupId           = (gid)     => useConversationStore.getState().getByGroupId(gid)

function warnIfCredentialsExposed(group, message) {
  if (group?.sharedCredentials && isSharedCredentialsMethod(getServiceById(group.serviceId)?.sharingMethod)) {
    toast(message, 'warning', { id: `pm-credentials-exposed-${group.id}`, persistent: true });
  }
}

function loadHostData(activeUser) {
  if (!activeUser) return { hostedGroups: [], applications: [], members: [], seatMap: {} }
  const hostedGroups = getGroupsByHostId(activeUser.id)
  const applications = getApplicationsByHostId(activeUser.id, hostedGroups)
  const members      = hostedGroups.flatMap(g => getMembersByGroupId(g.id))
  const seatMap      = Object.fromEntries(
    hostedGroups.map(g => [g.id, { usedSeats: g.usedSeats, openSeats: g.openSeats }])
  )
  return { hostedGroups, applications, members, seatMap }
}

export function useHostActions(activeUser, { manageModal = true } = {}) {
  const groupsState        = useGroupStore(s => s.groups);
  const applicationsState  = useApplicationStore(s => s.applications)
  const membersState       = useMemberStore(s => s.members)

  const [hostData, setHostData] = useState(() => loadHostData(activeUser))
  const [errors, setErrors] = useState({})
  const [submittingIds, setSubmittingIds] = useState(new Set())

  const [viewGroupId, setViewGroupId]                     = useState(null)
  const [autoOpenLockGroup, setAutoOpenLockGroup] = useState(false)
  const [autoOpenActivate, setAutoOpenActivate]           = useState(false)
  const [autoOpenApplications, setAutoOpenApplications]   = useState(false)
  const [autoOpenBilling, setAutoOpenBilling]             = useState(false)
  const [autoOpenMemberInfo, setAutoOpenMemberInfo]       = useState(false)
  const [autoOpenMembers, setAutoOpenMembers]             = useState(false)
  const [autoOpenReview, setAutoOpenReview]               = useState(false)
  const [autoExpandMemberId, setAutoExpandMemberId]       = useState(null)
  const [autoScrollToComments, setAutoScrollToComments]   = useState(false)
  const [renewalModalGroupId, setRenewalModalGroupId]     = useState(null)

  function applyOpenHostGroup({ groupId, openGroupId, openLockGroup, openActivate, openApplications, openBilling, openMemberInfo, openMembers, openReview, expandMemberId, scrollToComments }) {
    const gId = groupId ?? openGroupId
    if (!gId) return
    window.dispatchEvent(new CustomEvent('pm:close-group-detail'))
    setViewGroupId(gId)
    setAutoOpenLockGroup(!!openLockGroup)
    setAutoOpenActivate(!!openActivate)
    setAutoOpenApplications(!!openApplications)
    setAutoOpenBilling(!!openBilling)
    setAutoOpenMemberInfo(!!openMemberInfo)
    setAutoOpenMembers(!!openMembers)
    setAutoOpenReview(!!openReview)
    setAutoExpandMemberId(expandMemberId ?? null)
    setAutoScrollToComments(!!scrollToComments)
    broadcastPanelOpened('host-group')
  }

  useEffect(() => {
    if (!manageModal) return
    function onOpenHostGroup(e) { applyOpenHostGroup(e.detail ?? {}) }
    window.addEventListener('pm:open-host-group', onOpenHostGroup)
    return () => window.removeEventListener('pm:open-host-group', onOpenHostGroup)
  }, [manageModal]);

  useEffect(() => {
    if (!manageModal) return
    function onCloseHostGroup() {
      setViewGroupId(null)
      setAutoOpenLockGroup(false)
      setAutoOpenActivate(false)
      setAutoOpenApplications(false)
      setAutoOpenBilling(false)
      setAutoOpenMemberInfo(false)
      setAutoOpenMembers(false)
      setAutoOpenReview(false)
      setAutoExpandMemberId(null)
      setAutoScrollToComments(false)
    }
    function onPanelOpened(e) {
      if (e.detail?.panelId !== 'host-group') onCloseHostGroup()
    }
    window.addEventListener('pm:close-host-group', onCloseHostGroup)
    window.addEventListener(PANEL_OPENED_EVENT, onPanelOpened)
    return () => {
      window.removeEventListener('pm:close-host-group', onCloseHostGroup)
      window.removeEventListener(PANEL_OPENED_EVENT, onPanelOpened)
    }
  }, [manageModal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeUser) setHostData(loadHostData(activeUser))
  }, [activeUser, groupsState, applicationsState, membersState]);


  const { hostedGroups, applications, members, seatMap } = hostData

  const allGroups = useMemo(
    () => hostedGroups.map(g => ({ ...g, ...(seatMap[g.id] ?? {}) })),
    [hostedGroups, seatMap],
  )

  const displayGroups = useMemo(
    () => allGroups.filter(g => !isHistoryGroup(g)),
    [allGroups],
  )

  const historyGroups = useMemo(
    () => allGroups.filter(isHistoryGroup),
    [allGroups],
  )

  const membersMap = useMemo(
    () => members.reduce((acc, m) => {
      ;(acc[m.groupId] ??= []).push(m)
      return acc
    }, {}),
    [members],
  )

  const applicationCounts = useMemo(() => {
    const counts = {}
    applications.forEach(a => {
      if (a.status === 'pending') counts[a.groupId] = (counts[a.groupId] ?? 0) + 1
    })
    return counts
  }, [applications])


  const getModalGroup = id => id ? allGroups.find(g => g.id === id) : null
  const renewalModalGroup = getModalGroup(renewalModalGroupId)

  function refreshGroups() {
    setHostData(prev => ({ ...prev, hostedGroups: getGroupsByHostId(activeUser.id) }))
  }

async function handleLockGroup(sharedCredentials) {
    if (!viewGroupId) return
    const group = getGroupById(viewGroupId)
    if (!group) return
    const groupMembers = getMembersByGroupId(viewGroupId)

    let lockSucceeded = false
    try {
      await lockGroup(viewGroupId, sharedCredentials)
      lockSucceeded = true
      const conv = await createGroupConversation({ groupId: viewGroupId });
      const convId = conv.id

      const participantMeta = {
        [group.hostId]: { name: group.hostName, avatarInitial: group.hostAvatarInitial, avatarColor: group.hostAvatarColor },
        ...Object.fromEntries(groupMembers.map(m => [m.userId, { name: m.userName, avatarInitial: m.userAvatarInitial, avatarColor: m.userAvatarColor }])),
      };
      addConversationOptimistic({
        id:           convId,
        type:         'group',
        groupId:      viewGroupId,
        hostId:       group.hostId,
        name:         group.serviceName ?? viewGroupId,
        serviceId:    group.serviceId ?? null,
        participants: [group.hostId, ...groupMembers.map(m => m.userId)],
        participantMeta,
        unreadCounts: { [group.hostId]: 0 },
        lastMessage:  '',
        lastMessageAt: null,
      })

      setViewGroupId(null)
      return true
    } catch (err) {
      const viewAction = {
        label: '前往查看',
        onClick: () => window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: viewGroupId } })),
      }
      if (!lockSucceeded && err?.response?.status === 400) {
        await useMemberStore.getState().init().catch(console.error);
        const freshMemberIds = new Set(getMembersByGroupId(viewGroupId).map(m => m.userId))
        let leftNames = groupMembers.filter(m => !freshMemberIds.has(m.userId)).map(m => m.userName).filter(Boolean)
        if (leftNames.length === 0) {
          const recentLeftNotif = useNotificationStore.getState().notifications
            .filter(n => n.type === 'member_left' && n.meta?.groupId === viewGroupId)
            .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
          const parsedName = recentLeftNotif?.message?.match(/^(.+?)\s*已退出/)?.[1]
          if (parsedName) leftNames = [parsedName]
        }
        const namePart = leftNames.length > 0 ? leftNames.join('、') : '有成員';
        suppressNextToast('member_left', viewGroupId);
        toast(`鎖定失敗，${namePart}已退出`, 'info', {
          id: `pm-member_left-${viewGroupId}`,
          duration: BACKGROUND_NOTIFICATION_TOAST_DURATION,
        })
        window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: viewGroupId, openMembers: true } }))
        useGroupStore.getState().refreshGroup(viewGroupId).catch(console.error)
        return true
      }
      if (lockSucceeded) {
        setViewGroupId(null)
        toast('群組已鎖定，但聊天室建立失敗，請稍後再試', 'error', { action: viewAction })
        return true
      }
      toast('鎖定群組失敗，請稍後再試', 'error', { action: viewAction })
      return false
    }
  }

function handleRemoveMember(member) {
    const group = getGroupById(member.groupId);
    const removalDone = removeMember(member.id)
      .then(() => useGroupStore.getState().refreshGroup(member.groupId))
      .catch(console.error);
    const app = getApplicationByUserAndGroup(member.userId, member.groupId)
    if (app) updateApplicationStatus(app.id, 'removed')
    const sub = getSubscriptionByUserAndGroup(member.userId, member.groupId)
    if (sub) removeSubscription(sub.id)

    const convId = getConvByGroupId(member.groupId)?.id;
    if (convId) {
      sendSystemMessage(convId, `${member.userName} 已被移出群組`).catch(console.error)
      removeParticipantFromConversation(convId, member.userId).catch(console.error)
    }

    warnIfCredentialsExposed(group, '該成員已看過帳號密碼，建議盡快更改密碼避免帳號被繼續使用')

    return removalDone
  }

async function handleActivate(nextBillingDate) {
    if (!viewGroupId) return
    const group = getGroupById(viewGroupId)
    if (!group) return

    try {
      await activateService(viewGroupId, nextBillingDate || undefined)
    } catch {
      toast('啟用失敗，請稍後再試', 'error')
      return
    }

    setViewGroupId(null);
    refreshGroups()
  }

  async function handleAdjustBillingDate(nextBillingDate, note) {
    if (!viewGroupId) return
    const group = getGroupById(viewGroupId)
    if (!group) return

    try {
      await adjustBillingDate(viewGroupId, { nextBillingDate, note })
    } catch (err) {
      toast('調整失敗，請稍後再試', 'error')
      throw err
    }

    const convId = getConvByGroupId(viewGroupId)?.id
    if (convId) sendSystemMessage(convId, `團主調整了扣款日期，原因：${note}`).catch(console.error)

    toast('已調整扣款日期')
    refreshGroups()
  }

  function buildDisputeErrorToastOptions(groupId, err) {
    if (err?.response?.data?.code !== 'DISPUTE_ALREADY_CLAIMED') return undefined
    return {
      action: {
        label: '重新整理',
        onClick: () => window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId, openMemberInfo: true } })),
      },
    }
  }

  async function handleResolveDispute(groupId, memberId, note) {
    try {
      await useGroupStore.getState().resolveDispute(groupId, { memberId, note })
      toast('已標記問題處理完成')
    } catch (err) {
      toast(err?.message ?? '處理失敗，請稍後再試', 'error', buildDisputeErrorToastOptions(groupId, err))
    }
  }

  async function handleEscalateDispute(groupId, memberId, note) {
    try {
      await useGroupStore.getState().escalateDispute(groupId, { memberId, note })
      toast('問題回報將由平台介入處理', 'success', {
        action: {
          label: '前往查看',
          onClick: () => window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId, openMemberInfo: true } })),
        },
      })
    } catch (err) {
      toast(err?.message ?? '處理失敗，請稍後再試', 'error', buildDisputeErrorToastOptions(groupId, err))
    }
  }

  async function handleCancelGroup() {
    if (!viewGroupId) return
    const group = getGroupById(viewGroupId)
    if (!group) return

    try {
      await useGroupStore.getState().cancelGroup(viewGroupId)
    } catch {
      toast('解散失敗，請稍後再試', 'error')
      return
    }

    warnIfCredentialsExposed(group, '所有成員都已看過帳號密碼，建議盡快更改密碼避免帳號被繼續使用')

    setViewGroupId(null)
    refreshGroups()
  }

  async function handleStartRenewal(renewingUserIds) {
    if (!renewalModalGroupId) return
    try {
      await startRenewalCycle(renewalModalGroupId, renewingUserIds)
    } catch {
      toast('開始新一期失敗，請稍後再試', 'error')
      return
    }
    await useMemberStore.getState().init().catch(console.error);
    const convId = getConvByGroupId(renewalModalGroupId)?.id
    if (convId) sendSystemMessage(
      convId, `新一期已開始，請重新填寫訂閱帳號資訊。`
    ).catch(console.error)
    setRenewalModalGroupId(null);
    refreshGroups()
  }

  function handleEndGroup() {
    if (!renewalModalGroupId) return
    const group = getGroupById(renewalModalGroupId)
    const groupLabel = group?.groupName ?? group?.serviceName ?? '群組'

    endGroup(renewalModalGroupId)

    const endConvId = getConvByGroupId(renewalModalGroupId)?.id;
    if (endConvId) sendSystemMessage(endConvId, `團主已結束「${groupLabel}」群組`).catch(console.error)

    warnIfCredentialsExposed(group, '所有成員都已看過帳號密碼，建議盡快更改密碼避免帳號被繼續使用')

    setRenewalModalGroupId(null)
    refreshGroups()
  }

async function handleApprove(appId) {
    const app = applications.find(a => a.id === appId)
    if (!app) return
    if (app.status !== 'pending') {
      toast('此申請已被處理，請重新整理頁面', 'info')
      return
    }
    if (submittingIds.has(appId)) return

    const group = getGroupById(app.groupId) ?? allGroups.find(g => g.id === app.groupId)
    if (!group) {
      setErrors(prev => ({ ...prev, [appId]: '找不到群組資料，無法接受' }))
      return
    }

    const applicantId = app.applicantId ?? app.userId
    const alreadyMember = isUserGroupMember(applicantId, app.groupId)
    const seats = seatMap[app.groupId] ?? { usedSeats: group.usedSeats, openSeats: group.openSeats }
    if (!alreadyMember && (!seats || seats.openSeats <= 0)) {
      setErrors(prev => ({ ...prev, [appId]: '此群組已額滿，無法接受' }))
      return
    }

    setSubmittingIds(prev => new Set(prev).add(appId))
    try {
      await updateApplicationStatus(appId, 'approved')
    } catch (err) {
      console.error('[handleApprove] failed:', err)
      toast('接受失敗，請稍後再試', 'error');
      setErrors(prev => ({ ...prev, [appId]: '接受失敗，請稍後再試' }))
      await useApplicationStore.getState().init()
      return
    } finally {
      setSubmittingIds(prev => { const next = new Set(prev); next.delete(appId); return next })
    }
    await Promise.all([
      useMemberStore.getState().init(),
      useSubscriptionStore.getState().init(),
      useGroupStore.getState().refreshGroup(app.groupId),
    ])

    toast('已接受申請', 'success');

    setHostData(prev => ({
      ...prev,
      applications: prev.applications.map(a => a.id === appId ? { ...a, status: 'approved' } : a),
    }));
    removeError(appId)
  }

  async function handleReportServiceInfoIssue(member, note, evidenceUrl) {
    await useGroupStore.getState().reportServiceInfoIssue(member.groupId, { memberId: member.id, note, evidenceUrl })
    refreshGroups();
  }

  async function handleWithdrawServiceInfoIssue(member) {
    const group = getGroupById(member.groupId)
    const groupLabel = group?.planName ?? group?.serviceName ?? '群組'
    try {
      await useGroupStore.getState().withdrawServiceInfoIssue(member.groupId, member.id)
      toast(
        <span className="flex min-w-0 items-baseline gap-1 overflow-hidden whitespace-nowrap">
          <span className="min-w-0 truncate">{groupLabel}</span>
          <span className="shrink-0">已撤銷問題回報</span>
        </span>,
        'success',
        { icon: group?.serviceId ? <ServiceLogo serviceId={group.serviceId} size={20} /> : undefined }
      )
      refreshGroups();
    } catch (err) {
      toast(err?.message ?? '撤銷失敗，請稍後再試', 'error')
    }
  }

  async function handleReject(appId) {
    const app = applications.find(a => a.id === appId)
    if (!app) return
    if (app.status !== 'pending') {
      toast('此申請已被處理，請重新整理頁面', 'info')
      return
    }
    if (submittingIds.has(appId)) return

    setSubmittingIds(prev => new Set(prev).add(appId))
    try {
      await updateApplicationStatus(appId, 'rejected')
    } catch (err) {
      console.error('[handleReject] failed:', err)
      toast('拒絕失敗，請稍後再試', 'error');
      setErrors(prev => ({ ...prev, [appId]: '拒絕失敗，請稍後再試' }))
      await useApplicationStore.getState().init()
      return
    } finally {
      setSubmittingIds(prev => { const next = new Set(prev); next.delete(appId); return next })
    }

    useGroupStore.getState().refreshGroup(app.groupId).catch(console.error);

    toast('已拒絕申請', 'success');

    setHostData(prev => ({
      ...prev,
      applications: prev.applications.map(a => a.id === appId ? { ...a, status: 'rejected' } : a),
    }));
    removeError(appId)
  }

  function removeError(id) {
    setErrors(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  const groupHandlersMap = useMemo(
    () => Object.fromEntries(displayGroups.map(g => [g.id, {
      onViewGroup:   () => {
        refreshGroups();
        window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: g.id } }));
      },
    }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayGroups],
  )

  return {
    errors,
    submittingIds,
    viewGroupId, setViewGroupId,
    autoOpenLockGroup, setAutoOpenLockGroup,
    autoOpenActivate, setAutoOpenActivate,
    autoOpenApplications, setAutoOpenApplications,
    autoOpenBilling, setAutoOpenBilling,
    autoOpenMemberInfo, setAutoOpenMemberInfo,
    autoOpenMembers, setAutoOpenMembers,
    autoOpenReview, setAutoOpenReview,
    autoExpandMemberId, setAutoExpandMemberId,
    autoScrollToComments, setAutoScrollToComments,
    renewalModalGroupId, setRenewalModalGroupId,
    allGroups, displayGroups, historyGroups, membersMap, applicationCounts,
    renewalModalGroup,
    groupHandlersMap,
    refreshGroups,
    handleLockGroup,
    handleRemoveMember,
    handleActivate,
    handleAdjustBillingDate,
    handleCancelGroup,
    handleStartRenewal,
    handleEndGroup,
    handleApprove,
    handleReportServiceInfoIssue,
    handleWithdrawServiceInfoIssue,
    handleResolveDispute,
    handleEscalateDispute,
    handleReject,
  }
}
