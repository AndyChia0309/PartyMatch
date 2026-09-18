import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/input'
import EvidenceAttachmentField from '../../../components/ui/EvidenceAttachmentField'
import { getServiceInfoSummary } from '../../../common/utils/serviceInfoFields'

export default function ReportServiceIssueModal({
  member,
  sharingMethod,
  submitting = false,
  onClose,
  note,
  setNote,
  evidenceUrl,
  evidenceName,
  evidenceUploading,
  evidenceProgress,
  onEvidenceSelect,
  onRemoveEvidence,
  onSubmit,
}) {
  return (
    <Dialog open={!!member} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-sm" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <AlertTriangle strokeWidth={1.5} size={18} className="shrink-0 text-danger-text" />
            <DialogTitle className="truncate text-base">問題回報</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>問題回報</DialogDescription>
        <DialogBody>
      {member && (
        <div className="animate-step-slide-up flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-raised px-4 py-3">
            <Avatar initial={member.userAvatarInitial} color={member.userAvatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{member.userName}</p>
              <p className="text-xs text-ink-3">{getServiceInfoSummary(member.serviceInfo, sharingMethod) ?? '—'}</p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">說明問題回報</label>
            <Textarea
              rows={3}
              autoFocus
              placeholder="例如：此 Email 無法加入訂閱方案，請更換帳號..."
              value={note}
              onChange={e => setNote(e.target.value)}
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
      )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={!note.trim() || evidenceUploading || submitting}
            className="flex-1 rounded-lg"
          >
            {submitting ? '送出中…' : '提交回報'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
