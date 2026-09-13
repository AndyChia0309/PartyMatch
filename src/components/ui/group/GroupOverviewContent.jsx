import { CheckCircle2, Clock, Info, Layers, ListChecks, Package, User, Users, Calendar } from 'lucide-react'
import { getInfoRows } from '../../../common/utils/groupDisplay'
import { StatusBadge } from '../StatusBadge'
import TokenAmount from '../TokenAmount'
import CreditScoreValue from '../CreditScoreValue'

const TAG_CONFIG = {
  '審核制':    { Icon: Clock,        cls: 'bg-warning-subtle border border-warning/30 text-warning-text' },
  '每月付款':  { Icon: Calendar,     cls: 'bg-info-subtle border border-info/30 text-info-text'    },
  '年付':      { Icon: Calendar,     cls: 'bg-info-subtle border border-info/30 text-info-text'    },
  '需自備帳號': { Icon: User,        cls: 'bg-success-subtle border border-success/30 text-success-text'   },
  '共享帳號':  { Icon: Users,        cls: 'bg-purple-subtle border border-purple-border text-purple-text' },
  '自動加入':  { Icon: CheckCircle2, cls: 'bg-teal-subtle border border-teal-border text-teal-text' },
}
const DEFAULT_TAG = { Icon: Info, cls: 'bg-raised border border-line text-ink-2' }

export function TagChip({ label, size = 'md' }) {
  const { Icon, cls } = TAG_CONFIG[label] ?? DEFAULT_TAG
  const textSize = size === 'sm' ? 'text-2xs' : 'text-xs'
  const iconSize = size === 'sm' ? 10 : 12
  const px       = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${textSize} ${px} ${cls}`}>
      <Icon size={iconSize} strokeWidth={1.5} />
      {label}
    </span>
  )
}

export function ServiceIntro({ service, plan }) {
  return (
    <>
      {service?.description && (
        <p className="text-sm leading-relaxed text-ink-2">{service.description}</p>
      )}
      {(plan?.features?.length ?? 0) > 0 && (
        <div className={`${service?.description ? 'mt-4 border-t border-line-subtle pt-4' : ''}`}>
          <p className="mb-4 flex items-center gap-2 text-lg font-black text-brand"><Layers strokeWidth={1.5} size={16} />方案說明</p>
          <ul className="space-y-2">
            {plan.features.map((feat, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                <CheckCircle2 strokeWidth={1.5} size={14} className="mt-0.5 shrink-0 text-brand" />
                {feat}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function RulesList({ allRules }) {
  return allRules.length > 0 ? (
    <ul className="space-y-3">
      {allRules.map((rule, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
          <span className="text-ink-4 shrink-0">{i + 1}.</span>
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-ink-4">此群組尚未設定群組規則</p>
  )
}

export default function GroupOverviewContent({ group, service, plan, reviewsSection = null, statusBadgeOverride, extraRows = [] }) {
  const allRules  = group.rules ?? []
  const infoRows = [
    ...getInfoRows(group).map(row =>
      row.badge === group.status && statusBadgeOverride
        ? { ...row, badge: statusBadgeOverride }
        : row
    ),
    ...extraRows,
  ]
  const tags = group.tags ?? []

  return (
    <div className="divide-y divide-line-subtle">
      <div className="space-y-4 pb-5 pt-0">
        <p className="flex items-center gap-2 text-lg font-black text-brand"><Info strokeWidth={1.5} size={16} />群組資訊</p>
        {infoRows.length > 0 && (
          <div className="space-y-2">
            {infoRows.map(row => (
              <div key={row.label} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-ink-4">{row.label}</span>
                <span className="text-ink-2">{row.badge ? (
                  typeof row.badge === 'object'
                    ? <StatusBadge status={row.badge.variant} label={row.badge.label} />
                    : <StatusBadge status={row.badge} />
                ) : row.priceInfo ? (
                  <TokenAmount amount={row.priceInfo.amount} cycle={row.priceInfo.cycle} />
                ) : row.priceInfo === null ? '—' : 'creditScore' in row ? (
                  <CreditScoreValue score={row.creditScore} />
                ) : row.value}</span>
              </div>
            ))}
          </div>
        )}
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map(tag => <TagChip key={tag} label={tag} />)}
          </div>
        )}
      </div>

      <div className="space-y-4 py-5">
        <p className="flex items-center gap-2 text-lg font-black text-brand"><ListChecks strokeWidth={1.5} size={16} />群組規則</p>
        <RulesList allRules={allRules} />
      </div>

      <div className="py-5">
        <p className="mb-4 flex items-center gap-2 text-lg font-black text-brand"><Package strokeWidth={1.5} size={16} />服務說明</p>
        <ServiceIntro service={service} plan={plan} />
      </div>

      {reviewsSection && <div className="py-5">{reviewsSection}</div>}
    </div>
  )
}
