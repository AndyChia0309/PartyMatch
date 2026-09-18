import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/input'
import EvidenceAttachmentField from '../../../components/ui/EvidenceAttachmentField'

const DISPUTE_REASON_OPTIONS = [
  '帳號資訊未提供或有誤',
  '服務尚未啟用',
  '服務品質與描述不符',
  '團主已讀不回、無法聯繫',
  '帳號被團主收回或更改密碼',
  '其他',
]

export default function DisputeModal(
  {
    isOpen,
    onClose,
    onSubmit,
    disputeReasons,
    onToggleReason,
    disputeDetail,
    setDisputeDetail,
    disputeLoading,
    evidenceUrl,
    evidenceName,
    evidenceUploading,
    evidenceProgress,
    onEvidenceSelect,
    onRemoveEvidence,
  }
) {
  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-lg" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <AlertTriangle strokeWidth={1.5} size={18} className="shrink-0 text-danger" />
            <DialogTitle className="truncate text-base">回報問題</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>回報問題</DialogDescription>
        <DialogBody>
      <form id="dispute-form" onSubmit={onSubmit} className="animate-step-slide-up p-5 space-y-4">
        <fieldset>
          <legend className="block text-xs text-ink-3 mb-1.5">回報原因 <span className="text-danger">*</span>（可複選）</legend>
          <div className="space-y-1.5">
            {DISPUTE_REASON_OPTIONS.map(option => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-2 transition-colors hover:border-brand/40"
              >
                <input
                  type="checkbox"
                  checked={disputeReasons.includes(option)}
                  onChange={() => onToggleReason(option)}
                  className="h-4 w-4 shrink-0 accent-danger"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-xs text-ink-3 mb-1.5">補充說明（選填）</span>
          <Textarea
            value={disputeDetail}
            onChange={e => setDisputeDetail(e.target.value)}
            placeholder="描述服務未正常啟用的情況"
            rows={4}
          />
        </label>
        <EvidenceAttachmentField
          label={<>附件 <span className="text-danger">*</span>（截圖或其他佐證檔案）</>}
          url={evidenceUrl}
          name={evidenceName}
          uploading={evidenceUploading}
          progress={evidenceProgress}
          onSelect={onEvidenceSelect}
          onRemove={onRemoveEvidence}
        />
        <div className="rounded-lg bg-warning-subtle px-3 py-2.5 text-sm text-warning-text">
          <p className="font-semibold mb-1">回報須知</p>
          <p>送出後代管金額會先凍結，將於 48 小時內處理完成。請詳細說明問題，方便盡快確認狀況。</p>
        </div>
      </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="submit"
            form="dispute-form"
            variant="destructive"
            disabled={disputeReasons.length === 0 || !evidenceUrl || disputeLoading || evidenceUploading}
            className="w-full rounded-lg"
          >
            {disputeLoading ? '送出中…' : '送出回報'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
