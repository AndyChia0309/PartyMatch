import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Search } from 'lucide-react'
import { useGroupStore } from '../../../common/stores/useGroupStore'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { Button } from '../../../components/ui/button'
import ExploreGroupCard from '../../explore/components/ExploreGroupCard'
import RevealSection from '../../../components/ui/primitives/RevealSection'
import { useSwipeCarousel, resolveCarouselOffset } from '../hooks/useSwipeCarousel'
import { selectFeaturedGroups } from '../utils/selectFeaturedGroups'

export default function FeaturedGroupsCarousel() {
  const navigate = useNavigate()
  const groups = useGroupStore(s => s.groups)
  const activeUserId = useAuthStore(s => s.user?.id)
  const [focusIndex, setFocusIndex] = useState(0)

  const featured = useMemo(() => selectFeaturedGroups(groups, activeUserId), [groups, activeUserId])
  const count = featured.length
  const depth = Math.min(2, Math.floor((count - 1) / 2));

  const { onPointerDown, onPointerUp } = useSwipeCarousel(count, setFocusIndex);

  if (count === 0) return null

  return (
    <section id="section-featured-groups" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
      <RevealSection className="mx-auto w-full max-w-5xl">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-3xl font-extrabold text-ink">探索適合你的共享群組</h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-3">
            依照需求搜尋、篩選條件，快速找到適合的群組。
          </p>
        </div>

        <div className="relative -mx-5 mt-4 w-[calc(100%+2.5rem)] overflow-x-clip sm:mx-0 sm:mt-10 sm:w-full">
          <div
            className="relative h-[460px] touch-pan-y select-none [perspective:1400px]"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            {featured.map((g, i) => {
              const offset = resolveCarouselOffset(i, focusIndex, count)
              const abs = Math.abs(offset)
              if (abs > depth) return null

              const isFocused = offset === 0
              const scale = 1 - abs * 0.16
              const rotateY = offset * -22
              const translateX = offset * 58
              const blurPx = isFocused ? 0 : abs * 1.5
              const opacity = isFocused ? 1 : abs === 1 ? 0.75 : 0.4

              return (
                <div
                  key={g.id}
                  onClick={!isFocused ? () => setFocusIndex(i) : undefined}
                  className={`absolute left-1/2 top-1/2 w-72 transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-80 lg:w-[22rem] ${!isFocused ? 'cursor-pointer' : ''}`}
                  style={{
                    transform: `translate(-50%, -50%) translateX(${translateX}%) rotateY(${rotateY}deg) scale(${scale})`,
                    filter: blurPx ? `blur(${blurPx}px)` : 'none',
                    opacity,
                    zIndex: 10 - abs,
                    willChange: 'transform, opacity, filter',
                  }}
                >
                  <div className={!isFocused ? 'pointer-events-none' : ''}>
                    <ExploreGroupCard group={g} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
          <Button size="lg" className="rounded-full px-8" onClick={() => navigate('/explore')}>
            <Compass size={16} strokeWidth={1.5} />
            探索群組
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full px-8"
            onClick={() => window.dispatchEvent(new CustomEvent('pm:open-condition-search'))}
          >
            <Search size={16} strokeWidth={1.5} />
            條件搜尋
          </Button>
        </div>
      </RevealSection>
    </section>
  );
}
