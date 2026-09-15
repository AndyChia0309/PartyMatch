import { useEffect, useRef, useState } from 'react'

let routeTransitionActive = false
const routeTransitionListeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('pm:route-transition', e => {
    routeTransitionActive = !!e.detail?.active
    routeTransitionListeners.forEach(fn => fn(routeTransitionActive))
  })
}

export default function RevealSection({ children, delay = 0, className = '' }) {
  const outerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [blocked, setBlocked] = useState(routeTransitionActive)

  useEffect(() => {
    routeTransitionListeners.add(setBlocked)
    return () => routeTransitionListeners.delete(setBlocked)
  }, []);

  useEffect(() => {
    if (blocked) return
    const el = outerRef.current
    if (!el)
      return;

    let observer;
    const raf = requestAnimationFrame(() => {
      observer = new IntersectionObserver(
        ([entry]) => setVisible(entry.isIntersecting),
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      )
      observer.observe(el)
    })
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [blocked])

  return (
    <div ref={outerRef} className={className}>
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? 0 : 20}px)`,
          transition: `opacity 0.75s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}ms, transform 0.75s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
