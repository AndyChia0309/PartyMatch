import {
  AlertTriangle, Bell, CalendarCheck, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardEdit,
  Flag, KeyRound, LogOut, Megaphone, MessageSquare, PlayCircle, RefreshCw, Rocket, RotateCcw, Send, ShieldCheck,
  Sparkles, Star, Undo2, UserMinus, UserPlus, Users, Wallet, XCircle,
} from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { useApplicationStore } from '../stores/useApplicationStore'
import { useGroupStore } from '../stores/useGroupStore'
import { useMemberStore } from '../stores/useMemberStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useSubscriptionStore } from '../stores/useSubscriptionStore'
import { useModalStackStore } from '../stores/useModalStackStore'
import { toast, dismissToast } from '../utils/toast'
import { getNotificationToastId } from '../utils/notificationToast'
import { getServiceById } from '../utils/serviceUtils'
import { isSharedCredentialsMethod } from '../utils/serviceInfoFields'

const getGroupById = (id) => useGroupStore.getState().getById(id)
const getCurrentUser = () => useAuthStore.getState().user
const getSubscriptionByUserAndGroup = (uid, gid) => useSubscriptionStore.getState().getByUserAndGroup(uid, gid)

function openHostGroup(groupId, extra) {
  window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId, ...extra } }))
}

async function openGroupOrRedirect(groupId) {
  await useGroupStore.getState().init({ all: true })
  const grp = getGroupById(groupId)
  if (!grp || grp.status !== 'recruiting') {
    toast('此群組已額滿或不再招募', 'info')
    return
  }
  window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId } }))
}

function navigateToMemberGroupOrExplore(navigate, userId, groupId, extraDetail) {
  return Promise.all([
    useMemberStore.getState().init(),
    useGroupStore.getState().init({ all: true }),
  ]).finally(() => {
    if (userId && useMemberStore.getState().getByUserAndGroup(userId, groupId)) {
      window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId, ...extraDetail } }));
    } else {
      navigate('/explore')
      return openGroupOrRedirect(groupId)
    }
  });
}

function withReservedModal(action) {
  useModalStackStore.getState().push()
  const release = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    useModalStackStore.getState().pop()
  }))
  Promise.resolve(action()).finally(release)
}

