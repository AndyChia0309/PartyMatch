import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/input'

export default function ReportFalseIssueModal({ isOpen, issueNote, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const canSubmit = !!note.trim()

  async function handleSubmit() {
    setLoading(true)
    try {
      await onSubmit(note.trim())
      setNote('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-md" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <ShieldAlert strokeWidth={1.5} size={18} className="shrink-0 text-brand" />
            <DialogTitle className="truncate text-base">標記不實回報</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>標記不實回報</DialogDescription>
        <DialogBody>
          <div className="animate-step-slide-up space-y-3 p-5">
            <p className="text-sm text-ink-3">這筆問題回報將交由平台客服介入了解實際狀況並裁定，請說明你認為不實的理由。</p>
            {issueNote && (
              <div className="space-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
                <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">團主回報內容：</span>{issueNote}</p>
              </div>
            )}
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="請說明理由（必填），將提供給平台客服參考"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!canSubmit || loading}
            onClick={handleSubmit}
            className="flex-1 rounded-lg"
          >
            {loading ? '送出中…' : '送出並進入仲裁'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
