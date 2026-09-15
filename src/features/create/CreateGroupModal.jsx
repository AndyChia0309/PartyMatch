import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, Eye, Info, PlusCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../../components/ui/dialog'
import ConfirmActionDialog from '../../components/ui/ConfirmActionDialog'
import Step1Service from './components/steps/Step1Service'
import Step2Plan from './components/steps/Step2Plan'
import Step3Settings from './components/steps/Step3Settings'
import Step4Preview from './components/steps/Step4Preview'
import { Button } from '../../components/ui/button'
import ServiceLogo from '../../components/ui/ServiceLogo'
import LivePreviewPanel from './components/LivePreviewPanel'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { getServiceById } from '../../common/utils/serviceUtils'
import { calcPricePerSeat } from '../../common/utils/pricingUtils'
import { useAuthStore } from '../../common/stores/useAuthStore'
import { toast } from '../../common/utils/toast'
import { suppressNextToast } from '../../common/utils/notificationToast'

const STEP_COMPONENTS = [Step1Service, Step2Plan, Step3Settings, Step4Preview]
const STEP_TITLES = ['選擇服務', '選擇方案', '群組設定', '最後確認']

const INITIAL_FORM = {
  serviceId: '',
  planName: '',
  pricePerSeat: 0,
  billingCycle: 'monthly',
  recruitHeadcount: 2,
  minCreditScore: 0,
  rules: ['', '', '', '', ''],
}

function mapFormToGroup(form) {
  const service = getServiceById(form.serviceId)
  const plan = service?.plans.find(p => p.name === form.planName)
  const rules = form.rules.map(r => r.trim()).filter(Boolean)
  const tags = [...new Set([...(plan?.tags ?? []), service?.category].filter(Boolean))]

  return {
    serviceId: form.serviceId,
    serviceName: service?.name ?? form.serviceId,
    planName: form.planName,
    pricePerSeat: form.pricePerSeat || 0,
    billingCycle: form.billingCycle,
    maxMembers: form.recruitHeadcount,
    totalSeats: form.recruitHeadcount,
    usedSeats: 1,
    openSeats: form.recruitHeadcount - 1,
    joinMode: 'approval',
    minCreditScore: form.minCreditScore || 0,
    rules,
    tags,
    status: 'recruiting',
  };
}

function getStepErrors(step, form) {
  const errors = []
  const rules = form.rules.map(rule => rule.trim()).filter(Boolean)

  switch (step) {
    case 1:
      if (!form.serviceId) errors.push('請選擇一項訂閱服務')
      break
    case 2:
      if (!form.planName) errors.push('請選擇一項訂閱方案')
      break
    case 3: {
      const service = getServiceById(form.serviceId)
      const plan = service?.plans.find(p => p.name === form.planName)
      const maxSeats = plan?.maxSeats ?? 10
      if (!Number.isInteger(form.recruitHeadcount) || form.recruitHeadcount < 2 || form.recruitHeadcount > maxSeats) {
        errors.push(`開放名額需介於 1 至 ${maxSeats - 1} 人`)
      }
      if (rules.some(rule => rule.length > 80)) errors.push('每條群組規則最多 80 字')
      break
    }
    default:
      break
  }

  return errors
}

function getFirstInvalidStep(form) {
  return [1, 2, 3].find(step => getStepErrors(step, form).length > 0) ?? null
}

