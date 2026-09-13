import { useEffect, useRef, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import { Toaster } from '../components/ui/sonner'
import { ThemeProvider } from '../components/theme-provider'
import LoadingScreen from '../common/layout/LoadingScreen'
import { useAuthStore } from '../common/stores/useAuthStore'
import { useAdminAuthStore } from '../common/stores/useAdminAuthStore'
import { useServiceStore } from '../common/stores/useServiceStore'
import { useGroupStore } from '../common/stores/useGroupStore'
import { useApplicationStore } from '../common/stores/useApplicationStore'
import { useSubscriptionStore } from '../common/stores/useSubscriptionStore'
import { useMemberStore } from '../common/stores/useMemberStore'
import { useFavoriteStore } from '../common/stores/useFavoriteStore'
import { useNotificationStore } from '../common/stores/useNotificationStore'
import { usePendingRefreshStore } from '../common/stores/usePendingRefreshStore'
import { useOpenGroupStore } from '../common/stores/useOpenGroupStore'
import { useModalStackStore } from '../common/stores/useModalStackStore'
import { useConversationStore } from '../common/stores/useConversationStore'
import { toast, dismissToast } from '../common/utils/toast'
import { getNotificationToastId, isToastSuppressed, BACKGROUND_NOTIFICATION_TOAST_DURATION, INSTANT_NOTIFICATION_TOAST_DURATION } from '../common/utils/notificationToast'
import { useVersionCheck } from '../common/utils/versionCheck'
import { usePresenceAutoStatus } from '../common/utils/presence'
import { useRefreshGroupsOnFocus } from '../common/utils/groupFreshness'

function useIosFixedPositionScrollFix() {
  useEffect(() => {
    const html = document.documentElement
    let wasLocked = html.style.overflowY === 'hidden'
    const observer = new MutationObserver(() => {
      const isLocked = html.style.overflowY === 'hidden'
      if (isLocked && !wasLocked) {
        requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY))
      }
      wasLocked = isLocked
    })
    observer.observe(html, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])
}

