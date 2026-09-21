import { create } from 'zustand'
import {
  readAllNotifications,
  patchNotification,
  deleteNotificationsByIds,
} from '../api/notificationsApi'
import { useAuthStore } from './useAuthStore'
import { todayISO, byNewest } from '../utils/date'
import { startPolling } from '../utils/poller'
import { notifyError } from '../utils/toast'

const POLL_INTERVAL_MS = 5000
const MAX_TOAST_AGE_MS = 10 * 60 * 1000

let _stopPolling = null
let _notifUserId = null;

const SYSTEM_NOTIFICATION_TYPES = new Set(['system']);

const NOTIFICATION_REFRESH_STORES = {
  member_removed:          ['group', 'member', 'subscription'],
  member_left:              ['group', 'member'],
  member_left_self:         ['group', 'member', 'subscription'],
  group_cancelled:          ['group', 'member', 'subscription', 'application'],
  application_approved:     ['group', 'member', 'subscription', 'application'],
  application_rejected:     ['application'],
  service_info_filled:      ['group', 'member'],
  all_service_info_filled:  ['group', 'member'],
  group_activated:          ['group', 'member'],
  billing_date_confirmed:   ['group', 'member'],
  billing_date_adjusted:    ['group', 'member'],
  group_full_member:        ['group', 'member'],
  escrow_released_member:   ['group', 'member'],
  new_application:          ['application'],
  application_cancelled:    ['application'],
  application_sent:         ['application'],
  group_full:                ['group'],
  group_activation_expired:  ['group', 'member'],
};

const NOTIFICATION_REFRESH_PAGE = {
  member_removed: '/my-subscriptions',
  member_left: '/manage-groups',
  member_left_self: '/explore',
  group_cancelled: '/my-subscriptions',
  application_approved: '/my-subscriptions',
  application_rejected: '/my-subscriptions',
  service_info_filled: '/manage-groups',
  all_service_info_filled: '/manage-groups',
  billing_date_confirmed: '/my-subscriptions',
  billing_date_adjusted:    '/my-subscriptions',
  group_full_member: '/my-subscriptions',
  escrow_released_member: '/my-subscriptions',
  new_application: '/manage-groups',
  application_cancelled: '/manage-groups',
  application_sent: '/my-subscriptions',
  group_full: '/manage-groups',
  group_activation_expired: '/manage-groups',
};

const SILENT_REFRESH_TYPES = new Set(['application_sent', 'billing_date_confirmed']);

