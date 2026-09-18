import { ChevronRight, CheckCircle2, LogIn, LogOut, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import FavoriteToggleButton from '../../../components/ui/FavoriteToggleButton'
import { getGroupFooterAction } from '../../../common/utils/memberGroupDisplay'

function renderCTA({
  group, activeUserId, navigate, handleClose,
  isHost, isWaitingMembers, needsFillInfo, hasServiceInfoIssue, isSharedCredentials,
  isMember, isFull,
  redirectAfterLogin,
}) {
  const action = getGroupFooterAction({ activeUserId, isHost, isWaitingMembers, needsFillInfo, isMember, isFull })

  if (action === 'login') return (
    <Button variant="default" size="lg" className="w-full"
      onClick={() => navigate('/login', { state: redirectAfterLogin })}>
      <LogIn strokeWidth={1.5} size={16} />登入以加入群組
    </Button>
  )
  if (action === 'host') return (
    <div className="flex items-center justify-center gap-2 rounded-lg bg-brand-subtle px-4 py-3 text-sm font-medium text-brand">
      <ShieldCheck strokeWidth={1.5} size={15} />你是此群組的團主
    </div>
  )
  if (action === 'waiting') return null
  if (action === 'fillInfo') return (
    <div className="flex justify-center">
      <Button
        variant={hasServiceInfoIssue ? 'destructive' : 'default'}
        size="lg"
        className="w-full"
        onClick={() => {
          handleClose()
          navigate('/my-subscriptions', {
            state: { openGroupId: group.id, ...(hasServiceInfoIssue ? { openCredentials: true } : {}) },
          })
        }}
      >
        {hasServiceInfoIssue ? '修正帳號資訊' : isSharedCredentials ? '提取帳號資訊' : '填寫帳號資訊'}
      </Button>
    </div>
  )
  if (action === 'member') return (
    <div className="flex items-center justify-center gap-2 rounded-lg bg-success-subtle px-4 py-3 text-sm font-medium text-success-text">
      <CheckCircle2 strokeWidth={1.5} size={15} />已加入此群組
    </div>
  )
  if (action === 'full') return (
    <Button variant="ghost" size="lg" className="w-full border border-line" disabled>已額滿</Button>
  )
  return null
}

export function buildMobileFooter({
  group, activeUserId, navigate, handleClose,
  isHost, isWaitingMembers, needsFillInfo, hasServiceInfoIssue, isSharedCredentials,
  isMember, isPendingApp, isFull, canApply, isFav,
  setCancelConfirm,
  setShowMembers, setLeaveConfirm, onApplyClick, toggleFav,
  padded = true,
  redirectAfterLogin,
}) {
  return (
    <div className={padded ? 'px-6 py-3' : 'py-3'}>
      {isWaitingMembers ? (
        <div className="grid grid-cols-2 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto flex-col gap-1 py-2 text-xs"
            onClick={() => setShowMembers(true)}
          >
            <Users strokeWidth={1.5} size={17} /> 群組名單
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto flex-col gap-1 py-2 text-xs text-danger hover:bg-danger-subtle"
            onClick={() => setLeaveConfirm(true)}
          >
            <LogOut strokeWidth={1.5} size={17} /> 退出群組
          </Button>
        </div>
      ) : canApply ? (
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            className="flex-1"
            onClick={onApplyClick}
          >
            申請加入 <ChevronRight size={16} strokeWidth={1.5} />
          </Button>
          <FavoriteToggleButton isFav={isFav} onClick={toggleFav} heartSize={18} className="h-12 w-12" />
        </div>
      ) : isPendingApp ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 border border-line text-ink-3 hover:border-danger hover:text-danger"
            onClick={() => setCancelConfirm(true)}
          >
            取消申請
          </Button>
          <FavoriteToggleButton isFav={isFav} onClick={toggleFav} heartSize={18} className="h-12 w-12" />
        </div>
      ) : (
        renderCTA({
          group, activeUserId, navigate, handleClose,
          isHost, isWaitingMembers, needsFillInfo, hasServiceInfoIssue, isSharedCredentials,
          isMember, isFull,
          redirectAfterLogin,
        })
      )}
    </div>
  )
}
