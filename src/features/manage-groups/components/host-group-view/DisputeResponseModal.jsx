import { useState } from 'react'
import { Check, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../../components/ui/dialog'
import { Button } from '../../../../components/ui/button'
import { Textarea } from '../../../../components/ui/input'
import EvidenceLink from '../../../../components/ui/EvidenceLink'

const MODE_CONFIG = {
  resolve: {
    icon: Check,
    title: '問題處理完成',
    description: '確認這名成員回報的問題已經處理完成，群組會回到確認期讓所有人重新確認服務。',
    placeholder: '處理備註（選填），會留在群組帳號資訊留言區',
    required: false,
    submitLabel: '確認處理完成',
  },
  escalate: {
    icon: ShieldAlert,
    title: '標記不實回報',
    description: '這筆問題回報將交由平台客服介入了解實際狀況並裁定，請說明你認為不實的理由。',
    placeholder: '請說明理由（必填），將提供給平台客服參考',
    required: true,
    submitLabel: '送出並進入仲裁',
  },
}

export default function DisputeResponseModal({ isOpen, mode, issueTypes, issueDetail, evidenceUrl, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const config = MODE_CONFIG[mode] ?? MODE_CONFIG.resolve
  const Icon = config.icon
  const canSubmit = !config.required || !!note.trim()

  async function handleSubmit() {
    setLoading(true)
    try {
      await onSubmit(note.trim() || undefined)
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
            <Icon strokeWidth={1.5} size={18} className="shrink-0 text-brand" />
            <DialogTitle className="truncate text-base">{config.title}</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>{config.title}</DialogDescription>
        <DialogBody>
          <div className="animate-step-slide-up space-y-3 p-5">
            <p className="text-sm text-ink-3">{config.description}</p>
            {issueTypes && (
              <div className="space-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
                <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題類型：</span>{issueTypes}</p>
                {issueDetail && (
                  <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題說明：</span>{issueDetail}</p>
                )}
                <EvidenceLink
                  url={evidenceUrl}
                  className="flex w-fit items-center gap-1 text-xs font-medium text-brand underline hover:text-brand/80"
                />
              </div>
            )}
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder={config.placeholder}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant={mode === 'escalate' ? 'destructive' : 'default'}
            disabled={!canSubmit || loading}
            onClick={handleSubmit}
            className="flex-1 rounded-lg"
          >
            {loading ? '送出中…' : config.submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
