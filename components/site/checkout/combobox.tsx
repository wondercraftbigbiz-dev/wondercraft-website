'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../icons'

export type ComboboxItem = {
  /** Stable identity, used as the React key and for selection comparison. */
  key: string
  /** What goes in the input once chosen. */
  label: string
  /** Second line in the dropdown row — region, post code, address. */
  meta?: string
  /** Extra text to match against, e.g. a Latin transliteration. */
  search?: string
}

/**
 * A single-select combobox: a text input that filters a list.
 *
 * Hand-rolled rather than taken from @base-ui/react, and the reason is the
 * modal. Base UI portals its popups to document.body, which the dialog's Tab
 * trap cannot see, and its Escape handling would race the dialog's own
 * document-level listener — so dismissing a dropdown would close the whole
 * modal and lose the form. Both are fixable with a container prop and
 * stopPropagation, but those fixes are the entire difficulty, and the data here
 * is fetched once and filtered locally, so none of Base UI's async machinery
 * earns its keep.
 *
 * Two decisions keep it compatible with the dialog:
 *  - focus never leaves the input; the active option is tracked with
 *    aria-activedescendant, so the listbox adds zero tabbable elements and the
 *    trap's arithmetic is untouched.
 *  - the listbox is conditionally rendered, not hidden, so it cannot be
 *    collected as a focusable while collapsed.
 */
export function Combobox({
  items,
  value,
  query,
  onQueryChange,
  onSelect,
  placeholder,
  disabled,
  loading,
  emptyMessage = 'Няма резултати.',
  maxVisible = 60,
  describedBy,
  hasError,
  inputRef,
  name,
}: {
  items: ComboboxItem[]
  /** The chosen item's key, or null. */
  value: string | null
  query: string
  onQueryChange: (query: string) => void
  onSelect: (item: ComboboxItem | null) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
  maxVisible?: number
  describedBy?: string
  hasError?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  name?: string
}) {
  const listboxId = `${useId()}-listbox`
  const localRef = useRef<HTMLInputElement>(null)
  const input = inputRef ?? localRef
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropUp, setDropUp] = useState(false)

  const filtered = useMemo(
    () => filterItems(items, query, value, maxVisible),
    [items, query, value, maxVisible],
  )
  const overflowed = filtered.overflowed

  // Keep the highlighted row in range as the filter narrows.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.visible.length - 1)))
  }, [filtered.visible.length])

  // Scroll the highlighted row into view without moving focus.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function openList() {
    if (disabled) return
    // One measurement, on open: flip the list above the input when there is
    // more room up there. No resize observer — the modal does not reflow while
    // a dropdown is open.
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setDropUp(below < 260 && rect.top > below)
    }
    setOpen(true)
  }

  function commit(item: ComboboxItem | null) {
    onSelect(item)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const visible = filtered.visible

    if (e.key === 'Escape') {
      // preventDefault is what tells the dialog this Escape is already spoken
      // for, so dismissing the list does not close the modal too.
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        openList()
        return
      }
      if (visible.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => (i + step + visible.length) % visible.length)
      return
    }

    if (e.key === 'Home' && open) {
      e.preventDefault()
      setActiveIndex(0)
      return
    }
    if (e.key === 'End' && open) {
      e.preventDefault()
      setActiveIndex(Math.max(0, visible.length - 1))
      return
    }

    if (e.key === 'Enter' && open) {
      // This lives inside a <form>: without preventDefault, choosing an option
      // would submit the order.
      e.preventDefault()
      const item = visible[activeIndex]
      if (item) commit(item)
      return
    }

    if (e.key === 'Tab' && open) {
      const item = visible[activeIndex]
      if (item) onSelect(item)
      setOpen(false)
    }
  }

  const selected = items.find((i) => i.key === value) ?? null

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={input}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className="modal-input pr-9"
        placeholder={placeholder}
        value={query}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered.visible[activeIndex]
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          onQueryChange(e.target.value)
          setActiveIndex(0)
          if (!open) openList()
        }}
        // Focus never leaves this input while the list is open, so onFocus
        // cannot reopen it — a second click on an already-focused field has to
        // be handled explicitly or the list becomes unreachable by mouse.
        onClick={() => {
          if (!open) openList()
        }}
        onFocus={() => {
          openList()
          // Let the on-screen keyboard settle before scrolling the field up.
          window.setTimeout(
            () => input.current?.scrollIntoView({ block: 'nearest' }),
            0,
          )
        }}
        onBlur={() => {
          setOpen(false)
          // Never leave text on screen that disagrees with what is selected.
          if (selected && query !== selected.label) onQueryChange(selected.label)
        }}
        onKeyDown={handleKeyDown}
      />

      <ChevronDownIcon
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-soft"
        aria-hidden="true"
      />

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className={`absolute left-0 right-0 z-20 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-border-soft bg-cream py-1 shadow-soft-lg ${
            dropUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
          }`}
        >
          {loading && (
            <li className="px-3 py-6 text-center text-sm text-charcoal-soft">
              Зареждаме…
            </li>
          )}

          {!loading && filtered.visible.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-charcoal-soft">
              {emptyMessage}
            </li>
          )}

          {!loading &&
            filtered.visible.map((item, index) => (
              <li
                key={item.key}
                id={`${listboxId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={item.key === value}
                className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-left ${
                  index === activeIndex ? 'bg-kraft/60' : ''
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                // mousedown, not click: click fires after blur, which would have
                // already closed the list.
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(item)
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-sm text-charcoal">
                    {item.label}
                  </span>
                  {item.meta && (
                    <span className="mt-0.5 block text-xs text-charcoal-soft">
                      {item.meta}
                    </span>
                  )}
                </span>
                {item.key === value && (
                  <CheckIcon
                    className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-salmon-deep"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}

          {overflowed && (
            <li className="border-t border-border-soft px-3 py-2 text-xs text-charcoal-soft">
              Показани са първите {maxVisible} резултата — уточнете търсенето.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * Filter and rank.
 *
 * Prefix matches rank above substring matches, which is what makes typing
 * "Вар" put Варна first instead of burying it under every settlement containing
 * those letters. Matching also covers the Latin name, so "sofia" finds София.
 */
function filterItems(
  items: ComboboxItem[],
  query: string,
  value: string | null,
  maxVisible: number,
): { visible: ComboboxItem[]; overflowed: boolean } {
  const q = normalize(query)

  // An empty box, or a box still showing the chosen label, lists everything —
  // otherwise re-opening a filled field would show exactly one option.
  const selected = items.find((i) => i.key === value)
  const listAll = q.length === 0 || (selected && normalize(selected.label) === q)

  if (listAll) {
    return { visible: items.slice(0, maxVisible), overflowed: items.length > maxVisible }
  }

  const prefix: ComboboxItem[] = []
  const substring: ComboboxItem[] = []

  for (const item of items) {
    const haystacks = [item.label, item.search ?? '', item.meta ?? ''].map(normalize)
    if (haystacks.some((h) => h.startsWith(q))) prefix.push(item)
    else if (haystacks.some((h) => h.includes(q))) substring.push(item)
  }

  const all = [...prefix, ...substring]
  return { visible: all.slice(0, maxVisible), overflowed: all.length > maxVisible }
}

function normalize(s: string): string {
  return s.toLocaleLowerCase('bg').trim()
}
