import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { useClickOutside } from '../../../common/utils/hooks'
import { UpdateDot } from '../../../common/layout/components/navShared'

export default function FilterSelect({ id, group, value, onChange, groups, triggerContent, className = '', listClassName = '', ariaLabel }) {
  const open = group.openKey === id
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const listboxId = useId()
  const typeaheadRef = useRef({ text: '', timer: null })
  const rafRef = useRef(null)

  useEffect(() => {
    if (open || !mounted) return
    const timer = setTimeout(() => setMounted(false), 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!mounted || !open) return
    const raf1 = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setVisible(true))
    })
    rafRef.current = raf1
    return () => cancelAnimationFrame(rafRef.current)
  }, [mounted, open])

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups])

  function close() {
    group.setOpenKey(k => (k === id ? null : k))
    setActiveIndex(-1)
    setVisible(false)
  }

  function openList() {
    const idx = flatItems.findIndex(i => i.value === value)
    setActiveIndex(idx >= 0 ? idx : 0)
    setMounted(true)
    setVisible(false)
    group.setOpenKey(id)
  }

  useClickOutside(open, [rootRef], close)

  useEffect(() => {
    if (open && activeIndex >= 0) {
      listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex])

  function selectItem(idx) {
    const item = flatItems[idx]
    if (!item) return
    onChange(item.value)
    close()
    triggerRef.current?.focus()
  }

  function typeahead(char) {
    const state = typeaheadRef.current
    clearTimeout(state.timer)
    state.text += char.toLowerCase()
    state.timer = setTimeout(() => { state.text = '' }, 500)
    const startFrom = activeIndex >= 0 ? activeIndex + 1 : 0
    const ordered = [...flatItems.slice(startFrom), ...flatItems.slice(0, startFrom)]
    const match = ordered.find(i => i.label.toLowerCase().startsWith(state.text))
    if (match) setActiveIndex(flatItems.indexOf(match))
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => Math.min(flatItems.length - 1, i < 0 ? 0 : i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i < 0 ? 0 : i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(flatItems.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        selectItem(activeIndex)
        break
      case 'Tab':
        close()
        break
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        data-state={open ? 'open' : 'closed'}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-[border-color,box-shadow] outline-none select-none focus-visible:ring-4 focus-visible:ring-brand-subtle [-webkit-tap-highlight-color:transparent]',
          open
            ? 'rounded-b-none border-line border-b-transparent'
            : 'border-line',
          className
        )}
      >
        {triggerContent}
        <ChevronDown className={cn('pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} strokeWidth={1.5} />
      </button>
      {mounted && (
        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-hidden={!open}
          className={cn(
            'absolute left-0 top-full z-50 max-h-72 w-full overflow-x-hidden overflow-y-auto rounded-b-lg border border-t-0 border-line bg-popover text-popover-foreground shadow-popover transition-[opacity,transform] duration-150 ease-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            open && visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
            listClassName
          )}
        >
          {groups.map((g, gi) => (
            <div key={g.label ?? gi} className="scroll-my-1 p-1">
              {g.label && <div className="px-1.5 py-1 text-xs text-muted-foreground">{g.label}</div>}
              {g.items.map(item => {
                const idx = flatItems.indexOf(item)
                const selected = item.value === value
                const active = idx === activeIndex
                return (
                  <div
                    key={item.value}
                    data-index={idx}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectItem(idx)}
                    className={cn(
                      'relative flex cursor-default items-center gap-1.5 rounded-control py-2.5 pr-8 pl-1.5 text-sm select-none mb-1 last:mb-0',
                      active && 'bg-accent text-accent-foreground'
                    )}
                  >
                    {item.icon && (
                      <span className="relative inline-flex shrink-0">
                        {item.icon}
                        <UpdateDot show={!!item.hasUnread} className="h-2 w-2 -right-0.5 -top-0.5" />
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                    {selected && (
                      <Check className="pointer-events-none absolute right-2 size-4" strokeWidth={1.5} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
