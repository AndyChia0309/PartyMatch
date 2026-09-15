import { Archive } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogCloseButton } from '../dialog'
import EmptyState from '../primitives/EmptyState'

export default function GroupHistoryModal({ isOpen, onClose, items, renderItem, emptyDescription, title = '群組紀錄' }) {
  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent maxWidth="max-w-7xl" height="min(90dvh, 820px)">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Archive strokeWidth={1.5} size={16} className="text-ink-3" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>{title}</DialogDescription>
        <DialogBody>
          <div className="p-5">
            {items.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="還沒有已結束的群組"
                description={emptyDescription}
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(renderItem)}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
