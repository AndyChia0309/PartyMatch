import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppNav from './AppNav'
import AppFooter from './AppFooter'
import NotificationCenter from './NotificationCenter'

const GroupDetailModal = lazy(() => import('../../features/group/GroupDetailModal'))
const MessagesModal = lazy(() => import('../../features/messages/MessagesModal'))
const CreateGroupModal = lazy(() => import('../../features/create/CreateGroupModal'))
const HostGroupModalHost = lazy(() => import('../../features/manage-groups/HostGroupModalHost'))

function RouteScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <RouteScrollReset />
      <AppNav />

      <main className="flex flex-col can-hover:lg:ml-[6.5rem] can-hover:lg:mr-24">
        <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pt-8 pb-12 lg:max-w-[clamp(80rem,100vw,90rem)] lg:px-2">
          <Outlet />
        </div>
        <AppFooter />
      </main>
      <NotificationCenter />
      <Suspense fallback={null}>
        <MessagesModal />
        <GroupDetailModal />
        <CreateGroupModal />
        <HostGroupModalHost />
      </Suspense>
    </div>
  );
}
