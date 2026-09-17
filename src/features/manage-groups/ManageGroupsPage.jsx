import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive } from 'lucide-react'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { useNotificationStore } from '../../common/stores/useNotificationStore'
import { usePendingRefreshStore } from '../../common/stores/usePendingRefreshStore'
import { useOpenGroupStore } from '../../common/stores/useOpenGroupStore'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { useApplicationStore } from '../../common/stores/useApplicationStore'
import { useMemberStore } from '../../common/stores/useMemberStore'
import EmptyState from '../../components/ui/primitives/EmptyState'
import GroupHistoryModal from '../../components/ui/group/GroupHistoryModal'
import RevealSection from '../../components/ui/primitives/RevealSection'
import HostedGroupCard from './components/HostedGroupCard'
import { useHostActions } from './hooks/useHostActions'
import { useDeferWhileModalOpen } from '../../common/utils/hooks'
import { hostGroupNeedsAttention } from '../../common/utils/hostGroupDisplay'

export default function ManageGroupsPage() {
  const activeUser = useAuthStore(s => s.user)
  const [historyOpen, setHistoryOpen] = useState(false)
  const closeHistory = () => setHistoryOpen(false);

  const refreshTick = usePendingRefreshStore(s => s.refreshTick);
  const pendingGroupIds = usePendingRefreshStore(s => s.pendingGroupIds);

  const notifications = useNotificationStore(s => s.notifications);
  const unseenServiceInfoGroupIds = useMemo(
    () => new Set(
      notifications
        .filter(n => n.type === 'service_info_filled' && n.userId === activeUser?.id && !n.isRead && n.meta?.groupId)
        .map(n => n.meta.groupId)
    ),
    [notifications, activeUser?.id]
  );
  const unseenCredentialCommentGroupIds = useMemo(
    () => new Set(
      notifications
        .filter(n => n.type === 'credential_comment' && n.userId === activeUser?.id && !n.isRead && n.meta?.groupId)
        .map(n => n.meta.groupId)
    ),
    [notifications, activeUser?.id]
  );

  const {
    displayGroups: liveDisplayGroups, historyGroups: liveHistoryGroups,
    membersMap: liveMembersMap, applicationCounts: liveApplicationCounts,
    groupHandlersMap,
    refreshGroups,
  } = useHostActions(activeUser, { manageModal: false });
  const displayGroups = useDeferWhileModalOpen(liveDisplayGroups)
  const historyGroups = useDeferWhileModalOpen(liveHistoryGroups)
  const membersMap = useDeferWhileModalOpen(liveMembersMap)
  const applicationCounts = useDeferWhileModalOpen(liveApplicationCounts);

  function hasPendingUpdate(group) {
    return pendingGroupIds.has(group.id) ||
      hostGroupNeedsAttention(group, {
        pendingAppCount: applicationCounts[group.id] ?? 0,
        hasUnseenServiceInfo: unseenServiceInfoGroupIds.has(group.id),
        hasUnseenCredentialComment: unseenCredentialCommentGroupIds.has(group.id),
      })
  }

  useEffect(() => {
    function onForceRefresh(e) {
      if (e.detail?.path !== '/manage-groups') return
      useGroupStore.getState().init({ all: true })
      useApplicationStore.getState().init()
      useMemberStore.getState().init()
    }
    window.addEventListener('pm:force-page-refresh', onForceRefresh)
    return () => window.removeEventListener('pm:force-page-refresh', onForceRefresh)
  }, []);

  const historyReopenRef = useRef(null);
  const hostOpenGroupId = useOpenGroupStore(s => s.hostOpenGroupId)
  useEffect(() => {
    const pending = historyReopenRef.current
    if (!pending) return
    if (hostOpenGroupId === pending.groupId) {
      pending.opened = true
      return
    }
    if (pending.opened && hostOpenGroupId === null) {
      historyReopenRef.current = null
      setHistoryOpen(true)
    }
  }, [hostOpenGroupId])

  return (
    <div className="px-2 md:px-4">
      <h1 className="page-title mb-6 text-center">群組管理</h1>

      <div className="fixed bottom-9 left-6 z-40 can-hover:lg:left-auto can-hover:lg:right-6 can-hover:lg:bottom-24">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          aria-label="管理紀錄"
          className="relative grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-floating transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand lg:h-12 lg:w-12 dark:border-[#238EC7] dark:text-[#238EC7]"
        >
          <Archive className="size-6 lg:size-5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="min-w-0">
        {displayGroups.length === 0 ? (
          <EmptyState
            title="你還沒有建立任何群組"
            description="建立你的第一個共享群組"
            actionLabel="建立第一個群組"
            onAction={() => window.dispatchEvent(new CustomEvent('pm:open-create-group'))}
          />
        ) : (
          <div key={refreshTick} className="grid grid-cols-1 gap-3 p-2 md:grid-cols-2 xl:grid-cols-3">
            {displayGroups.map((g, i) => (
              <RevealSection key={g.id} delay={i * 60}>
                <HostedGroupCard
                  group={g}
                  members={membersMap[g.id] ?? []}
                  pendingAppCount={applicationCounts[g.id] ?? 0}
                  paymentCount={0}
                  hasPendingUpdate={hasPendingUpdate(g)}
                  {...groupHandlersMap[g.id]}
                />
              </RevealSection>
            ))}
          </div>
        )}
      </div>
      <GroupHistoryModal
        isOpen={historyOpen}
        onClose={closeHistory}
        items={historyGroups}
        title="管理紀錄"
        emptyDescription="已解散或已結束的群組會顯示在這裡"
        renderItem={(g, i) => (
          <RevealSection key={g.id} delay={i * 60}>
            <HostedGroupCard
              group={g}
              members={membersMap[g.id] ?? []}
              pendingAppCount={applicationCounts[g.id] ?? 0}
              paymentCount={0}
              hasPendingUpdate={hasPendingUpdate(g)}
              onViewGroup={() => {
                historyReopenRef.current = { groupId: g.id, opened: false }
                closeHistory()
                refreshGroups()
                window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: g.id } }))
              }}
            />
          </RevealSection>
        )}
      />
    </div>
  );
}
