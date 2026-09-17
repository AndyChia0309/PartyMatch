import { CalendarClock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input, Textarea } from '../../../components/ui/input'
import { toISODate } from '../../../common/utils/date'

const MAX_ADJUST_DAYS = 7

function getAllowedRange(currentDate) {
  const min = new Date(currentDate)
  min.setDate(min.getDate() + 1)
  const max = new Date(currentDate)
  max.setDate(max.getDate() + MAX_ADJUST_DAYS)
  return { min: toISODate(min), max: toISODate(max) }
}

export default function AdjustBillingDateModal({
  open, currentDate, newDate, setNewDate, note, setNote, saving, onClose, onSubmit,
}) {
  const { min, max } = currentDate ? getAllowedRange(currentDate) : {}

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-sm" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarClock strokeWidth={1.5} size={18} className="shrink-0 text-brand" />
            <DialogTitle className="truncate text-base">調整扣款日期</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>調整扣款日期</DialogDescription>
        <DialogBody>
          <div className="space-y-4 p-5">
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold text-ink-3">目前扣款日</span>
              <span className="text-lg font-black text-ink">{toISODate(currentDate, '—')}</span>
            </div>
            <div className="space-y-1.5 rounded-lg bg-raised p-3 text-xs text-ink-3">
              <p className="font-semibold text-ink-2">設定說明</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>只能往後延，不能提前</li>
                <li>最多延後 {MAX_ADJUST_DAYS} 天</li>
                <li>每期僅能調整一次</li>
                <li>送出後全體成員會立即收到通知</li>
              </ul>
              {currentDate && (
                <p className="pt-1 text-ink-4">範例：目前扣款日為 {toISODate(currentDate)}，最晚可以調整到 {max}。</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">新的扣款日</label>
              <Input type="date" min={min} max={max} value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">調整原因</label>
              <Textarea
                rows={3}
                placeholder="例如：等待成員回覆帳號問題，延後幾天再開始收費..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            loading={saving}
            disabled={!newDate || !note.trim()}
            className="flex-1"
          >
            確認調整
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
