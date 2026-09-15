import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { toast } from '../../../common/utils/toast'
import { LOCKED_MESSAGE } from '../../../common/layout/components/navConstants'
import { HOME_AUDIENCES } from '../data/homeContent'

function audiencePhotoUrl({ photo, photoSeed }) {
  return photo ?? `https://picsum.photos/seed/${photoSeed}/400/500`
}

function AudienceCard({ photo, photoSeed, title, desc, tall }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl text-left ${tall ? 'row-span-2 min-h-[280px] lg:min-h-0' : 'min-h-[132px]'}`}
    >
      <img
        src={audiencePhotoUrl({ photo, photoSeed })}
        alt={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-extrabold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/80">{desc}</p>
      </div>
    </div>
  )
}

export default function AudienceGrid() {
  const navigate = useNavigate()
  const loggedIn = useAuthStore(s => s.loggedIn)

  return (
    <section className="flex w-full flex-col items-center gap-10">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-3xl font-extrabold text-ink">
          適合每一種共享生活
        </h2>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-ink-3">
          不論是學生、情侶、家庭或工作夥伴
          <br />
          自己開團，輕鬆管理
        </p>
      </div>

      <div className="-mx-3 grid w-[calc(100%+1.5rem)] grid-cols-2 grid-rows-2 gap-3 sm:mx-0 sm:w-full sm:grid-cols-3 sm:gap-4">
        {HOME_AUDIENCES.map((audience, i) => (
          <AudienceCard key={audience.title} {...audience} tall={i === 0} />
        ))}
      </div>

      <Button
        size="lg"
        className="rounded-full px-8"
        onClick={() => loggedIn ? window.dispatchEvent(new CustomEvent('pm:open-create-group')) : toast(LOCKED_MESSAGE, 'info', {
          action: {
            label: '前往登入',
            onClick: () => navigate('/login'),
          },
        })}
      >
        立即建立群組
        <ChevronRight size={14} strokeWidth={1.5} />
      </Button>
    </section>
  )
}
