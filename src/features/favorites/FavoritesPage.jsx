import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import EmptyState from '../../components/ui/primitives/EmptyState'
import { useAuthStore } from '../../common/stores/useAuthStore'
import PageHeader from '../../common/layout/PageHeader'
import { useFavoriteStore } from '../../common/stores/useFavoriteStore'
import { useGroupStore } from '../../common/stores/useGroupStore'
import { useMemberStore } from '../../common/stores/useMemberStore'
import { useDeferWhileModalOpen } from '../../common/utils/hooks'
import ExploreGroupCard from '../explore/components/ExploreGroupCard'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const activeUser = useAuthStore(s => s.user)
  const favorites = useDeferWhileModalOpen(useFavoriteStore(s => s.favorites))
  const allGroups = useDeferWhileModalOpen(useGroupStore(s => s.groups))
  const members = useDeferWhileModalOpen(useMemberStore(s => s.members))

  useEffect(() => {
    function onForceRefresh(e) {
      if (e.detail?.path !== '/favorites') return
      useFavoriteStore.getState().init()
      useGroupStore.getState().init({ all: true })
      useMemberStore.getState().init()
    }
    window.addEventListener('pm:force-page-refresh', onForceRefresh)
    return () => window.removeEventListener('pm:force-page-refresh', onForceRefresh)
  }, []);

  const groups = useMemo(() => {
    if (!activeUser) return []
    const byId = new Map(allGroups.map(g => [g.id, g]))
    return favorites
      .filter(f => f.userId === activeUser.id)
      .map(f => byId.get(f.groupId))
      .filter(g => g && ((g.status === 'recruiting' && g.openSeats > 0) || g.status === 'full'));
  }, [activeUser, favorites, allGroups])

  const memberGroupIds = useMemo(
    () => new Set(members.filter(m => m.userId === activeUser?.id).map(m => m.groupId)),
    [members, activeUser?.id],
  )

  return (
    <div className="px-2 md:px-4">
      <PageHeader
        title="我的收藏"
        className="mb-6 text-center"
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="尚無收藏群組"
          description="點擊愛心圖示加入收藏"
          actionLabel="探索群組"
          onAction={() => navigate('/explore')}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => (
            <ExploreGroupCard
              key={group.id}
              group={group}
              isMember={memberGroupIds.has(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
