import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from './toast'
import { useAuthStore } from '../stores/useAuthStore'
import { resolveImageMime } from '../api/storageApi'
import { useModalStackStore } from '../stores/useModalStackStore'

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = e => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

let _lockCount = 0;

let _lockedScrollY = 0;

export function useScrollLock(enabled) {
  useEffect(() => {
    if (!enabled) return
    _lockCount++
    if (_lockCount === 1) {
      _lockedScrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${_lockedScrollY}px`
      document.body.style.left = '0'
      document.body.style.width = `${document.documentElement.clientWidth}px`
    }
    return () => {
      _lockCount--
      if (_lockCount === 0) {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.width = ''
        window.scrollTo(0, _lockedScrollY)
      }
    }
  }, [enabled])
}

export function useModalOpenTracking(open) {
  useEffect(() => {
    if (!open) return
    useModalStackStore.getState().push()
    return () => {
      queueMicrotask(() => useModalStackStore.getState().pop())
    }
  }, [open])
}

export function useDeferWhileModalOpen(value) {
  const isModalOpen = useModalStackStore(s => s.count > 0)
  const [frozen, setFrozen] = useState(value)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isModalOpen) setFrozen(value)
  }, [isModalOpen, value])
  return isModalOpen ? frozen : value
}

const _pointerDownSubs = new Set();
function _notifyPointerDown(e) {
  _pointerDownSubs.forEach(fn => fn(e))
}
function subscribePointerDown(fn) {
  _pointerDownSubs.add(fn)
  if (_pointerDownSubs.size === 1) document.addEventListener('pointerdown', _notifyPointerDown)
  return () => {
    _pointerDownSubs.delete(fn)
    if (_pointerDownSubs.size === 0) document.removeEventListener('pointerdown', _notifyPointerDown)
  }
}

export function useCountdown(deadline) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadline])

  if (!deadline) return { label: null, expired: false }

  const remainingMs = new Date(deadline).getTime() - now
  if (remainingMs <= 0) return { label: null, expired: true }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours   = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = n => String(n).padStart(2, '0')
  const label = hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`

  return { label, expired: false }
}

export function useConfirmCountdown(seconds) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  return { remaining, ready: remaining <= 0 }
}

const EVIDENCE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic'];
const EVIDENCE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function useEvidenceUpload(uploadFn) {
  const [key, setKey]             = useState('')
  const [url, setUrl]             = useState('')
  const [name, setName]           = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)

  async function onSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!EVIDENCE_MIME_TYPES.includes(resolveImageMime(file))) {
      toast('僅支援圖片格式（PNG／JPG／GIF／WEBP／HEIC）', 'error')
      return
    }
    if (file.size > EVIDENCE_MAX_SIZE_BYTES) {
      toast('附件檔案大小不能超過 5MB', 'error')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const uploaded = await uploadFn(file, setProgress)
      setKey(uploaded.key)
      setUrl(uploaded.url)
      setName(file.name)
    } catch (err) {
      toast(err?.message ?? '附件上傳失敗，請稍後再試', 'error')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function reset() {
    setKey('')
    setUrl('')
    setName('')
    setProgress(0)
  }

  return { key, url, name, uploading, progress, onSelect, onRemove: reset, reset }
}

export function useClickOutside(enabled, refs, onClose) {
  const refsRef = useRef(refs)
  const onCloseRef = useRef(onClose)
  useEffect(() => { refsRef.current = refs; onCloseRef.current = onClose })

  useEffect(() => {
    if (!enabled) return
    return subscribePointerDown(e => {
      if (e.target.closest?.('[data-image-lightbox]')) return
      if (refsRef.current.every(ref => !ref.current?.contains(e.target))) onCloseRef.current()
    })
  }, [enabled])
}

export function useLogout() {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = useCallback(async () => {
    setLoggingOut(true)
    await useAuthStore.getState().logout()
    navigate('/login', { replace: true })
  }, [navigate])

  return { loggingOut, logout }
}