export default function CreateGroupModal() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [serviceCategory, setServiceCategory] = useState('all')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    function onOpen() {
      setStep(1)
      setForm(INITIAL_FORM)
      setServiceCategory('all')
      setAgreedToTerms(false)
      setShowPreview(false)
      setIsSubmitting(false)
      setOpen(true)
    }
    window.addEventListener('pm:open-create-group', onOpen)
    return () => window.removeEventListener('pm:open-create-group', onOpen)
  }, [])

  function onChange(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'serviceId') {
        next.planName = ''
        next.pricePerSeat = 0
        next.recruitHeadcount = 2
      }
      if (key === 'planName') {
        const service = getServiceById(next.serviceId)
        const plan = service?.plans.find(p => p.name === value)
        if (plan) {
          next.recruitHeadcount = plan.maxSeats
          next.billingCycle = plan.billingCycle
          next.pricePerSeat = calcPricePerSeat(plan, plan.maxSeats)
        }
      }
      if (key === 'recruitHeadcount') {
        const service = getServiceById(next.serviceId)
        const plan = service?.plans.find(p => p.name === next.planName)
        if (plan) next.pricePerSeat = calcPricePerSeat(plan, value)
      }
      return next
    })
  }

  const stepErrors = getStepErrors(step, form)
  function canNext() {
    return stepErrors.length === 0
  }

  function handleNext() {
    if (canNext() && step < 4) {
      setStep(s => s + 1)
      bodyRef.current?.scrollTo({ top: 0 })
    }
  }

  function handleBack() {
    if (step <= 1) {
      requestClose()
      return
    }
    setStep(s => s - 1)
    bodyRef.current?.scrollTo({ top: 0 })
  }

  function hasProgress() {
    return step > 1 || !!form.serviceId
  }

  function requestClose() {
    if (hasProgress()) {
      setShowDiscardConfirm(true)
      return
    }
    setOpen(false)
  }

  function confirmDiscard() {
    setShowDiscardConfirm(false)
    setOpen(false)
  }

  function handleSubmit() {
    const firstInvalidStep = getFirstInvalidStep(form)
    if (firstInvalidStep) {
      setStep(firstInvalidStep)
      return
    }

    setIsSubmitting(true)
    const groupData = mapFormToGroup(form)
    const host = useAuthStore.getState().getProfile()
    useGroupStore.getState().create(groupData, host, {
      onSaved: saved => {
        suppressNextToast('group_created', saved.id)
        toast(`${service?.name ?? ''}已建立`, 'success', {
          id: `pm-create-group-${saved.id}`,
          icon: <ServiceLogo serviceId={form.serviceId} size={20} />,
          action: {
            label: '前往查看',
            onClick: () => navigate('/manage-groups'),
          },
        })
      },
      onError: err => {
        const conflictGroupId = err.response?.data?.groupId
        if (!conflictGroupId) return false
        toast('已經有此服務的群組', 'error', {
          action: {
            label: '前往查看',
            onClick: () => window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: conflictGroupId } })),
          },
        })
        return true
      },
    })
    setOpen(false)
  }

  const service = getServiceById(form.serviceId)
  const hasEligiblePlans = (service?.plans ?? []).some(p => p.maxSeats > 1)
  const visibleStepErrors = stepErrors.filter(err =>
    err !== '請選擇一項訂閱服務' && (err !== '請選擇一項訂閱方案' || hasEligiblePlans)
  )

  const banner = (() => {
    if (step === 1) {
      return { Icon: form.serviceId ? Info : AlertCircle, text: '請選擇一項訂閱服務' }
    }
    if (step === 2) {
      if (!hasEligiblePlans) return { Icon: AlertCircle, text: '此服務無合購方案，請返回上一步選擇其他服務' }
      if (visibleStepErrors.length > 0) return { Icon: AlertCircle, text: visibleStepErrors[0] }
      return { Icon: Info, text: '請選擇一項訂閱方案' }
    }
    if (step === 3) {
      if (visibleStepErrors.length > 0) return { Icon: AlertCircle, text: visibleStepErrors[0] }
      return { Icon: Info, text: '請設定群組資訊' }
    }
    if (step === 4) return { Icon: Info, text: '請確認以下資訊正確無誤，並詳閱服務條款' }
    return null
  })()

  const CurrentStep = STEP_COMPONENTS[step - 1]

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) requestClose() }}>
        <DialogContent maxWidth="max-w-4xl" height="690px" className="max-h-[calc(100dvh-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle size={18} className="shrink-0 text-brand" strokeWidth={1.5} />
              建立群組
            </DialogTitle>
            <DialogDescription>選擇服務、方案並設定群組資訊以建立共享群組</DialogDescription>
            <DialogCloseButton />
          </DialogHeader>

          {banner && (
            <div className="shrink-0 border-b border-line bg-raised/70 px-6 py-3">
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-brand">
                <banner.Icon size={14} />
                {banner.text}
              </div>
            </div>
          )}

          <div
            ref={bodyRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              key={step}
              className={`animate-step-slide-up ${
                step === 2 || step === 3 ? 'flex min-h-full flex-col justify-center'
                : step === 4 ? 'flex h-full flex-col'
                : ''
              }`}
            >
              {step === 4 ? (
                <Step4Preview form={form} agreedToTerms={agreedToTerms} onAgreedToTermsChange={setAgreedToTerms} />
              ) : step === 1 ? (
                <Step1Service form={form} onChange={onChange} activeCategory={serviceCategory} onCategoryChange={setServiceCategory} />
              ) : (
                <CurrentStep form={form} onChange={onChange} />
              )}
            </div>
          </div>

          <DialogFooter className="flex-col items-stretch gap-4">
            <div className="-mx-6 shrink-0 border-b border-line px-6 pb-4">
              <div className="mb-2 flex items-center gap-1.5">
                {STEP_TITLES.map((label, i) => (
                  <div
                    key={label}
                    className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-brand' : 'bg-line'}`}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {STEP_TITLES.map((label, i) => (
                  <span
                    key={label}
                    className={`flex-1 truncate text-center text-xs font-bold ${i + 1 === step ? 'text-brand' : 'text-ink-3'}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {step === 4 && (
              <Button
                variant="ghost"
                size="md"
                className="w-full rounded-full border border-line lg:hidden"
                onClick={() => setShowPreview(true)}
              >
                <Eye strokeWidth={1.5} size={15} />
                查看預覽
              </Button>
            )}
            <div className="flex justify-between gap-3">
              <Button variant="secondary" size="md" className="w-36" onClick={handleBack}>
                <ChevronLeft size={15} strokeWidth={1.5} />
                {step === 1 ? '取消' : '上一步'}
              </Button>
              {step < 4 ? (
                <Button variant="default" size="md" className="w-36" disabled={!canNext()} onClick={handleNext}>
                  下一步
                  <ChevronRight size={15} strokeWidth={1.5} />
                </Button>
              ) : (
                <Button variant="default" size="md" className="w-36" disabled={!agreedToTerms} loading={isSubmitting} onClick={handleSubmit}>
                  確認建立
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent variant="panel" maxWidth="max-w-xs" className="border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">群組預覽</DialogTitle>
          <DialogDescription>群組預覽</DialogDescription>
          <LivePreviewPanel form={form} />
        </DialogContent>
      </Dialog>

      {showDiscardConfirm && (
        <ConfirmActionDialog
          title="放棄建立這個群組？"
          message="目前選擇的服務、方案與群組設定都不會被保留。"
          confirmLabel="放棄"
          danger
          countdownSeconds={0}
          onConfirm={confirmDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </>
  )
}
