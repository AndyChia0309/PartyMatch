import { useEffect, useState } from 'react'
import { TriangleAlert, CheckCircle2 } from 'lucide-react'
import { toast } from '../../../common/utils/toast'
import { formatDateTime } from '../../../common/utils/date'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input, Textarea } from '../../../components/ui/input'
import EvidenceLink from '../../../components/ui/EvidenceLink'
import EmptyState from '../../../components/ui/primitives/EmptyState'
import { fetchAdminPlatformReports, resolvePlatformReportApi } from '../../../common/api/adminApi'

const STATUS_TABS = [
  { value: 'pending',  label: '待處理' },
  { value: 'resolved', label: '已處理' },
  { value: 'all',      label: '全部' },
]

export default function PlatformReportsSection() {
  const [status, setStatus]         = useState('pending')
  const [reports, setReports]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [resolvingId, setResolvingId] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [noteDraft, setNoteDraft]   = useState('')
  const [dateDraft, setDateDraft]   = useState('')

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? '' : id)
    setNoteDraft('')
    setDateDraft('')
  }

  useEffect(() => {
    let ignore = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetchAdminPlatformReports({ status })
      .then(data => { if (!ignore) setReports(data) })
      .catch(err => toast(err?.message ?? '載入失敗，請稍後再試', 'error'))
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [status])

  async function handleResolve(id) {
    if (dateDraft && !noteDraft.trim()) {
      toast('要調整扣款日的話，請填寫處理備註當作調整原因', 'error')
      return
    }
    setResolvingId(id)
    try {
      await resolvePlatformReportApi(id, {
        resolutionNote:  noteDraft.trim() || undefined,
        nextBillingDate: dateDraft || undefined,
      })
      toast(dateDraft ? '已標記為已處理，扣款日已調整' : '已標記為已處理', 'success')
      setReports(prev => status === 'all'
        ? prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r)
        : prev.filter(r => r.id !== id))
      toggleExpand(id)
    } catch (err) {
      toast(err?.message ?? '操作失敗，請稍後再試', 'error')
    } finally {
      setResolvingId('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              status === tab.value ? 'bg-brand text-white' : 'bg-raised text-ink-3 hover:bg-brand-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-ink-3">載入中...</p>
      ) : reports.length === 0 ? (
        <EmptyState icon={TriangleAlert} title="目前沒有使用者回報" />
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    <span className="font-semibold text-ink">{r.reporterName}</span>
                    <span>{r.reporterEmail}</span>
                    <span>·</span>
                    <span>{r.planName}（團主：{r.hostName}）</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{r.description}</p>
                  {r.evidenceUrl && (
                    <EvidenceLink
                      url={r.evidenceUrl}
                      className="flex h-auto w-fit items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand-subtle"
                    />
                  )}
                  <p className="text-2xs text-ink-4">{formatDateTime(r.createdAt)}</p>
                  {r.status === 'resolved' && (
                    <div className="space-y-0.5">
                      <p className="flex items-center gap-1 text-xs text-success-text">
                        <CheckCircle2 size={12} strokeWidth={1.5} />
                        已由 {r.resolvedByAdminName ?? '管理員'} 處理
                      </p>
                      {r.resolutionNote && (
                        <p className="whitespace-pre-wrap text-xs text-ink-3">備註：{r.resolutionNote}</p>
                      )}
                    </div>
                  )}
                </div>
                {r.status === 'pending' && (
                  <Button
                    size="sm"
                    disabled={resolvingId === r.id}
                    onClick={() => toggleExpand(r.id)}
                    className="shrink-0 rounded-lg"
                  >
                    {expandedId === r.id ? '取消' : '標記已處理'}
                  </Button>
                )}
              </div>
              {expandedId === r.id && (
                <div className="mt-3 space-y-2 border-t border-line-subtle pt-3">
                  <Textarea
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="處理備註（選填，若同時調整扣款日則必填，當作調整原因）"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-ink-3">同時調整扣款日期（選填）</span>
                    <Input
                      type="date"
                      value={dateDraft}
                      onChange={e => setDateDraft(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={resolvingId === r.id}
                    onClick={() => handleResolve(r.id)}
                    className="rounded-lg"
                  >
                    {resolvingId === r.id ? '處理中...' : '確認處理'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
