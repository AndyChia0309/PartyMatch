import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { Input } from '../input'
import { Button } from '../button'
import ReadonlyMessageList from '../ReadonlyMessageList'
import AttachmentPickerButton from '../AttachmentPickerButton'
import AttachmentPreviewChip from '../AttachmentPreviewChip'
import { fetchCredentialComments, createCredentialComment } from '../../../common/api/credentialCommentsApi'
import { uploadCredentialCommentAttachment } from '../../../common/api/storageApi'
import { startPolling } from '../../../common/utils/poller'
import { toast } from '../../../common/utils/toast'
import { useEvidenceUpload } from '../../../common/utils/hooks'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { useNotificationStore } from '../../../common/stores/useNotificationStore'

function scrollIntoNearestContainer(el) {
  if (!el) return
  let container = el.parentElement
  while (container && container !== document.body && container.scrollHeight <= container.clientHeight + 1) {
    container = container.parentElement
  }
  if (!container || container === document.body) return
  const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' })
}

export default function CredentialCommentsSection({ groupId, hostId, autoScroll = false, onAutoScrolled }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const sectionRef = useRef(null)
  const attachment = useEvidenceUpload(uploadCredentialCommentAttachment)

  useEffect(() => {
    const stop = startPolling(async (isActive) => {
      try {
        const data = await fetchCredentialComments(groupId)
        if (isActive()) { setComments(data); setLoading(false) }
      } catch {
        if (isActive()) setLoading(false)
      }
    }, 5000)
    return stop
  }, [groupId])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comments.length])

  useEffect(() => {
    if (loading || !autoScroll) return
    scrollIntoNearestContainer(sectionRef.current)
    onAutoScrolled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, autoScroll])

  async function handleSend(e) {
    e.preventDefault()
    const content = text.trim()
    if ((!content && !attachment.url) || sending || attachment.uploading) return
    setSending(true)
    try {
      const comment = await createCredentialComment({ groupId, content, attachmentUrl: attachment.key })
      setComments(prev => [...prev, comment])
      setText('')
      attachment.reset()
    } catch (err) {
      toast(err?.message ?? '留言失敗，請稍後再試', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={sectionRef} className="mt-4 border-t border-line-subtle pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-base font-black text-ink">
        <MessageSquare size={15} strokeWidth={1.5} /> 留言
      </p>
      <div className="rounded-lg border border-line p-3">
        <div ref={listRef} className="max-h-56 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-xs text-ink-4">載入中…</p>
          ) : (
            <ReadonlyMessageList
              items={comments.map(c => ({
                id: c.id,
                authorId: c.author?.id,
                authorName: c.author?.name,
                avatarInitial: c.author?.avatarInitial,
                avatarColor: c.author?.avatarColor,
                presenceStatus: c.author?.presenceStatus,
                content: c.content,
                attachmentUrl: c.attachmentUrl,
                createdAt: c.createdAt,
              }))}
              hostId={hostId}
              emptyText="還沒有留言，關於帳號資訊有問題可以在這裡詢問"
            />
          )}
        </div>
        <AttachmentPreviewChip attachment={attachment} />
        <form onSubmit={handleSend} className="mt-2 flex items-center gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => {
              const user = useAuthStore.getState().user
              if (user) useNotificationStore.getState().markReadForGroupAndType(user.id, groupId, 'credential_comment')
            }}
            placeholder="輸入留言…"
            maxLength={500}
            className="flex-1 py-2"
          />
          <AttachmentPickerButton
            attachment={attachment}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-raised hover:text-ink disabled:opacity-50"
          />
          <Button type="submit" size="icon" aria-label="送出留言" loading={sending} disabled={(!text.trim() && !attachment.url) || sending || attachment.uploading} className="shrink-0 rounded-lg">
            <Send size={15} strokeWidth={1.5} />
          </Button>
        </form>
      </div>
    </div>
  )
}
