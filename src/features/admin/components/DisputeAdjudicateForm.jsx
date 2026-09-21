import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/input'
import ConfirmActionDialog from '../../../components/ui/ConfirmActionDialog'
import { toast } from '../../../common/utils/toast'
import { adjudicateDisputeApi } from '../../../common/api/adminApi'

export default function DisputeAdjudicateForm({ dispute, onResolved }) {
  const [winner, setWinner] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const hostReleaseAmount = winner === 'host' ? dispute.seatCost : 0

  async function handleConfirm() {
    setConfirming(false)
    setLoading(true)
    try {
      await adjudicateDisputeApi(dispute.groupId, { memberId: dispute.memberId, winner, reason: reason.trim() })
      toast('裁定完成', 'success')
      setWinner('')
      setReason('')
      onResolved()
    } catch (err) {
      toast(err?.message ?? '裁定失敗，請稍後再試', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <p className="mb-3 text-xs font-semibold text-ink-3">裁定結果</p>

      <div className="mb-3 flex gap-2">
        <Button
          variant={winner === 'member' ? 'default' : 'secondary'}
          size="sm"
          className="flex-1 rounded-lg text-xs"
          onClick={() => setWinner('member')}
        >
          成員獲勝
        </Button>
        <Button
          variant={winner === 'host' ? 'default' : 'secondary'}
          size="sm"
          className="flex-1 rounded-lg text-xs"
          onClick={() => setWinner('host')}
        >
          團主獲勝
        </Button>
      </div>

      {winner === 'member' && (
        <p className="mb-3 text-xs text-ink-4">將退款 {dispute.seatCost} PM 給成員；此裁定只結算這名成員的席位金額，群組其餘成員的代管進度不受影響</p>
      )}
      {winner === 'host' && (
        <p className="mb-3 text-xs text-ink-4">申訴成員本期費用不予退還，{hostReleaseAmount} PM 不會馬上撥款給團主；此裁定只結算這名成員的席位金額，群組其餘成員的代管進度不受影響</p>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-ink-3">裁定說明</label>
        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="請填寫裁定原因，將發送給雙方"
        />
      </div>

      <Button
        variant="destructive"
        disabled={loading || !winner || !reason.trim()}
        onClick={() => setConfirming(true)}
        className="w-full rounded-lg"
      >
        {loading ? '處理中…' : '送出裁定'}
      </Button>

      {confirming && (
        <ConfirmActionDialog
          title="確認送出裁定？"
          message={
            winner === 'member'
              ? `成員獲勝：退款 ${dispute.seatCost} PM 給成員，此操作無法復原。`
              : `團主獲勝：申訴成員本期費用不予退還，${hostReleaseAmount} PM 不會馬上撥款給團主，此操作無法復原。`
          }
          confirmLabel="確認裁定"
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
