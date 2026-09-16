import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Archive, ClipboardList } from 'lucide-react'
import { useSubscriptionStore } from '../../common/stores/useSubscriptionStore'
import { useMemberStore } from '../../common/stores/useMemberStore'
import { useApplicationStore } from '../../common/stores/useApplicationStore'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { usePendingRefreshStore } from '../../common/stores/usePendingRefreshStore'
import SubscriptionCard from './components/SubscriptionCard'
import EmptyState from '../../components/ui/primitives/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { getStatusLabel } from '../../components/ui/statusBadgeConfig'
import { StatCell, StatCellGrid } from '../../components/ui/group/StatCellGrid'
import GroupCardHeader from '../../components/ui/group/GroupCardHeader'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import RevealSection from '../../components/ui/primitives/RevealSection'
import { toISODate, byNewest } from '../../common/utils/date'
import { isHistorySubscription } from '../../common/utils/groupStatusDisplay'
import GroupHistoryModal from '../../components/ui/group/GroupHistoryModal'
import { useDeferWhileModalOpen } from '../../common/utils/hooks'
import { UpdateDot } from '../../common/layout/components/navShared'

const getGroupById = (id) => useGroupStore.getState().getById(id)

function enrichSubs(rawSubs, userId) {
  const myMemberByGroupId = new Map(
    useMemberStore.getState().members.filter(m => m.userId === userId).map(m => [m.groupId, m])
  )
  return rawSubs.map(s => {
    const group = getGroupById(s.groupId)
    const member = myMemberByGroupId.get(s.groupId)
    if (!group) {
      return {
        ...s,
        groupStatus:          s.groupStatus ?? s.status,
        confirmedAt:          member?.confirmedAt ?? null,
        serviceInfo:          member?.serviceInfo ?? null,
        serviceInfoIssueNote: member?.serviceInfoIssueNote ?? null,
      }
    }
    return {
      ...s,
      groupStatus:       group.status,
      confirmedAt:       member?.confirmedAt ?? null,
      serviceInfo:          member?.serviceInfo ?? null,
      serviceInfoIssueNote: member?.serviceInfoIssueNote ?? null,
      serviceName:       s.serviceName  || group.serviceName,
      serviceId:         s.serviceId    || group.serviceId,
      planName:          s.planName     || group.planName,
      pricePerSeat:      s.pricePerSeat || group.pricePerSeat,
      billingCycle:      s.billingCycle || group.billingCycle,
      hostName:          s.hostName     || group.hostName,
      hostAvatarInitial: s.hostAvatarInitial || group.hostAvatarInitial,
      hostAvatarColor:   s.hostAvatarColor   || group.hostAvatarColor,
      usedSeats:         group.usedSeats,
      totalSeats:        group.totalSeats,
    }
  })
}

function filterSubs(subs) {
  return subs.filter(s => !isHistorySubscription(s))
}

function hasPendingMemberAction(sub) {
  if (sub.groupStatus === 'confirming' && !sub.confirmedAt) return true
  if (sub.groupStatus === 'disputed' && sub.serviceInfoIssueNote) return true
  return false
}

