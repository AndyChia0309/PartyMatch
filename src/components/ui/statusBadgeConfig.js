import { badgeVariantClasses } from './badge'

export const STATUS_CONFIG = {
  recruiting:           { variant: 'success',     label: '招募中' },
  replacement_recruiting: { variant: 'success',   label: '補位進行中' },
  pending_activation:   { variant: 'warning',     label: '待啟用服務' },
  activation_overdue:   { variant: 'destructive', label: '啟用逾期' },
  active:               { variant: 'success',     label: '服務進行中' },
  cancelled:            { variant: 'destructive', label: '已解散' },
  full:                 { variant: 'secondary',   label: '等待鎖定' },
  pending_confirmation: { variant: 'warning',     label: '成員填寫中' },
  info_overdue:         { variant: 'destructive', label: '帳號處理中' },
  confirming:           { variant: 'info',        label: '確認進行中' },
  disputed:             { variant: 'destructive', label: '問題處理中' },
  ended:                { variant: 'neutral',     label: '已結束服務' },
  closed:               { variant: 'destructive', label: '已關閉' },
  approval:             { variant: 'info',        label: '審核進行中' },
  pending:              { variant: 'warning',     label: '待確認' },
  verified:             { variant: 'info',        label: '已驗證' },
  upcoming:             { variant: 'default',     label: '即將續訂' },
  member_joined:        { variant: 'success',     label: '申請已通過' },
  active_renewal:       { variant: 'success',     label: '即將續訂' },
};
export const DEFAULT_STATUS_CONFIG = { variant: 'secondary', label: null }

export function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label ?? status
}

export function getStatusTextColor(status) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG
  const cls = badgeVariantClasses[config.variant] ?? badgeVariantClasses.secondary
  return cls.split(' ').find(c => c.startsWith('text-')) ?? 'text-ink-2'
}
