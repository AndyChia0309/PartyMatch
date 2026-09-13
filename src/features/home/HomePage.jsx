import { lazy, Suspense, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Compass } from 'lucide-react'
import { Button } from '../../components/ui/button'
import logoUrl from '../../assets/Logo.svg'
import { useAuthStore } from '../../common/stores/useAuthStore'
import AppNav from '../../common/layout/AppNav'
import AppFooter from '../../common/layout/AppFooter'
import NotificationCenter from '../../common/layout/NotificationCenter'
import ServiceLogo from '../../components/ui/ServiceLogo'
import BubbleField from './components/BubbleField'
import ScrollCue from './components/ScrollCue'
import FeaturedGroupsCarousel from './components/FeaturedGroupsCarousel'
import AudienceGrid from './components/AudienceGrid'
import IntroSection from './components/IntroSection'
import WhyUs from './components/WhyUs'
import FAQ from './components/FAQ'
import SectionNav from './components/SectionNav'
import RevealSection from '../../components/ui/primitives/RevealSection'
import { ALL_SERVICES } from './data/allServices'

const MessagesModal = lazy(() => import('../messages/MessagesModal'))
const GroupDetailModal = lazy(() => import('../group/GroupDetailModal'));
const CreateGroupModal = lazy(() => import('../create/CreateGroupModal'))
const HostGroupModalHost = lazy(() => import('../manage-groups/HostGroupModalHost'))

export default function HomePage() {
  const navigate = useNavigate()
  const loggedIn = useAuthStore(s => s.loggedIn)

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink can-hover:lg:ml-[6.5rem] can-hover:lg:mr-24">
      <AppNav />
      <Suspense fallback={null}>
        <MessagesModal />
        <GroupDetailModal />
        <CreateGroupModal />
        <HostGroupModalHost />
      </Suspense>
      <NotificationCenter />
      <SectionNav />
      <ScrollCue />

      <section id="section-hero" className="relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden pb-32 pt-28 text-center lg:pb-20 lg:pt-16">
        <BubbleField count={9} size={46} />

        <RevealSection className="relative mx-auto w-full max-w-3xl px-5">
          <img src={logoUrl} alt="PartyMatch" className="mx-auto mb-5 h-14 w-auto" />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl">
            Party<span className="text-brand">Match</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink-3">
            共享訂閱服務平台
          </p>

          <div className="mt-8 flex items-center justify-center">
            <Button size="lg" className="rounded-full px-8" onClick={() => navigate('/explore')}>
              <Compass size={16} strokeWidth={1.5} />
              探索群組
            </Button>
          </div>
        </RevealSection>
      </section>

      <section id="section-intro" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
        <RevealSection className="mx-auto w-full max-w-3xl">
          <IntroSection />
        </RevealSection>
      </section>

      <section id="section-audience" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
        <RevealSection className="mx-auto w-full max-w-3xl">
          <AudienceGrid />
        </RevealSection>
      </section>

      <section id="section-why-us" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
        <RevealSection className="mx-auto w-full max-w-3xl">
          <WhyUs />
        </RevealSection>
      </section>

      <FeaturedGroupsCarousel />

      <section id="section-faq" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
        <RevealSection className="mx-auto w-full max-w-3xl">
          <FAQ />
        </RevealSection>
      </section>

      <section id="section-cta" className="relative flex w-full min-h-[60svh] flex-col items-center justify-center px-5 py-20 can-hover:lg:py-28">
        <RevealSection className="mx-auto w-full max-w-3xl text-center">
          <div className="px-5 py-10 sm:px-8 sm:py-12">
            <h2 className="text-2xl font-extrabold text-ink md:text-3xl">立即開始共享訂閱之旅</h2>
            <p className="mt-3 text-base text-ink-3">加入 PartyMatch，享受更聰明的訂閱生活！</p>

            <div className="mt-7 flex items-center justify-center gap-3 sm:gap-4">
              <Button size="lg" className="rounded-full px-5 sm:px-8" onClick={() => navigate('/explore')}>
                <Compass size={16} strokeWidth={1.5} />
                探索群組
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full px-5 sm:px-8"
                onClick={() => loggedIn ? window.dispatchEvent(new CustomEvent('pm:open-create-group')) : navigate('/register')}
              >
                建立群組
                <ChevronRight size={15} strokeWidth={1.5} />
              </Button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              {ALL_SERVICES.slice(0, 5).map(s => (
                <ServiceLogo key={s.id} serviceId={s.id} size={32} />
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      <AppFooter />
    </div>
  )
}