export const NOTIFICATION_META = {
  application_approved:     { icon: CheckCircle2,  iconColor: 'text-success', link: '/my-subscriptions' },
  application_rejected:     { icon: XCircle,        iconColor: 'text-danger',  link: '/explore' },
  application_sent:         { icon: Send,           iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  group_created:            { icon: Sparkles,       iconColor: 'text-success', link: '/manage-groups' },
  new_application:          { icon: UserPlus,       iconColor: 'text-ink-3',   link: '/manage-groups' },
  application_cancelled:    { icon: Undo2,          iconColor: 'text-ink-3',   link: '/manage-groups' },
  group_full:               { icon: Users,          iconColor: 'text-ink-3',   link: '/manage-groups' },
  group_full_member:        { icon: Users,          iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  group_chat_opened:        { icon: MessageSquare,  iconColor: 'text-ink-3',   link: null },
  fill_service_info:        { icon: ClipboardEdit,  iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  service_info_filled:      { icon: ClipboardCheck, iconColor: 'text-success', link: '/manage-groups' },
  credential_extraction_started: { icon: KeyRound,  iconColor: 'text-ink-3',   link: '/manage-groups' },
  all_service_info_filled:  { icon: PlayCircle,     iconColor: 'text-success', link: '/manage-groups' },
  service_info_deadline_passed: { icon: AlertTriangle, iconColor: 'text-danger', link: '/manage-groups' },
  group_activated:          { icon: Rocket,         iconColor: 'text-success', link: '/my-subscriptions' },
  group_cancelled:          { icon: XCircle,        iconColor: 'text-danger',  link: '/explore' },
  group_renewal:            { icon: RefreshCw,      iconColor: 'text-success', link: '/my-subscriptions' },
  upcoming_renewal:         { icon: CalendarClock,  iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  service_info_issue:       { icon: AlertTriangle,  iconColor: 'text-danger',  link: '/my-subscriptions' },
  group_ended:              { icon: Flag,           iconColor: 'text-ink-3',   link: '/explore' },
  member_removed:           { icon: UserMinus,      iconColor: 'text-danger',  link: '/explore' },
  member_left:              { icon: LogOut,         iconColor: 'text-ink-3',   link: '/manage-groups' },
  escrow_released:          { icon: Wallet,         iconColor: 'text-success', link: '/manage-groups' },
  escrow_released_member:   { icon: Wallet,         iconColor: 'text-success', link: '/my-subscriptions' },
  dispute_raised:           { icon: AlertTriangle,  iconColor: 'text-danger',  link: '/manage-groups' },
  dispute_resolved:         { icon: ShieldCheck,    iconColor: 'text-success', link: '/my-subscriptions' },
  dispute_resolved_by_host: { icon: ShieldCheck,    iconColor: 'text-success', link: '/my-subscriptions' },
  dispute_withdrawn:        { icon: Undo2,          iconColor: 'text-ink-3',   link: '/manage-groups' },
  dispute_escalated:        { icon: AlertTriangle,  iconColor: 'text-danger',  link: '/manage-groups' },
  dispute_withdraw_requested: { icon: Undo2,        iconColor: 'text-warning-text', link: '/manage-groups' },
  dispute_withdraw_rejected:  { icon: XCircle,      iconColor: 'text-danger', link: '/my-subscriptions' },
  billing_date_confirmed:   { icon: CalendarCheck,  iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  billing_date_adjusted:    { icon: CalendarClock,  iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  member_confirmed_service: { icon: CheckCircle2,   iconColor: 'text-success', link: '/manage-groups' },
  group_reviewed:           { icon: Star,           iconColor: 'text-ink-3',   link: '/manage-groups' },
  account_reactivated:      { icon: RotateCcw,      iconColor: 'text-success', link: '/' },
  payment_reminder:         { icon: Wallet,         iconColor: 'text-ink-3',   link: '/my-subscriptions' },
  system:                   { icon: Megaphone,      iconColor: 'text-ink-3',   link: '/' },
  default:                  { icon: Bell,           iconColor: 'text-ink-3',   link: '/my-subscriptions' },
}

export function getMeta(type) {
  return NOTIFICATION_META[type] ?? NOTIFICATION_META.default
}

const FALLBACK_NOTIFICATION_IDS = new Set(['system_guest_welcome']);

export function handleNotificationClick(notification, { userId, navigate, setOpen }) {
  if (FALLBACK_NOTIFICATION_IDS.has(notification.id)) {
    setOpen(false)
    return
  }

  if (!userId) {
    const link = getMeta(notification.type).link
    if (link && !['/my-subscriptions', '/manage-groups', '/favorites'].includes(link)) {
      setOpen(false)
      if (link === '/') {
        window.location.replace('/')
      } else {
        navigate(link)
      }
    }
    return
  }

  useNotificationStore.getState().markRead(notification.id)
  setOpen(false);
  const toastId = getNotificationToastId(notification);
  if (toastId) dismissToast(toastId)

  if (notification.type === 'group_chat_opened' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const grp = getGroupById(gId)
    if (grp && grp.hostId === userId) {
      withReservedModal(() => useGroupStore.getState().init({ all: true }).finally(() => {
        openHostGroup(gId)
      }))
    } else {
      withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, gId));
    }
    return
  }

  if (notification.type === 'fill_service_info' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId))
    return
  }

  if (notification.type === 'service_info_issue' && notification.meta?.groupId) {
    withReservedModal(() => useGroupStore.getState().init({ all: true }).finally(() => {
      const grp = getGroupById(notification.meta.groupId)
      const isSharedCredentials = isSharedCredentialsMethod(getServiceById(grp?.serviceId)?.sharingMethod)
      navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId, isSharedCredentials ? { openCredentials: true } : undefined)
    }));
    return
  }

  if (notification.type === 'group_created' && notification.meta?.groupId) {
    openHostGroup(notification.meta.groupId)
    return
  }

  if (notification.type === 'application_sent' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const user = getCurrentUser()
    withReservedModal(() => Promise.all([
      useSubscriptionStore.getState().init(),
      useApplicationStore.getState().init(),
      useGroupStore.getState().init({ all: true }),
    ]).finally(() => {
      const hasSub = user ? !!getSubscriptionByUserAndGroup(user.id, gId) : false
      const grp = getGroupById(gId);
      if (hasSub || (grp && grp.status === 'recruiting')) {
        window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: gId } }))
      } else {
        toast('此群組已額滿或不再招募', 'info')
      }
    }));
    return
  }

  if (notification.type === 'application_rejected') {
    const gId = notification.meta?.groupId
    navigate('/explore');
    useAuthStore.getState().refreshTokenBalance().catch(console.error);
    if (gId) {
      withReservedModal(() => useApplicationStore.getState().init().finally(() => openGroupOrRedirect(gId)))
    } else {
      useApplicationStore.getState().init()
    }
    return
  }

  if (notification.type === 'member_left') {
    if (notification.meta?.groupId) {
      withReservedModal(() => new Promise(resolve => {
        window.dispatchEvent(new CustomEvent('pm:refresh-member-stores'));
        openHostGroup(notification.meta.groupId, { openMembers: true })
        resolve()
      }))
    } else {
      navigate('/my-subscriptions');
    }
    return
  }

  if (notification.type === 'member_removed' && notification.meta?.groupId) {
    useAuthStore.getState().refreshTokenBalance().catch(console.error);
    useAuthStore.getState().refreshCreditScore().catch(console.error);
    withReservedModal(() => new Promise(resolve => {
      window.dispatchEvent(new CustomEvent('pm:refresh-member-stores'))
      window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: notification.meta.groupId } }))
      resolve()
    }))
    return
  }

  if (notification.type === 'application_approved' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const user = getCurrentUser()
    withReservedModal(() => Promise.all([
      useSubscriptionStore.getState().init(),
      useMemberStore.getState().init(),
      useApplicationStore.getState().init(),
      useGroupStore.getState().init({ all: true }),
    ]).finally(() => {
      const hasSub = user ? !!getSubscriptionByUserAndGroup(user.id, gId) : false
      if (hasSub) {
        window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: gId } }))
      } else {
        navigate('/explore')
        return openGroupOrRedirect(gId)
      }
    }));
    return
  }

  if (notification.type === 'new_application' && notification.meta?.groupId) {
    withReservedModal(() => useApplicationStore.getState().init().finally(() => {
      openHostGroup(notification.meta.groupId, { openApplications: true })
    }))
    return
  }

  if (notification.type === 'service_info_filled' && notification.meta?.groupId) {
    withReservedModal(() => useMemberStore.getState().init().finally(() => {
      openHostGroup(notification.meta.groupId, { openMemberInfo: true })
    }));
    return
  }

  if (notification.type === 'credential_extraction_started' && notification.meta?.groupId) {
    withReservedModal(() => useMemberStore.getState().init().finally(() => {
      openHostGroup(notification.meta.groupId, { openMemberInfo: true })
    }));
    return
  }

  if (notification.type === 'application_cancelled' && notification.meta?.groupId) {
    withReservedModal(() => useApplicationStore.getState().init().finally(() => {
      openHostGroup(notification.meta.groupId, { openApplications: true })
    }))
    return
  }

  if (notification.type === 'group_full' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId)
    }));
    return
  }

  if (notification.type === 'group_full_member' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId))
    return
  }

  if (notification.type === 'all_service_info_filled' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId, { openMemberInfo: true })
    }));
    return
  }

  if (notification.type === 'member_confirmed_service' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => useMemberStore.getState().init().finally(() => {
      openHostGroup(gId, { openMemberInfo: true })
    }));
    return
  }

  if (notification.type === 'group_reviewed' && notification.meta?.groupId) {
    openHostGroup(notification.meta.groupId)
    return
  }

  if (notification.type === 'service_info_deadline_passed' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
      useApplicationStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId)
    }));
    return
  }

  if (notification.type === 'escrow_released' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    useAuthStore.getState().refreshTokenBalance().catch(console.error);
    withReservedModal(() => useGroupStore.getState().init({ all: true }).finally(() => {
      openHostGroup(gId, { openBilling: true })
    }));
    return
  }

  if (notification.type === 'escrow_released_member' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId))
    return
  }

  if (notification.type === 'dispute_raised' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId, { openMemberInfo: true, expandMemberId: notification.meta?.memberId })
    }))
    return
  }

  if (notification.type === 'dispute_withdrawn' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId, { openMemberInfo: true })
    }))
    return
  }

  if (notification.type === 'dispute_withdraw_requested' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    withReservedModal(() => Promise.all([
      useGroupStore.getState().init({ all: true }),
      useMemberStore.getState().init(),
    ]).finally(() => {
      openHostGroup(gId, { openMemberInfo: true, expandMemberId: notification.meta?.memberId })
    }))
    return
  }

  if (notification.type === 'dispute_withdraw_rejected' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId));
    return
  }

  if (notification.type === 'dispute_escalated' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const grp = getGroupById(gId)
    if (grp && grp.hostId === userId) {
      withReservedModal(() => Promise.all([
        useGroupStore.getState().init({ all: true }),
        useMemberStore.getState().init(),
      ]).finally(() => {
        openHostGroup(gId, { openMemberInfo: true })
      }))
    } else {
      withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, gId));
    }
    return
  }

  if (notification.type === 'dispute_resolved_by_host' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId));
    return
  }

  if (notification.type === 'dispute_resolved' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    useAuthStore.getState().refreshTokenBalance().catch(console.error);
    const grp = getGroupById(gId);
    if (grp && grp.hostId === userId) {
      withReservedModal(() => Promise.all([
        useGroupStore.getState().init({ all: true }),
        useMemberStore.getState().init(),
      ]).finally(() => {
        openHostGroup(gId)
      }))
    } else {
      withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, gId));
    }
    return
  }

  if (notification.type === 'group_activated' && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const grp = getGroupById(gId)
    if (grp && grp.hostId === userId) {
      withReservedModal(() => useGroupStore.getState().init({ all: true }).finally(() => {
        openHostGroup(gId, { openMemberInfo: true })
      }));
    } else {
      withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, gId))
    }
    return
  }

  if ((notification.type === 'billing_date_confirmed' || notification.type === 'billing_date_adjusted') && notification.meta?.groupId) {
    const gId = notification.meta.groupId
    const grp = getGroupById(gId)
    if (grp && grp.hostId === userId) {
      withReservedModal(() => useGroupStore.getState().init({ all: true }).finally(() => {
        openHostGroup(gId)
      }))
    } else {
      withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, gId))
    }
    return
  }

  if (notification.type === 'group_renewal' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId))
    return
  }

  if (notification.type === 'upcoming_renewal' && notification.meta?.groupId) {
    withReservedModal(() => navigateToMemberGroupOrExplore(navigate, userId, notification.meta.groupId))
    return
  }

  if (notification.type === 'group_cancelled') {
    useAuthStore.getState().refreshTokenBalance().catch(console.error);
    navigate('/explore')
    useGroupStore.getState().init({ all: true })
    return
  }

  const meta = getMeta(notification.type)
  if (!meta.link) return
  navigate(meta.link, meta.state ? { state: meta.state } : undefined)
}
