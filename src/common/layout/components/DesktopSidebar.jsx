import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Bell, ChevronRight, Lock, LogIn, LogOut, Menu, MessageSquare, Moon, Settings, ShieldCheck, Star, Sun, User, X } from 'lucide-react'
import logoUrl from '../../../assets/Logo.svg'
import { NAV_SECTIONS } from '../nav'
import { useTheme } from '../../../components/theme-provider'
import { Avatar } from '../../../components/ui/avatar'
import { TokenBadge } from '../../../components/ui/TokenAmount'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../../components/ui/dropdown-menu'
import { CountBadge, LockBadge, LockedHint, PresenceDot } from './navShared'
import { LOCKED_MESSAGE, getNavItemKey, isProtectedNavItem } from './navConstants'

const FLOATING_ICON_BUTTON_CLASS = 'relative grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-floating transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand lg:h-12 lg:w-12 dark:border-[#238EC7] dark:text-[#238EC7]'

export default function DesktopSidebar({
  loggedIn,
  pathname,
  userName,
  avatarInitial,
  avatarColor,
  presenceStatus,
  unreadNotifs,
  unreadMsgs,
  openTopup,
  closeAll,
  openCreate,
  openConditionSearch,
  openNotify,
  openMessages,
  openSettings,
  openProfile,
  openCreditScore,
  openReviews,
  preventLockedAction,
  logout,
  loggingOut,
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [lockedTip, setLockedTip] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [forceCollapsed, setForceCollapsed] = useState(false)
  const [dockOpen, setDockOpen] = useState(false)
  const dockRef = useRef(null)

  useEffect(() => {
    if (!dockOpen) return
    function onPointerDown(e) {
      if (!dockRef.current?.contains(e.target)) setDockOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [dockOpen])

  function goTo(to) {
    window.dispatchEvent(new CustomEvent('pm:force-route-transition'))
    if (to === pathname) {
      window.dispatchEvent(new CustomEvent('pm:force-page-refresh', { detail: { path: to } }))
    }
    navigate(to)
  }

  function collapseSidebar() {
    document.activeElement?.blur()
    setForceCollapsed(true)
  }

  function isGuestLocked(item) {
    return !loggedIn && isProtectedNavItem(item)
  }

  function renderSideItem(item) {
    if (isGuestLocked(item)) {
      const Icon = item.icon ?? Lock

      return (
        <button
          key={getNavItemKey(item)}
          type="button"
          aria-label={`${item.label}，${LOCKED_MESSAGE}`}
          onClick={e => { collapseSidebar(); preventLockedAction(e) }}
          onMouseEnter={e => setLockedTip({ top: e.clientY + 14, left: e.clientX + 12 })}
          onMouseMove={e => setLockedTip({ top: e.clientY + 14, left: e.clientX + 12 })}
          onMouseLeave={() => setLockedTip(null)}
          className="relative flex h-12 w-full items-center gap-3 rounded-2xl px-1 text-ink-4 transition-colors hover:bg-raised"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center">
            <Icon size={22} strokeWidth={1.5} />
            <LockBadge className="right-0 top-0" />
          </span>
          <span className="whitespace-nowrap font-bold opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
            {item.label}
          </span>
        </button>
      )
    }

    if (item.type === 'create' || item.type === 'condition-search') {
      const handleClick = item.type === 'create' ? openCreate : openConditionSearch
      return (
        <button key={item.type} onClick={() => { collapseSidebar(); handleClick() }} aria-label={item.label}
          className="flex h-12 w-full items-center gap-3 rounded-2xl px-1 text-ink-2 transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand">
          <span className="grid h-9 w-9 shrink-0 place-items-center">
            <item.icon size={22} strokeWidth={1.5} />
          </span>
          <span className="whitespace-nowrap font-bold opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
            {item.label}
          </span>
        </button>
      )
    }

    const isActive = pathname === item.to
    return (
      <a
        key={item.to}
        href={item.to}
        onClick={e => { e.preventDefault(); closeAll(); collapseSidebar(); goTo(item.to) }}
        className={`flex h-12 w-full items-center gap-3 rounded-2xl px-1 text-base transition-all hover:-translate-y-0.5 ${
          isActive
            ? 'bg-brand font-extrabold text-white'
            : 'font-bold text-ink-2 hover:bg-brand-subtle hover:text-brand'
        }`}
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center">
          <item.icon size={22} strokeWidth={1.5} />
        </span>
        <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
          {item.label}
        </span>
      </a>
    )
  }

  function renderNotifyButton() {
    return (
      <button
        onClick={openNotify}
        className={FLOATING_ICON_BUTTON_CLASS}
        aria-label="通知"
      >
        <Bell className="size-6 lg:size-5" strokeWidth={1.5} />
        <CountBadge count={unreadNotifs} />
      </button>
    )
  }

  function renderTopupButton() {
    if (!loggedIn) return null
    return (
      <button
        onClick={openTopup}
        className={FLOATING_ICON_BUTTON_CLASS}
        aria-label="PM幣儲值"
      >
        <TokenBadge className="!h-7 !w-7 lg:!h-6 lg:!w-6" />
      </button>
    )
  }

  function renderThemeButton() {
    return (
      <button
        onClick={toggleTheme}
        className={FLOATING_ICON_BUTTON_CLASS}
        aria-label={theme === 'dark' ? '切換成淺色模式' : '切換成深色模式'}
      >
        {theme === 'dark' ? <Sun className="size-6 lg:size-5" strokeWidth={1.5} /> : <Moon className="size-6 lg:size-5" strokeWidth={1.5} />}
      </button>
    )
  }

  function renderMessageButton() {
    if (loggedIn) {
      return (
        <button
          onClick={openMessages}
          className={FLOATING_ICON_BUTTON_CLASS}
          aria-label="訊息"
        >
          <MessageSquare className="size-6 lg:size-5" strokeWidth={1.5} />
          <CountBadge count={unreadMsgs} className="-right-1.5 -top-1.5" />
        </button>
      )
    }
    return (
      <button
        type="button"
        aria-disabled="true"
        aria-label={`訊息，${LOCKED_MESSAGE}`}
        onClick={e => preventLockedAction(e)}
        className="group/locked relative grid h-14 w-14 cursor-not-allowed place-items-center rounded-full border border-line bg-surface text-ink-2 opacity-40 shadow-floating lg:h-12 lg:w-12 dark:border-[#238EC7] dark:text-[#238EC7]"
      >
        <MessageSquare className="size-6 lg:size-5" strokeWidth={1.5} />
        <LockBadge className="right-1 top-1" />
        <LockedHint className="right-full top-1/2 mr-2 -translate-y-1/2" />
      </button>
    )
  }

  return (
    <>
      {lockedTip && createPortal(
        <span
          className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-canvas shadow-popover"
          style={{ top: lockedTip.top, left: lockedTip.left }}
        >
          {LOCKED_MESSAGE}
        </span>,
        document.body
      )}

      <div className="fixed right-6 top-6 z-50 hidden flex-col gap-3 can-hover:lg:flex lg:top-8">
        {renderNotifyButton()}
        {renderTopupButton()}
        {renderThemeButton()}
      </div>
      <div className="fixed right-6 z-50 hidden flex-col gap-3 can-hover:lg:flex" style={{ bottom: '2.25rem' }}>
        {renderMessageButton()}
      </div>
      <div className="fixed bottom-9 right-6 z-50 flex flex-col gap-3 can-hover:lg:hidden">
        {renderMessageButton()}
      </div>

      <div ref={dockRef} className="fixed right-6 top-6 z-50 flex flex-col items-center gap-3 can-hover:lg:hidden">
        <button
          onClick={() => setDockOpen(o => !o)}
          className={FLOATING_ICON_BUTTON_CLASS}
          aria-label={dockOpen ? '收合功能按鈕' : '展開功能按鈕'}
          aria-expanded={dockOpen}
        >
          {dockOpen ? <X className="size-6 lg:size-5" strokeWidth={1.5} /> : <Menu className="size-6 lg:size-5" strokeWidth={1.5} />}
          {!dockOpen && unreadNotifs > 0 && (
            <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-surface bg-danger" />
          )}
        </button>
        {dockOpen && (
          <>
            {renderNotifyButton()}
            {renderTopupButton()}
            <button
              onClick={() => { toggleTheme(); setDockOpen(false) }}
              className={FLOATING_ICON_BUTTON_CLASS}
              aria-label={theme === 'dark' ? '切換成淺色模式' : '切換成深色模式'}
            >
              {theme === 'dark' ? <Sun className="size-6 lg:size-5" strokeWidth={1.5} /> : <Moon className="size-6 lg:size-5" strokeWidth={1.5} />}
            </button>
          </>
        )}
      </div>
      <aside
        data-force-open={userMenuOpen ? 'true' : undefined}
        onMouseLeave={() => setForceCollapsed(false)}
        style={forceCollapsed ? { width: '4rem' } : undefined}
        className="group/nav fixed bottom-4 left-4 top-4 z-50 hidden w-16 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-floating transition-[width] duration-300 ease-out hover:w-64 has-[:focus-visible]:w-64 data-[force-open=true]:w-64 can-hover:lg:flex"
      >
        <a
          href="/"
          onClick={e => { e.preventDefault(); closeAll(); collapseSidebar(); goTo('/') }}
          className="flex h-16 shrink-0 items-center gap-3 px-4"
          aria-label="回首頁"
        >
          <img src={logoUrl} alt="PartyMatch" className="h-8 w-8 shrink-0" />
          <span className="whitespace-nowrap text-lg font-extrabold opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
            <span className="text-brand">Party</span><span className="text-ink">Match</span>
          </span>
        </a>

        <nav className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="my-auto space-y-6">
            {NAV_SECTIONS.flatMap(section => section.items).map(renderSideItem)}
          </div>
        </nav>

        <div className="px-2 pb-4">
          {loggedIn ? (
            <DropdownMenu onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="使用者選單"
                  className="flex h-14 w-full items-center gap-3 rounded-2xl px-1 text-left transition-all hover:-translate-y-0.5 hover:bg-brand-subtle"
                >
                  <span className="relative shrink-0 shadow-md rounded-full">
                    <Avatar initial={avatarInitial} color={avatarColor} size="md" />
                    <PresenceDot status={presenceStatus} className="absolute bottom-0 right-0 h-3 w-3" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2 opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
                    <span className="block min-w-0 flex-1 truncate text-sm font-extrabold text-ink">{userName}</span>
                    <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                alignOffset={-16}
                sideOffset={10}
                avoidCollisions={false}
                className="w-40"
                onCloseAutoFocus={e => e.preventDefault()}
              >
                <DropdownMenuItem onClick={() => openProfile()}>
                  <User size={16} strokeWidth={1.5} className="shrink-0" />
                  個人資料
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreditScore()}>
                  <ShieldCheck size={16} strokeWidth={1.5} className="shrink-0" />
                  信用分數
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openReviews()}>
                  <Star size={16} strokeWidth={1.5} className="shrink-0" />
                  我的評價
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openSettings()}>
                  <Settings size={16} strokeWidth={1.5} className="shrink-0" />
                  偏好設定
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { collapseSidebar(); logout() }}
                  disabled={loggingOut}
                  className="text-danger data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger"
                >
                  <LogOut size={16} strokeWidth={1.5} className="shrink-0" />
                  {loggingOut ? '登出中…' : '登出'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a
              href="/login"
              onClick={e => { e.preventDefault(); closeAll(); collapseSidebar(); goTo('/login') }}
              aria-label="登入會員"
              className="flex h-14 w-full items-center gap-3 rounded-2xl px-1 text-left text-ink-2 transition-all hover:-translate-y-0.5 hover:bg-brand-subtle hover:text-brand"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center">
                <LogIn size={22} strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100 group-data-[force-open=true]/nav:opacity-100">
                <span className="block truncate text-sm font-extrabold">登入會員</span>
              </span>
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
