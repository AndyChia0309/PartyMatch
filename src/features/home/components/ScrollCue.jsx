import { useEffect, useRef, useState } from 'react'
import { ChevronsDown } from 'lucide-react'

const IDLE_DELAY = 2000

export default function ScrollCue() {
  const [idle, setIdle] = useState(false)
  const [nearEnd, setNearEnd] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    function resetTimer() {
      setIdle(false)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIdle(true), IDLE_DELAY)
    }

    resetTimer()
    const events = ['scroll', 'wheel', 'touchmove']
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timerRef.current)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [])

  useEffect(() => {
    const lastSection = document.getElementById('section-cta')
    if (!lastSection) return
    const observer = new IntersectionObserver(([entry]) => setNearEnd(entry.isIntersecting))
    observer.observe(lastSection)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center transition-opacity duration-500 can-hover:lg:ml-[6.5rem] can-hover:lg:mr-24 ${
        idle && !nearEnd ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <span className="flex items-center gap-2 rounded-full bg-ink/80 px-4 py-2 text-sm font-bold text-canvas shadow-floating backdrop-blur">
        <ChevronsDown size={16} strokeWidth={1.5} />
        下滑查看更多
        <ChevronsDown size={16} strokeWidth={1.5} />
      </span>
    </div>
  )
}
