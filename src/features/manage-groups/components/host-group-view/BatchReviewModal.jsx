import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../../components/ui/dialog'
import { Avatar } from '../../../../components/ui/avatar'
import { Button } from '../../../../components/ui/button'
import { Textarea } from '../../../../components/ui/input'
import StarRating from '../../../../components/ui/primitives/StarRating'
import { toast } from '../../../../common/utils/toast'
import { useReviewStore } from '../../../../common/stores/useReviewStore'

export default function BatchReviewModal({ groupId, members, onClose }) {
  const submitReview = useReviewStore(s => s.submit)
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const ratedUserIds = Object.keys(ratings).filter(userId => ratings[userId] > 0)

  async function handleSubmit() {
    if (ratedUserIds.length === 0) return
    setSubmitting(true)
    try {
      await Promise.all(ratedUserIds.map(userId => submitReview({
        groupId,
        revieweeId: userId,
        rating:     ratings[userId],
        comment:    comments[userId]?.trim() || undefined,
      })))
      toast('感謝你的評價！', 'success')
      onClose()
    } catch (err) {
      toast(err?.message ?? '送出失敗，請稍後再試', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate text-base">給成員一個評價</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>給每位成員一個評價</DialogDescription>
        <DialogBody>
          <div className="space-y-5 p-5">
            {members.map(m => (
              <div key={m.id} className="space-y-2 border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Avatar initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" />
                  <p className="text-sm font-semibold text-ink">{m.userName}</p>
                </div>
                <StarRating value={ratings[m.userId] ?? 0} onChange={v => setRatings(prev => ({ ...prev, [m.userId]: v }))} size={24} />
                <Textarea
                  value={comments[m.userId] ?? ''}
                  onChange={e => setComments(prev => ({ ...prev, [m.userId]: e.target.value }))}
                  placeholder="分享你的體驗（選填）"
                  rows={2}
                  maxLength={500}
                  className="resize-none"
                />
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="flex-1">先跳過</Button>
          <Button onClick={handleSubmit} disabled={ratedUserIds.length === 0 || submitting} className="flex-1">
            {submitting ? '送出中…' : '送出評價'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