export default function SubscriptionsPage() {
  const navigate = useNavigate()
  const [historyOpen, setHistoryOpen] = useState(false)
  const closeHistory = () => setHistoryOpen(false)
  const location = useLocation()
  const activeUser = useAuthStore(s => s.user)
  const activeUserId = activeUser?.id ?? null;

  const refreshTick = usePendingRefreshStore(s => s.refreshTick);
  const pendingGroupIds = usePendingRefreshStore(s => s.pendingGroupIds)

  const subscriptionsState = useDeferWhileModalOpen(useSubscriptionStore(s => s.subscriptions));
  const groupsState        = useDeferWhileModalOpen(useGroupStore(s => s.groups))
  const applicationsState  = useDeferWhileModalOpen(useApplicationStore(s => s.applications))
  const membersState = useDeferWhileModalOpen(useMemberStore(s => s.members))
  const subs = useMemo(
    () => activeUserId
      ? enrichSubs(subscriptionsState.filter(s => s.userId === activeUserId), activeUserId).sort(byNewest)
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeUserId, subscriptionsState, groupsState, membersState],
  )
  useEffect(() => {
    function onForceRefresh(e) {
      if (e.detail?.path !== '/my-subscriptions') return
      useSubscriptionStore.getState().init()
      useGroupStore.getState().init({ all: true })
      useApplicationStore.getState().init()
      useMemberStore.getState().init()
    }
    window.addEventListener('pm:force-page-refresh', onForceRefresh)
    return () => window.removeEventListener('pm:force-page-refresh', onForceRefresh)
  }, []);

  useEffect(() => {
    if (location.state?.openGroupId) {
      window.dispatchEvent(new CustomEvent('pm:open-group', {
        detail: { groupId: location.state.openGroupId, openCredentials: !!location.state.openCredentials },
      }))
    }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingApplications = useMemo(
    () => activeUserId
      ? applicationsState.filter(a => (a.applicantId ?? a.userId) === activeUserId && a.status === 'pending').sort(byNewest)
      : [],
    [activeUserId, applicationsState],
  )

  const historySubs = useMemo(() => subs.filter(isHistorySubscription), [subs])

  const filtered = useMemo(
    () => filterSubs(subs),
    [subs],
  )

  const onViewGroup = useCallback(
    sub => window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: sub.groupId } })),
    [],
  );

  const historyReopenRef = useRef(null);
  useEffect(() => {
    const pending = historyReopenRef.current
    if (!pending) return
    const currentGroupId = new URLSearchParams(location.search).get('group')
    if (currentGroupId === pending.groupId) {
      pending.opened = true
      return
    }
    if (pending.opened && !currentGroupId) {
      historyReopenRef.current = null
      setHistoryOpen(true)
    }
  }, [location.search])

  return (
    <div className="px-2 md:px-4">
      <h1 className="page-title mb-6 text-center">我的訂閱</h1>

      <div className="fixed bottom-9 left-6 z-40 can-hover:lg:left-auto can-hover:lg:right-6 can-hover:lg:bottom-24">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          aria-label="訂閱紀錄"
          className="relative grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-floating transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand lg:h-12 lg:w-12 dark:border-[#238EC7] dark:text-[#238EC7]"
        >
          <Archive className="size-6 lg:size-5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="min-w-0">
        {(() => {
          const isEmpty = pendingApplications.length === 0 && filtered.length === 0

          if (isEmpty) {
            return (
              <EmptyState
                icon={ClipboardList}
                title="你還沒有加入任何群組"
                description="去探索頁面找找適合你的共享群組"
                actionLabel="探索群組"
                onAction={() => navigate('/explore')}
              />
            )
          }

          return (
            <div key={refreshTick} className="grid grid-cols-1 gap-3 p-2 md:grid-cols-2 xl:grid-cols-3">
              {pendingApplications.map((app, i) => {
                const group = getGroupById(app.groupId)
                if (!group) return null
                return (
                  <RevealSection key={app.id} delay={i * 60}>
                    <ApplicationCard
                      app={app}
                      group={group}
                      hasPendingUpdate={pendingGroupIds.has(app.groupId)}
                      onViewGroup={() => window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: app.groupId } }))}
                    />
                  </RevealSection>
                )
              })}
              {filtered.map((sub, i) => (
                <RevealSection key={sub.id} delay={(pendingApplications.length + i) * 60}>
                  <SubscriptionCard
                    sub={sub}
                    hasPendingUpdate={pendingGroupIds.has(sub.groupId) || hasPendingMemberAction(sub)}
                    onViewGroup={onViewGroup}
                  />
                </RevealSection>
              ))}
            </div>
          )
        })()}
      </div>
      <GroupHistoryModal
        isOpen={historyOpen}
        onClose={closeHistory}
        items={historySubs}
        title="訂閱紀錄"
        emptyDescription="已結束或已取消的訂閱會顯示在這裡"
        renderItem={(sub, i) => (
          <RevealSection key={sub.id} delay={i * 60}>
            <SubscriptionCard
              sub={sub}
              hasPendingUpdate={pendingGroupIds.has(sub.groupId) || hasPendingMemberAction(sub)}
              onViewGroup={sub => {
                historyReopenRef.current = { groupId: sub.groupId, opened: false }
                closeHistory()
                onViewGroup(sub)
              }}
            />
          </RevealSection>
        )}
      />
    </div>
  );
}

function ApplicationCard({ app, group, hasPendingUpdate, onViewGroup }) {
  const isLastSeat = group.openSeats === 1
  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={onViewGroup}
    >
      <GroupCardHeader
        badge={<StatusBadge status="pending" label="審核中" />}
        serviceId={app.serviceId}
        serviceName={app.serviceName ?? app.groupName}
        planName={app.planName}
        pricePerSeat={group.pricePerSeat}
        billingCycle={group.billingCycle}
      />

      <StatCellGrid>
        <StatCell label="團主">{app.hostName ?? '—'}</StatCell>
        <StatCell label="剩餘名額">
          {group.totalSeats == null ? (
            '—'
          ) : group.openSeats <= 0 ? (
            <span className="text-ink-3">{getStatusLabel('full')}</span>
          ) : (
            <>
              <span className={isLastSeat ? 'text-warning-text' : 'text-success'}>{group.openSeats}</span>
              <span className="text-ink-4"> / {group.totalSeats}</span>
            </>
          )}
        </StatCell>
        <StatCell label="申請日期">{toISODate(app.createdAt)}</StatCell>
      </StatCellGrid>

      <div className="mt-auto pt-5">
        <div className="relative">
          <Button onClick={e => { e.stopPropagation(); onViewGroup?.() }} className="w-full">
            查看群組
          </Button>
          <UpdateDot show={hasPendingUpdate} />
        </div>
      </div>
    </Card>
  )
}
