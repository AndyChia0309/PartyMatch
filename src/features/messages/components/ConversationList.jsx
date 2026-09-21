import { SquarePen } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuRadioSection, DropdownMenuFilterTrigger,
} from '../../../components/ui/dropdown-menu'
import SearchInput from '../../../components/ui/primitives/SearchInput'
import ConversationAvatar from './ConversationAvatar'
import { formatTime } from '../utils'

const CONV_TABS = [
  { id: 'all',   label: '全部', filter: () => true },
  { id: 'group', label: '群組', filter: c => c.type === 'group' },
  { id: 'dm',    label: '個人', filter: c => c.type === 'dm' },
]

const ROLE_OPTIONS = [
  { id: 'all',    label: '全部身分' },
  { id: 'host',   label: '我是團主' },
  { id: 'member', label: '我是成員' },
]

const STATUS_OPTIONS = [
  { id: 'all',        label: '全部狀態' },
  { id: 'processing', label: '進行中' },
  { id: 'active',     label: '服務進行中' },
  { id: 'history',    label: '已結束服務' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: '最新回覆在前' },
  { id: 'oldest', label: '最舊回覆在前' },
]

export { CONV_TABS }

export default function ConversationList({
  filteredConvs, activeTab, selectedId, user, searchQuery, unreadOnly, roleFilter, statusFilter, sortOrder,
  onSelectConversation, onTabChange, onSearchChange, onUnreadOnlyChange, onRoleFilterChange, onStatusFilterChange, onSortOrderChange,
}) {
  const hasFilter = activeTab !== 'all' || unreadOnly || roleFilter !== 'all' || statusFilter !== 'all' || sortOrder !== 'newest'
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="搜尋對話..." />
        <DropdownMenu>
          <DropdownMenuFilterTrigger active={hasFilter} ariaLabel="篩選對話" />
          <DropdownMenuContent>
            <DropdownMenuRadioSection label="顯示範圍" options={CONV_TABS} value={activeTab} onValueChange={onTabChange} />
            <DropdownMenuRadioSection label="身分" options={ROLE_OPTIONS} value={roleFilter} onValueChange={onRoleFilterChange} />
            <DropdownMenuRadioSection label="群組狀態" options={STATUS_OPTIONS} value={statusFilter} onValueChange={onStatusFilterChange} />
            <DropdownMenuRadioSection label="排序" options={SORT_OPTIONS} value={sortOrder} onValueChange={onSortOrderChange} />
            <DropdownMenuCheckboxItem checked={unreadOnly} onCheckedChange={onUnreadOnlyChange}>
              只顯示未讀
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredConvs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-4">
            <SquarePen size={32} strokeWidth={1.5} />
            <p className="text-sm">目前沒有對話</p>
          </div>
        )}
        {filteredConvs.map(conversation => {
          const unread = conversation.unreadCounts?.[user?.id] ?? 0
          return (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-raised ${
                conversation.id === selectedId ? 'bg-brand-subtle/40' : ''
              }`}
            >
              <ConversationAvatar conversation={conversation} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{conversation.name}</span>
                    {conversation.memberRole && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none ${
                        conversation.memberRole === 'host' ? 'bg-brand-subtle text-brand' : 'bg-raised text-ink-3'
                      }`}>
                        {conversation.memberRole === 'host' ? '團主' : '成員'}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-ink-4">{formatTime(conversation.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-ink-3">{conversation.lastMessage}</span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-xs font-black text-white">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