function dedupeById(list) {
  const seen = new Set()
  return list.filter(n => {
    if (seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })
}

function getFallbackSystemNotifications() {
  return [
    {
      id:        'system_guest_welcome',
      userId:    'system',
      type:      'system',
      title:     '歡迎來到 PartyMatch',
      message:   '你可以先探索群組與使用條件搜尋；登入後即可收藏、訂閱、建立與管理群組。',
      isRead:    true,
      createdAt: todayISO(),
      isPublic:  true,
    },
  ]
}

export function isSystemNotification(notification) {
  return (
    SYSTEM_NOTIFICATION_TYPES.has(notification.type) ||
    notification.isPublic === true ||
    !notification.userId
  )
}

function isPublicSystemNotification(notification) {
  const isPublic = notification.isPublic === true || !notification.userId
  return isPublic && isSystemNotification(notification)
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  loading:       false,
  error:         null,

  init: async () => {
    set({ loading: true, error: null })
    try {
      const notifications = await readAllNotifications()
      set({ notifications: dedupeById(notifications), loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  startPolling: (userId) => {
    if (_stopPolling) _stopPolling()
    _notifUserId = userId;

    _stopPolling = startPolling(async (isActive) => {
      if (!_notifUserId) return
      const polledForUserId = _notifUserId
      try {
        const latest = await readAllNotifications()
        if (!isActive() || _notifUserId !== polledForUserId)
          return;
        const currentIds = new Set(useNotificationStore.getState().notifications.map(n => n.id))
        const newNotifs = latest.filter(n => n.userId === _notifUserId && !currentIds.has(n.id));
        const approvedGroupIds = new Set(
          newNotifs.filter(n => n.type === 'application_approved').map(n => n.meta?.groupId).filter(Boolean)
        );
        const fillServiceInfoGroupIds = new Set(
          newNotifs.filter(n => n.type === 'fill_service_info').map(n => n.meta?.groupId).filter(Boolean)
        );
        function isSilent(n) {
          return SILENT_REFRESH_TYPES.has(n.type) ||
            (n.type === 'group_full_member' && approvedGroupIds.has(n.meta?.groupId)) ||
            (n.type === 'group_chat_opened' && fillServiceInfoGroupIds.has(n.meta?.groupId)) ||
            Date.now() - new Date(n.createdAt).getTime() > MAX_TOAST_AGE_MS
        }
        newNotifs.forEach(n => {
          const stores = NOTIFICATION_REFRESH_STORES[n.type]
          if (!stores?.length) {
            if (isSilent(n)) return
            window.dispatchEvent(new CustomEvent('pm:notify-toast', {
              detail: { type: n.type, meta: n.meta, title: n.title, message: n.message },
            }))
            return
          }
          window.dispatchEvent(new CustomEvent('pm:refresh-stores', {
            detail: {
              stores, notifId: n.id, type: n.type, meta: n.meta, title: n.title, message: n.message,
              silent: isSilent(n),
              page:   NOTIFICATION_REFRESH_PAGE[n.type],
            },
          }))
        });
        const BALANCE_AFFECTING_TYPES = new Set(['member_removed', 'member_left_self', 'application_rejected', 'escrow_released', 'dispute_resolved', 'group_cancelled']);
        if (newNotifs.some(n => BALANCE_AFFECTING_TYPES.has(n.type))) {
          useAuthStore.getState().refreshTokenBalance().catch(console.error)
        }
        set({ notifications: dedupeById(latest) })
      } catch (err) {
        console.error('[notification poll]', err)
      }
    }, POLL_INTERVAL_MS)
  },

  teardown: () => {
    if (_stopPolling) { _stopPolling(); _stopPolling = null }
    _notifUserId = null
    set({ notifications: [] })
  },

  getByUserId: (userId) =>
    get().notifications.filter(n => n.userId === userId).sort(byNewest),

  getSystemNotifications: () => {
    const systemNotifications = get().notifications
      .filter(isPublicSystemNotification)
      .sort(byNewest)
    return systemNotifications.length > 0 ? systemNotifications : getFallbackSystemNotifications()
  },

  getRealSystemNotifications: () =>
    get().notifications.filter(isPublicSystemNotification).sort(byNewest),

  getUnreadCount: (userId) => {
    if (!userId) return 0
    return get().notifications.filter(n => n.userId === userId && !n.isRead).length
  },

  getUnreadCountForGroup: (userId, groupId) => {
    if (!userId || !groupId) return 0
    return get().notifications.filter(n => n.userId === userId && !n.isRead && n.meta?.groupId === groupId).length
  },

  getUnseenServiceInfoCount: (userId, groupId) => {
    if (!userId || !groupId) return 0
    return get().notifications.filter(
      n => n.type === 'service_info_filled' && n.userId === userId && n.meta?.groupId === groupId && !n.isRead
    ).length
  },

  hasUnseenCredentialComment: (userId, groupId) => {
    if (!userId || !groupId) return false
    return get().notifications.some(
      n => n.type === 'credential_comment' && n.userId === userId && n.meta?.groupId === groupId && !n.isRead
    )
  },

  markReadForGroup: (userId, groupId) => {
    if (!userId || !groupId) return
    get().notifications
      .filter(n => n.userId === userId && !n.isRead && n.meta?.groupId === groupId)
      .forEach(n => get().markRead(n.id))
  },

  markReadForGroupAndType: (userId, groupId, type) => {
    if (!userId || !groupId || !type) return
    get().notifications
      .filter(n => n.userId === userId && !n.isRead && n.meta?.groupId === groupId && n.type === type)
      .forEach(n => get().markRead(n.id))
  },

  markRead: (id) => {
    const prior = get().notifications.find(n => n.id === id) ?? null
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
    }))
    patchNotification(id).catch(err => {
      if (prior) set(s => ({ notifications: s.notifications.map(n => n.id === id ? prior : n) }))
      notifyError(err, '標記已讀失敗，請稍後再試')
    })
  },

  deleteByIds: async (ids) => {
    if (!ids?.length) return
    const idSet = new Set(ids)
    const prior = get().notifications
    set(s => ({
      notifications: s.notifications.filter(n => !idSet.has(n.id)),
    }))
    try {
      await deleteNotificationsByIds(ids)
    } catch (err) {
      set({ notifications: prior })
      notifyError(err, '刪除通知失敗，請稍後再試')
    }
  },
}))
