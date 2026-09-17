import { useState } from 'react'
import { uploadDisputeEvidence } from '../../../common/api/storageApi'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { toast } from '../../../common/utils/toast'
import { useEvidenceUpload } from '../../../common/utils/hooks'
import CountdownText from '../../../components/ui/primitives/CountdownText'

export function useDisputeForm(groupId) {
  const [show, setShow] = useState(false)
  const [reasons, setReasons] = useState([])
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const evidence = useEvidenceUpload(uploadDisputeEvidence)
  const disputeGroup = useGroupStore(s => s.disputeGroup)
  const withdrawDisputeAction = useGroupStore(s => s.withdrawDispute)

  function toggleReason(option) {
    setReasons(prev => prev.includes(option) ? prev.filter(r => r !== option) : [...prev, option])
  }

  function reset() {
    setReasons([])
    setDetail('')
    evidence.reset()
  }

  function open() {
    reset()
    setShow(true)
  }

  async function submit(e) {
    e.preventDefault()
    if (reasons.length === 0) return
    const reason = [reasons.join('、'), detail.trim()].filter(Boolean).join('\n')
    setLoading(true)
    try {
      await disputeGroup(groupId, { reason, evidenceUrl: evidence.key || undefined })
      setShow(false)
      reset()
      toast('已送出回報，將於 48 小時內處理', 'success')
    } catch (err) {
      const code = err?.response?.data?.code
      if (code === 'DISPUTE_COOLDOWN') {
        const cooldownEndsAt = err?.response?.data?.cooldownEndsAt
        toast(cooldownEndsAt ? <span>回報過於頻繁，剩餘 <CountdownText deadline={cooldownEndsAt} /> 後可再試</span> : err.message, 'error')
      } else {
        toast(err?.message ?? '回報失敗，請稍後再試', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function withdraw() {
    setWithdrawing(true)
    try {
      await withdrawDisputeAction(groupId)
      toast('已撤銷問題回報')
    } catch (err) {
      toast(err?.message ?? '撤銷失敗，請稍後再試', 'error')
    } finally {
      setWithdrawing(false)
    }
  }

  return { show, setShow, reasons, detail, setDetail, loading, evidence, toggleReason, open, submit, withdrawing, withdraw }
}
