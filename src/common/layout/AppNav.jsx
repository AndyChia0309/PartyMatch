import { Suspense, lazy, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '../utils/toast'
import { useAuthStore } from '../stores/useAuthStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useConversationStore } from '../stores/useConversationStore'
import { useLogout } from '../utils/hooks'
import TopupModal from '../../components/ui/TopupModal'
import SettingsModal from '../../components/ui/SettingsModal'
import ProfileModal from '../../components/ui/ProfileModal'
import CreditScoreModal from '../../components/ui/CreditScoreModal'
import UserReviewsModal from '../../features/manage-groups/components/UserReviewsModal'
import { LOCKED_MESSAGE } from './components/navConstants'
import DesktopSidebar from './components/DesktopSidebar'
import TabletSidebarDrawer from './components/TabletSidebarDrawer'
import { PANEL_OPENED_EVENT, broadcastPanelOpened } from '../utils/panelBroadcast'

const ConditionSearchModal = lazy(() => import('../../features/match/ConditionSearchModal'))

const LOCAL_PANEL_IDS = new Set(['topup', 'settings', 'profile', 'credit-score', 'reviews', 'condition-search'])

export default function AppNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const loggedIn = useAuthStore(s => s.loggedIn)
  const currentUser = useAuthStore(s => s.user)
  const userName = currentUser?.name ?? currentUser?.displayName ?? '使用者'
  const avatarInitial = currentUser?.avatarInitial ?? null
  const avatarColor = currentUser?.avatarColor ?? null
  const presenceStatus = currentUser?.presenceStatus ?? 'online'

  const { loggingOut, logout } = useLogout()
  const [topupOpen, setTopupOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [creditScoreOpen, setCreditScoreOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [conditionSearchOpen, setConditionSearchOpen] = useState(false)

  function closeAllPanels() {
    document.activeElement?.blur()
    setTopupOpen(false)
    setSettingsOpen(false)
    setProfileOpen(false)
    setCreditScoreOpen(false)
    setReviewsOpen(false)
    setConditionSearchOpen(false)
  }

  useEffect(() => {
    window.addEventListener('pm:open-topup', openTopup)
    return () => window.removeEventListener('pm:open-topup', openTopup)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onNavigate(e) {
      if (e.detail?.path) navigate(e.detail.path)
    }
    window.addEventListener('pm:navigate', onNavigate)
    return () => window.removeEventListener('pm:navigate', onNavigate)
  }, [navigate])

  useEffect(() => {
    function openProfileEvent() { closeAllPanels(); setProfileOpen(true); broadcastPanelOpened('profile') }
    window.addEventListener('pm:open-profile', openProfileEvent)
    return () => window.removeEventListener('pm:open-profile', openProfileEvent)
  }, [])

  useEffect(() => {
    function openConditionSearchEvent() { closeAllPanels(); setConditionSearchOpen(true); broadcastPanelOpened('condition-search') }
    window.addEventListener('pm:open-condition-search', openConditionSearchEvent)
    return () => window.removeEventListener('pm:open-condition-search', openConditionSearchEvent)
  }, [])

  useEffect(() => {
    function onPanelOpened(e) {
      if (!LOCAL_PANEL_IDS.has(e.detail?.panelId)) closeAllPanels()
    }
    window.addEventListener(PANEL_OPENED_EVENT, onPanelOpened)
    return () => window.removeEventListener(PANEL_OPENED_EVENT, onPanelOpened)
  }, [])

  const unreadNotifs = useNotificationStore(s => loggedIn && currentUser?.id ? s.getUnreadCount(currentUser.id) : 0)
  const unreadMsgs = useConversationStore(s => loggedIn && currentUser?.id ? s.getUnreadMsgCount(currentUser.id) : 0)

  function openTopup() {
    closeAllPanels()
    setTopupOpen(true)
    broadcastPanelOpened('topup')
  }

  function openCreate() {
    closeAllPanels()
    if (!loggedIn) return
    window.dispatchEvent(new CustomEvent('pm:open-create-group'))
  }

  function openConditionSearch() {
    closeAllPanels()
    window.dispatchEvent(new CustomEvent('pm:open-condition-search'))
  }

  function openNotify() {
    closeAllPanels()
    window.dispatchEvent(new CustomEvent('pm:open-notify'))
  }

  function openMessages() {
    if (!loggedIn) return
    closeAllPanels()
    window.dispatchEvent(new CustomEvent('pm:open-messages'))
  }

  function openSettings() {
    closeAllPanels()
    setSettingsOpen(true)
    broadcastPanelOpened('settings')
  }

  function openProfile() {
    closeAllPanels()
    setProfileOpen(true)
    broadcastPanelOpened('profile')
  }

  function openCreditScore() {
    closeAllPanels()
    setCreditScoreOpen(true)
    broadcastPanelOpened('credit-score')
  }

  function openReviews() {
    closeAllPanels()
    setReviewsOpen(true)
    broadcastPanelOpened('reviews')
  }

  function preventLockedAction(e) {
    e.preventDefault()
    e.stopPropagation()
    closeAllPanels()
    toast(LOCKED_MESSAGE, 'info', {
      action: {
        label: '前往登入',
        onClick: () => navigate('/login'),
      },
    })
  }

  return (
    <>
      <DesktopSidebar
        loggedIn={loggedIn}
        pathname={pathname}
        userName={userName}
        avatarInitial={avatarInitial}
        avatarColor={avatarColor}
        presenceStatus={presenceStatus}
        unreadNotifs={unreadNotifs}
        unreadMsgs={unreadMsgs}
        openTopup={openTopup}
        closeAll={closeAllPanels}
        openCreate={openCreate}
        openConditionSearch={openConditionSearch}
        openNotify={openNotify}
        openMessages={openMessages}
        openSettings={openSettings}
        openProfile={openProfile}
        openCreditScore={openCreditScore}
        openReviews={openReviews}
        preventLockedAction={preventLockedAction}
        logout={logout}
        loggingOut={loggingOut}
      />

      <TabletSidebarDrawer
        loggedIn={loggedIn}
        pathname={pathname}
        userName={userName}
        avatarInitial={avatarInitial}
        avatarColor={avatarColor}
        presenceStatus={presenceStatus}
        host={{ id: currentUser?.id, displayName: userName, avatarInitial, avatarColor }}
        closeAll={closeAllPanels}
        openCreate={openCreate}
        openConditionSearch={openConditionSearch}
        preventLockedAction={preventLockedAction}
        logout={logout}
        loggingOut={loggingOut}
      />

      <TopupModal isOpen={topupOpen} onClose={() => setTopupOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <CreditScoreModal isOpen={creditScoreOpen} onClose={() => setCreditScoreOpen(false)} />
      <UserReviewsModal
        isOpen={reviewsOpen}
        onClose={() => setReviewsOpen(false)}
        user={{ id: currentUser?.id, displayName: userName, avatarInitial, avatarColor }}
      />
      <Suspense fallback={null}>
        <ConditionSearchModal isOpen={conditionSearchOpen} onClose={() => setConditionSearchOpen(false)} />
      </Suspense>
    </>
  )
}