export default function App() {
  const [ready, setReady] = useState(false)
  const bootedRef = useRef(false)
  const loggedIn = useAuthStore(s => s.loggedIn)
  useIosFixedPositionScrollFix()
  useVersionCheck()
  usePresenceAutoStatus(loggedIn)
  useRefreshGroupsOnFocus()

  useEffect(() => {
    function onRefreshMemberStores() {
      const user = useAuthStore.getState().getProfile()
      if (!user) return
      useGroupStore.getState().init({ all: true })
      useMemberStore.getState().init()
      useSubscriptionStore.getState().init()
      useApplicationStore.getState().init()
    }

    const STORE_REFRESHERS = {
      group:        () => useGroupStore.getState().init({ all: true }),
      member:       () => useMemberStore.getState().init(),
      subscription: () => useSubscriptionStore.getState().init(),
      application:  () => useApplicationStore.getState().init(),
    };

    let pendingToastIds = new Set();
    const pendingGroupToastIds = new Map();

    function registerGroupToast(groupId, toastId, page) {
      if (!groupId || page !== '/manage-groups') return
      if (!pendingGroupToastIds.has(groupId)) pendingGroupToastIds.set(groupId, new Set())
      pendingGroupToastIds.get(groupId).add(toastId)
    }

    const unsubscribeHostOpenGroup = useOpenGroupStore.subscribe(state => {
      const groupId = state.hostOpenGroupId
      const toastIds = groupId && pendingGroupToastIds.get(groupId)
      if (!toastIds) return
      toastIds.forEach(id => { dismissToast(id); pendingToastIds.delete(id) })
      pendingGroupToastIds.delete(groupId)
    });

    const pendingMemberGroupToastIds = new Map();

    function registerMemberGroupToast(groupId, toastId, page) {
      if (!groupId || page !== '/my-subscriptions') return
      if (!pendingMemberGroupToastIds.has(groupId)) pendingMemberGroupToastIds.set(groupId, new Set())
      pendingMemberGroupToastIds.get(groupId).add(toastId)
    }

    const unsubscribeMemberOpenGroup = useOpenGroupStore.subscribe(state => {
      const groupId = state.memberOpenGroupId
      const toastIds = groupId && pendingMemberGroupToastIds.get(groupId)
      if (!toastIds) return
      toastIds.forEach(id => { dismissToast(id); pendingToastIds.delete(id) })
      pendingMemberGroupToastIds.delete(groupId)
    })

    async function runPendingRefresh() {
      const user = useAuthStore.getState().getProfile()
      const pending = usePendingRefreshStore.getState().pending
      const refreshes = user
        ? [...pending].map(store => STORE_REFRESHERS[store]?.()).filter(Boolean)
        : []
      usePendingRefreshStore.getState().clear()
      pendingToastIds.forEach(id => dismissToast(id))
      pendingToastIds = new Set()
      pendingGroupToastIds.clear()
      pendingMemberGroupToastIds.clear();
      await Promise.all(refreshes);
    }

    async function runPendingRefreshAndOpen(openAction, { reveal = false } = {}) {
      useModalStackStore.getState().push()
      try {
        await runPendingRefresh()
        if (reveal) usePendingRefreshStore.getState().bumpRefreshTick()
        openAction()
      } finally {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          useModalStackStore.getState().pop()
        }))
      }
    }

    const TOAST_ACTIONS = {
      new_application: {
        label:   '前往查看',
        run:     (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId, openApplications: true } }))
        },
      },
      application_cancelled: {
        label:   '前往查看',
        run:     (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId, openApplications: true } }))
        },
      },
      application_rejected: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
        },
      },
      application_approved: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
        },
      },
      member_removed: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
        },
      },
      group_cancelled: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
        },
      },
      group_full_member: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
        },
      },
      group_full: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId } }))
        },
      },
      all_service_info_filled: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId, openMemberInfo: true } }))
        },
      },
      member_left: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId, openMembers: true } }))
        },
      },
      group_activated: {
        label: '前往查看',
        run:   (meta) => {
          if (!meta?.groupId) return
          const grp = useGroupStore.getState().getById(meta.groupId)
          const userId = useAuthStore.getState().user?.id
          if (grp && grp.hostId === userId) {
            window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId } }))
          } else {
            window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
          }
        },
      },
    };

    function onRefreshStores(event) {
      const user = useAuthStore.getState().getProfile()
      if (!user) return
      const { stores = [], notifId, type, meta, title, message, silent, page } = event.detail ?? {}
      usePendingRefreshStore.getState().mark(stores, meta?.groupId)
      if (silent)
        return;

      if (type === 'group_full' && meta?.groupId && useOpenGroupStore.getState().hostOpenGroupId === meta.groupId) {
        return
      }

      if (meta?.groupId && isToastSuppressed(type, meta.groupId)) {
        return
      }

      const toastAction = TOAST_ACTIONS[type];
      const toastId = getNotificationToastId({ type, meta, id: notifId }) ?? 'pm-pending-data-refresh';
      pendingToastIds.add(toastId)
      registerGroupToast(meta?.groupId, toastId, page)
      registerMemberGroupToast(meta?.groupId, toastId, page)

      toast(title || message || '有群組或申請狀態更新了', 'info', {
        id: toastId,
        duration: BACKGROUND_NOTIFICATION_TOAST_DURATION,
        action: {
          label: toastAction?.label ?? '重新整理',
          onClick: () => runPendingRefreshAndOpen(() => {
            toastAction?.run(meta)
          }, { reveal: !toastAction }),
        },
      })
    }
    const openMemberInfoAction = {
      label: '前往查看',
      run:   (meta) => {
        if (!meta?.groupId)
          return;
        window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: meta.groupId, openMemberInfo: true } }));
      },
    };
    const openGroupAction = {
      label: '前往查看',
      run:   (meta) => {
        if (!meta?.groupId) return
        window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: meta.groupId } }))
      },
    }
    const INSTANT_TOAST_ACTIONS = {
      credential_extraction_started: openMemberInfoAction,
      service_info_filled:           openMemberInfoAction,
      member_confirmed_service:      openMemberInfoAction,
      dispute_raised:                openMemberInfoAction,
      dispute_resolved_by_host:      openGroupAction,
    }
    function onNotifyToast(event) {
      const user = useAuthStore.getState().getProfile()
      if (!user) return
      const { type, meta, title, message } = event.detail ?? {}
      if (meta?.groupId && isToastSuppressed(type, meta.groupId)) {
        return
      }
      const toastAction = INSTANT_TOAST_ACTIONS[type]
      toast(title || message || '有新的通知', 'info', {
        id: getNotificationToastId({ type, meta, id: undefined }) ?? undefined,
        duration: toastAction ? BACKGROUND_NOTIFICATION_TOAST_DURATION : INSTANT_NOTIFICATION_TOAST_DURATION,
        action: toastAction && {
          label: toastAction.label,
          onClick: () => toastAction.run(meta),
        },
      })
    }
    window.addEventListener('pm:refresh-member-stores', onRefreshMemberStores)
    window.addEventListener('pm:refresh-stores', onRefreshStores)
    window.addEventListener('pm:notify-toast', onNotifyToast)
    return () => {
      window.removeEventListener('pm:refresh-member-stores', onRefreshMemberStores)
      window.removeEventListener('pm:refresh-stores', onRefreshStores)
      window.removeEventListener('pm:notify-toast', onNotifyToast)
      unsubscribeHostOpenGroup()
      unsubscribeMemberOpenGroup()
    }
  }, [])

  useEffect(() => {
    if (bootedRef.current)
      return;
    bootedRef.current = true

    async function bootApp() {
      await Promise.all([
        useAuthStore.getState().init(),
        useAdminAuthStore.getState().init(),
        useServiceStore.getState().init(),
        useGroupStore.getState().init({ all: false }),
        useNotificationStore.getState().init(),
      ]);

      const failedPublicStores = [
        useGroupStore.getState().error,
        useNotificationStore.getState().error,
      ].filter(Boolean)
      if (failedPublicStores.length > 0) {
        toast('部分資料載入失敗，請重新整理頁面', 'error', { id: 'pm-boot-load-failed', persistent: true })
      }

      setReady(true);

      const user = useAuthStore.getState().getProfile();
      if (user) {
        Promise.all([
          useGroupStore.getState().init({ all: true }),
          useApplicationStore.getState().init(),
          useSubscriptionStore.getState().init(),
          useMemberStore.getState().init(),
          useFavoriteStore.getState().init(),
        ]).then(() => {
          const failedPrivateStores = [
            useGroupStore.getState().error,
            useApplicationStore.getState().error,
            useSubscriptionStore.getState().error,
            useMemberStore.getState().error,
            useFavoriteStore.getState().error,
          ].filter(Boolean);
          if (failedPrivateStores.length > 0) {
            toast('部分資料載入失敗，請重新整理頁面', 'error', { id: 'pm-boot-load-failed', persistent: true })
          }
          useConversationStore.getState().init(user.id);
          useNotificationStore.getState().startPolling(user.id)
        });
      }
    }

    bootApp().catch(err => {
      console.error('[App] Init failed:', err)
      toast('應用程式初始化失敗，請重新整理頁面', 'error', { persistent: true })
      setReady(true)
    })
  }, [])

  if (!ready) {
    return <LoadingScreen />
  }

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  )
}
