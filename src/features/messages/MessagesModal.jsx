import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import ConversationAvatar from './components/ConversationAvatar'
import ConversationHeaderActions from './components/ConversationHeaderActions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogCloseButton } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import LoginPromptModal from '../../components/ui/LoginPromptModal'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { useConversationStore } from '../../common/stores/useConversationStore'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { useNotificationStore } from '../../common/stores/useNotificationStore'

const getCurrentUser = () => useAuthStore.getState().user
const isAuthenticated = () => useAuthStore.getState().loggedIn
import {
  fetchConversations,
  subscribeToMessages,
  sendMessage,
  getOrCreateDmConversation,
} from '../../common/api/messagesApi'
import { uploadMessageAttachment } from '../../common/api/storageApi'
import { useEvidenceUpload } from '../../common/utils/hooks'
import { normalizeConversation, normalizeMessage } from '../../common/utils/modelNormalizers'
import { getGroupStatusBucket } from '../../common/utils/groupStatusDisplay'
import { byNewest } from '../../common/utils/date'
import { createId } from '../../common/utils/storage'
import ConversationList, { CONV_TABS } from './components/ConversationList'
import ChatWindow from './components/ChatWindow'
import { isSystemConversation, markConversationReadLocal } from './utils'

function isImeConfirmEnter(e, isComposingRef, lastCompositionEndRef) {
  if (isComposingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return true
  return Date.now() - lastCompositionEndRef.current < 50
}

export default function MessagesModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('')
  const [canSend, setCanSend] = useState(false)
  const conversations = useConversationStore(s => s.conversations)
  const groups = useGroupStore(s => s.groups)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const inputRef = useRef(null)
  const isComposingRef = useRef(false)
  const lastCompositionEndRef = useRef(0)
  const attachment = useEvidenceUpload(uploadMessageAttachment)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowMembers(false)
  }, [selectedId])

  useEffect(() => {
    async function onOpen(e) {
      if (!isAuthenticated()) { setShowLoginPrompt(true); return }
      setIsOpen(true)
      const groupId = e?.detail?.groupId
      if (!groupId) return
      let conv = useConversationStore.getState().getByGroupId(groupId)
      if (!conv) {
        try {
          const convs = await fetchConversations()
          const fetched = convs.map(normalizeConversation)
          const fetchedIds = new Set(fetched.map(c => c.id))
          useConversationStore.setState(s => ({
            conversations: [
              ...fetched,
              ...s.conversations.filter(c => !fetchedIds.has(c.id)),
            ],
          }))
          conv = useConversationStore.getState().getByGroupId(groupId)
        } catch {}
      }
      if (conv) setSelectedId(conv.id)
    }
    function onClose() { resetAndClose() }
    window.addEventListener('pm:open-messages', onOpen)
    window.addEventListener('pm:close-messages', onClose)
    return () => {
      window.removeEventListener('pm:open-messages', onOpen)
      window.removeEventListener('pm:close-messages', onClose)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function onOpenDm(e) {
      if (!isAuthenticated()) { setShowLoginPrompt(true); return }
      const user = getCurrentUser()
      if (!user) return
      const { hostId, hostName, hostAvatarInitial, hostAvatarColor } = e.detail ?? {}
      if (!hostId) return
      setIsOpen(true)
      try {
        const conv = await getOrCreateDmConversation(hostId)
        const normalized = normalizeConversation(conv)
        normalized.participantMeta = {
          ...normalized.participantMeta,
          [hostId]: { name: hostName, avatarInitial: hostAvatarInitial, avatarColor: hostAvatarColor },
        };
        useConversationStore.getState().addConversationOptimistic(normalized)
        useConversationStore.getState().refresh(user.id)
        setSelectedId(conv.id)
      } catch (err) {
        console.error('[MessagesModal] DM 建立失敗:', err)
      }
    }
    window.addEventListener('pm:open-dm', onOpenDm)
    return () => window.removeEventListener('pm:open-dm', onOpenDm)
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const unsub = subscribeToMessages(
      selectedId,
      msgs => setMessages(msgs),
      () => {},
    )
    const user = getCurrentUser()
    if (user) {
      const conv = useConversationStore.getState().getById(selectedId)
      markConversationReadLocal(selectedId, user.id)
      if (conv?.type === 'group' && conv.groupId) {
        useNotificationStore.getState().markReadForGroup(user.id, conv.groupId)
      }
    }
    return () => { unsub(); setMessages([]) }
  }, [selectedId])

  function resetAndClose() {
    setIsOpen(false)
    setSelectedId(null)
    setActiveTab('all')
    setUnreadOnly(false)
    setRoleFilter('all')
    setStatusFilter('all')
    setSortOrder('newest')
    setSearchQuery('')
    setCanSend(false)
    setSendError(false)
    attachment.reset()
  }

  async function handleSend() {
    const text = inputRef.current?.value.trim() ?? ''
    const attachmentKey = attachment.key;
    const attachmentPreviewUrl = attachment.url
    if ((!text && !attachmentKey) || !selectedId || attachment.uploading) return
    const user = getCurrentUser()
    if (!user) return
    if (!selected) return

    setCanSend(false)
    setSendError(false)
    if (inputRef.current) inputRef.current.value = ''
    attachment.reset()
    requestAnimationFrame(() => inputRef.current?.focus())

    const tempId = createId('temp')
    const optimisticMsg = normalizeMessage({
      id:          tempId,
      senderId:    user.id,
      sender:      { id: user.id, name: user.name, avatarInitial: user.avatarInitial ?? '', avatarColor: user.avatarColor ?? null },
      content:     text,
      type:        'text',
      attachmentUrl: attachmentPreviewUrl,
      createdAt:   new Date().toISOString(),
    })
    setMessages(prev => [...prev, optimisticMsg])

    setSending(true)
    try {
      const saved = await sendMessage(selectedId, user.id, {
        senderName: user.name,
        avatarInitial: user.avatarInitial ?? '',
        avatarColor: user.avatarColor ?? null,
        text,
        attachmentUrl: attachmentKey,
        participants: selected?.participants ?? [],
      })
      const msg = normalizeMessage(saved)
      setMessages(prev => prev.some(m => m.id === msg.id)
        ? prev.filter(m => m.id !== tempId)
        : prev.map(m => m.id === tempId ? msg : m)
      )
    } catch (error) {
      console.error('[MessagesModal] send failed:', error)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      if (inputRef.current) inputRef.current.value = text
      setCanSend(true)
      setSendError(true)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (isImeConfirmEnter(e, isComposingRef, lastCompositionEndRef)) return
    e.preventDefault()
    handleSend()
  }


  if (showLoginPrompt) return <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />
  if (!isOpen) return null

  const user = getCurrentUser()

  const enrichedConvs = conversations.map(c => {
    if (c.type === 'dm') {
      const otherId = c.participants?.find(p => p !== user?.id)
      const meta = c.participantMeta?.[otherId] ?? {}
      return { ...c, name: meta.name ?? '私訊', avatarInitial: meta.avatarInitial ?? '', avatarColor: meta.avatarColor ?? '#64718A', presenceStatus: meta.presenceStatus ?? 'offline' };
    }
    if (isSystemConversation(c)) {
      return { ...c, name: 'PartyMatch 系統訊息', avatarInitial: 'P', avatarColor: 'linear-gradient(135deg,#667eea,#764ba2)' }
    }
    if (c.type === 'group' && c.groupId) {
      const group = groups.find(g => g.id === c.groupId);
      if (group) return { ...c, memberRole: group.hostId === user?.id ? 'host' : 'member', groupStatus: group.status }
    }
    return c
  })

  const selected = enrichedConvs.find(c => c.id === selectedId)
  const tabFilter = CONV_TABS.find(t => t.id === activeTab)?.filter ?? (() => true)
  const filteredConvs = enrichedConvs
    .filter(tabFilter)
    .filter(c => !searchQuery || c.name?.includes(searchQuery))
    .filter(c => !unreadOnly || (c.unreadCounts?.[user?.id] ?? 0) > 0)
    .filter(c => roleFilter === 'all' || c.memberRole === roleFilter)
    .filter(
    c => statusFilter === 'all' || (c.type === 'group' && getGroupStatusBucket(c.groupStatus) === statusFilter)
  )
    .sort((a, b) => {
      const ka = { createdAt: a.lastMessage?.createdAt ?? a.createdAt }
      const kb = { createdAt: b.lastMessage?.createdAt ?? b.createdAt }
      return sortOrder === 'oldest' ? byNewest(kb, ka) : byNewest(ka, kb)
    })

  return (
    <>
      <Dialog open onOpenChange={v => { if (!v) resetAndClose() }}>
      <DialogContent height="min(88dvh, 820px)">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isMobile && selectedId && selected ? (
              <>
                <Button
                  onClick={() => setSelectedId(null)}
                  variant="ghost"
                  size="icon"
                  className="-ml-2 shrink-0 text-ink-3 hover:text-ink active:opacity-70"
                  aria-label="返回"
                >
                  <ChevronLeft size={18} strokeWidth={1.5} />
                </Button>
                <div className="shrink-0">
                  <ConversationAvatar conversation={selected} size={28} />
                </div>
              </>
            ) : (
              <MessageSquare strokeWidth={1.5} size={20} className="text-brand" />
            )}
            <DialogTitle>{isMobile && selectedId && selected ? selected.name : '訊息'}</DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && selectedId && selected && (
              <ConversationHeaderActions
                key={selectedId}
                selected={selected}
                onMembersToggle={() => setShowMembers(v => !v)}
              />
            )}
            <DialogCloseButton className={isMobile && selectedId && selected ? 'max-md:hidden' : undefined} />
          </div>
        </DialogHeader>
        <DialogDescription>訊息</DialogDescription>
        <DialogBody>

          <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>

            <div
              className="absolute top-0 left-0 bottom-0 flex transition-transform duration-300 ease-in-out"
              style={{
                width: isMobile ? '200%' : '100%',
                transform: isMobile && selectedId ? 'translateX(-50%)' : 'translateX(0)',
              }}
            >

              <div
                className="flex flex-col overflow-hidden"
                style={isMobile
                  ? { width: '50%', flexShrink: 0 }
                  : { width: '288px', flexShrink: 0, borderRight: '1px solid var(--color-line)' }
                }
              >
                <ConversationList
                  filteredConvs={filteredConvs}
                  activeTab={activeTab}
                  selectedId={selectedId}
                  user={user}
                  searchQuery={searchQuery}
                  unreadOnly={unreadOnly}
                  roleFilter={roleFilter}
                  statusFilter={statusFilter}
                  sortOrder={sortOrder}
                  onSelectConversation={setSelectedId}
                  onTabChange={setActiveTab}
                  onSearchChange={setSearchQuery}
                  onUnreadOnlyChange={setUnreadOnly}
                  onRoleFilterChange={setRoleFilter}
                  onStatusFilterChange={setStatusFilter}
                  onSortOrderChange={setSortOrder}
                />
              </div>

              <div
                className="relative flex flex-col overflow-hidden"
                style={isMobile
                  ? { width: '50%', flexShrink: 0 }
                  : { flex: '1 1 0%' }
                }
              >
                <ChatWindow
                  selected={selected}
                  selectedId={selectedId}
                  messages={messages}
                  user={user}
                  sending={sending}
                  sendError={sendError}
                  canSend={canSend}
                  attachment={attachment}
                  inputRef={inputRef}
                  showMembers={showMembers}
                  isComposingRef={isComposingRef}
                  lastCompositionEndRef={lastCompositionEndRef}
                  onMembersToggle={setShowMembers}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                  onInputChange={v => { setCanSend(v.trim().length > 0); setSendError(false) }}
                />
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
      </Dialog>
    </>
  );
}
