import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Megaphone } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription } from '../../components/ui/drawer'
import { Button } from '../../components/ui/button'
import { useAuthStore } from '../stores/useAuthStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useGroupStore } from '../stores/useGroupStore'
import { useMemberStore } from '../stores/useMemberStore'
import { formatRelativeDate } from '../utils/date'
import EmptyState from '../../components/ui/primitives/EmptyState'
import FilterSelect from '../../components/ui/primitives/FilterSelect'
import { useFilterSelectGroup } from '../../components/ui/primitives/useFilterSelectGroup'
import ServiceLogo from '../../components/ui/ServiceLogo'
import { UpdateDot } from './components/navShared'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuRadioSection, DropdownMenuFilterTrigger,
} from '../../components/ui/dropdown-menu'
import { handleNotificationClick } from './notificationClickHandlers'

function getMergedNotifications(userId) {
  const notifStore = useNotificationStore.getState()
  const personal = userId ? notifStore.getByUserId(userId) : []
  const system = notifStore.getRealSystemNotifications()
  const seen = new Set(personal.map(n => n.id))
  return [...personal, ...system.filter(n => !seen.has(n.id))].sort(
    (a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  )
}

const APPLY_TYPES   = ['joined', 'application_approved', 'application_rejected', 'application_sent', 'new_application', 'application_cancelled', 'application'];
const GROUP_TYPES    = ['group_created', 'group_activated', 'group_chat_opened', 'group_full', 'group_full_member', 'group_ended', 'group_cancelled', 'group_renewal', 'member_left', 'member_removed', 'member_confirmed_service', 'group_reviewed']
const BILLING_TYPES  = ['fill_service_info', 'service_info_filled', 'all_service_info_filled', 'service_info_deadline_passed', 'escrow_released', 'escrow_released_member', 'upcoming_renewal', 'billing_date_confirmed', 'billing_date_adjusted', 'payment_reminder']
const ISSUE_TYPES    = ['dispute_raised', 'dispute_resolved', 'dispute_resolved_by_host', 'service_info_issue'];

const TABS = [
  { id: 'all',     label: '全部', filter: () => true },
  { id: 'apply',   label: '申請', filter: n => APPLY_TYPES.includes(n.type) },
  { id: 'group',   label: '群組動態', filter: n => GROUP_TYPES.includes(n.type) },
  { id: 'billing', label: '帳單與扣款', filter: n => BILLING_TYPES.includes(n.type) },
  { id: 'issue',   label: '爭議與問題', filter: n => ISSUE_TYPES.includes(n.type) },
];

const BUCKET_SECTIONS = [
  { bucket: 'host',      label: '我管理的群組' },
  { bucket: 'member',    label: '已加入的群組' },
  { bucket: 'applicant', label: '申請中的群組' },
  { bucket: 'system',    label: '系統' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: '最新在前' },
  { id: 'oldest', label: '最舊在前' },
  { id: 'unread', label: '未讀優先' },
]

export default function NotificationCenter() {
  const navigate = useNavigate()
  const loggedIn = useAuthStore(s => s.loggedIn)
  const currentUser = useAuthStore(s => s.user)
  const userId = currentUser?.id
  const notificationsState = useNotificationStore(s => s.notifications);

  const groupsState = useGroupStore(s => s.groups)
  const membersState = useMemberStore(s => s.members)
  const memberGroupIds = useMemo(
    () => new Set(userId ? membersState.filter(m => m.userId === userId).map(m => m.groupId) : []),
    [membersState, userId],
  )

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest');
  const [activeCategory, setActiveCategory] = useState(null);
  const filterSelectGroup = useFilterSelectGroup();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (filterSelectGroup.openKey) setFilterMenuOpen(false)
  }, [filterSelectGroup.openKey])

  const notifications = useMemo(
    () => loggedIn
      ? getMergedNotifications(userId)
      : useNotificationStore.getState().getSystemNotifications(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loggedIn, userId, notificationsState],
  );

  const categories = useMemo(() => {
    const byGroup = new Map()
    notifications.forEach(n => {
      const groupId = n.meta?.groupId
      if (!groupId) return
      const group = groupsState.find(g => g.id === groupId)
      const label = group ? (group.planName || group.serviceName || '群組') : '已刪除的群組'
      const bucket = group?.hostId === userId
        ? 'host'
        : memberGroupIds.has(groupId)
          ? 'member'
          : 'applicant'
      const existing = byGroup.get(groupId)
      const hasUnread = (existing?.hasUnread ?? false) || !n.isRead
      if (!existing || String(n.createdAt ?? '') > String(existing.latestAt ?? '')) {
        byGroup.set(groupId, { key: groupId, groupId, serviceId: group?.serviceId ?? '', label, bucket, latestAt: n.createdAt, hasUnread })
      } else {
        existing.hasUnread = hasUnread
      }
    })
    const groupCategories = [...byGroup.values()].sort(
      (a, b) => String(b.latestAt ?? '').localeCompare(String(a.latestAt ?? ''))
    );
    const systemHasUnread = notifications.some(n => !n.meta?.groupId && !n.isRead)
    return [...groupCategories, { key: 'system', label: '系統', bucket: 'system', hasUnread: systemHasUnread }];
  }, [notifications, groupsState, userId, memberGroupIds]);

  useEffect(() => {
    function onOpen() {
      setActiveTab('all')
      setActiveCategory(null)
      setOpen(true)
    }
    window.addEventListener('pm:open-notify', onOpen)
    return () => window.removeEventListener('pm:open-notify', onOpen)
  }, [])

  const visibleTabs = useMemo(() => loggedIn ? TABS : [], [loggedIn])

  const unreadCount = useMemo(
    () => loggedIn ? notifications.filter(n => !n.isRead).length : 0,
    [loggedIn, notifications]
  );

  const anyCategoryUnread = useMemo(() => categories.some(c => c.hasUnread), [categories])

  const effectiveCategory = activeCategory ?? categories[0]?.key ?? null;
  const selectedCategory = categories.find(c => c.key === effectiveCategory) ?? null

  const categoryGroups = useMemo(() => {
    function toItem(cat) {
      return {
        value: cat.key,
        label: cat.label,
        hasUnread: !!cat.hasUnread,
        icon: cat.key === 'system'
          ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[22%] border border-line bg-white text-brand">
              <Megaphone size={11} strokeWidth={1.5} />
            </span>
          )
          : <ServiceLogo serviceId={cat.serviceId} size={20} />,
      }
    }
    return BUCKET_SECTIONS
      .map(({ bucket, label }) => ({ label, items: categories.filter(c => c.bucket === bucket).map(toItem) }))
      .filter(section => section.items.length > 0)
  }, [categories])

  const filtered = useMemo(() => {
    const tab = visibleTabs.find(t => t.id === activeTab)
    let result = tab ? notifications.filter(tab.filter) : notifications
    if (effectiveCategory === 'system') result = result.filter(n => !n.meta?.groupId)
    else if (effectiveCategory) result = result.filter(n => n.meta?.groupId === effectiveCategory)
    if (sortOrder === 'oldest') return [...result].reverse()
    if (sortOrder === 'unread') return [...result].sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1))
    return result;
  }, [activeTab, notifications, visibleTabs, sortOrder, effectiveCategory])

  function handleMarkAllRead() {
    if (!userId || !effectiveCategory) return
    if (effectiveCategory === 'system') {
      notifications
        .filter(n => !n.meta?.groupId && !n.isRead)
        .forEach(n => useNotificationStore.getState().markRead(n.id))
    } else {
      useNotificationStore.getState().markReadForGroup(userId, effectiveCategory)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">

      <DrawerContent className="no-hover:[--drawer-content-width:18rem] no-hover:data-[swipe-direction=right]:border-l-0 can-hover:lg:rounded-2xl can-hover:lg:border can-hover:lg:[--drawer-inset:0.75rem] can-hover:lg:[--drawer-bleed-background:transparent]">
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <Bell strokeWidth={1.5} size={18} className="text-ink-3" />
            <DrawerTitle>通知</DrawerTitle>
            {!loggedIn && (
              <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-ink-3">
                系統公告
              </span>
            )}
            {unreadCount > 0 && (
              <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-bold text-danger-text">
                {unreadCount} 未讀
              </span>
            )}
          </div>
        </DrawerHeader>
        <DrawerDescription className="sr-only">通知中心</DrawerDescription>

        {(categories.length > 0 || visibleTabs.length > 1) && (
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            {categories.length > 0 && (
              <div className="min-w-0 flex-1">
                <FilterSelect
                  id="category"
                  group={filterSelectGroup}
                  value={effectiveCategory}
                  onChange={setActiveCategory}
                  groups={categoryGroups}
                  ariaLabel="通知分類"
                  className="h-11 w-full text-xs font-bold"
                  listClassName="z-[80] h-44"
                  triggerContent={(
                    <span className="flex min-w-0 items-center gap-1.5">
                      {selectedCategory ? (
                        <span className="relative inline-flex shrink-0">
                          {selectedCategory.key === 'system' ? (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[22%] border border-line bg-white text-brand">
                              <Megaphone size={11} strokeWidth={1.5} />
                            </span>
                          ) : (
                            <ServiceLogo serviceId={selectedCategory.serviceId} size={20} />
                          )}
                          <UpdateDot show={anyCategoryUnread} className="h-2.5 w-2.5 -right-0.5 -top-0.5" />
                        </span>
                      ) : null}
                      <span className="truncate">{selectedCategory ? selectedCategory.label : '全部通知'}</span>
                    </span>
                  )}
                />
              </div>
            )}
            {categories.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={!selectedCategory?.hasUnread}
                aria-label="將此分類全部標記已讀"
                title="將此分類全部標記已讀"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-3 transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-3"
              >
                <CheckCheck size={18} strokeWidth={1.5} />
              </button>
            )}
            {visibleTabs.length > 1 && (
              <DropdownMenu
                open={filterMenuOpen}
                onOpenChange={o => { setFilterMenuOpen(o); if (o) filterSelectGroup.setOpenKey(null) }}
              >
                <DropdownMenuFilterTrigger
                  active={activeTab !== 'all' || sortOrder !== 'newest'}
                  ariaLabel="篩選通知"
                  className="h-11 w-11"
                />
                <DropdownMenuContent className="h-44 w-64 p-0">
                  <div className="flex h-full">
                    <div className="flex-1 overflow-y-auto border-r border-line-subtle p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <DropdownMenuRadioSection label="顯示範圍" options={visibleTabs} value={activeTab} onValueChange={setActiveTab} hideSeparator />
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <DropdownMenuRadioSection label="排序" options={SORT_OPTIONS} value={sortOrder} onValueChange={setSortOrder} hideSeparator />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={loggedIn ? '沒有通知' : '沒有系統公告'}
              description={loggedIn && activeTab === 'all' ? '加入或建立群組後會顯示動態' : loggedIn ? '這裡沒有訊息' : '目前沒有公告'}
              className="py-10"
            />
          ) : (
            <div key={`${activeTab}-${sortOrder}-${effectiveCategory}`} className="animate-fade-in-up divide-y divide-line-subtle">
              {filtered.map(n => {
                const isUnread = loggedIn && !n.isRead

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n, { userId, navigate, setOpen })}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised ${
                      isUnread ? 'bg-brand-subtle/30' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{n.message}</p>
                      <p className="mt-1 text-xs text-ink-4">{formatRelativeDate(n.createdAt)}</p>
                    </div>
                    {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-danger" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={() => setOpen(false)}
            className="w-full rounded-lg"
          >
            關閉
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
