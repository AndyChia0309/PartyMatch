import { Headset } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/input'
import EvidenceAttachmentField from '../../../components/ui/EvidenceAttachmentField'

export default function ReportPlatformIssueModal({
  isOpen,
  onClose,
  description,
  setDescription,
  evidenceUrl,
  evidenceName,
  evidenceUploading,
  evidenceProgress,
  onEvidenceSelect,
  onRemoveEvidence,
  submitting,
  onSubmit,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-sm" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <Headset strokeWidth={1.5} size={18} className="shrink-0 text-brand" />
            <DialogTitle className="truncate text-base">聯繫客服</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>聯繫客服</DialogDescription>
        <DialogBody>
          <div className="animate-step-slide-up flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <p className="text-xs text-ink-3">請說明您遇到的問題，客服會盡快協助處理。</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">說明問題</label>
              <Textarea
                rows={4}
                autoFocus
                placeholder="請描述你遇到的問題，方便客服協助處理..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <EvidenceAttachmentField
              url={evidenceUrl}
              name={evidenceName}
              uploading={evidenceUploading}
              progress={evidenceProgress}
              onSelect={onEvidenceSelect}
              onRemove={onRemoveEvidence}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={!description.trim() || evidenceUploading || submitting}
            className="flex-1 rounded-lg"
          >
            {submitting ? '送出中...' : '送出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
