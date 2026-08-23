'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from '../icons'
import { useOptionalModalShell } from '../modal-shell'

export type ComboboxItem = {
  /** Stable identity, used as the React key and for selection comparison. */
  key: string
  /** What goes in the input once chosen. */
  label: string
  /**
   * Second line in the dropdown row — region, address. Shown for
   * disambiguation, deliberately NOT matched against: typing "соф" should find
   * София, not every village whose region happens to be София.
   */
  meta?: string
  /** Extra text to match against, e.g. a Latin name or a post code. */
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
  // Fixed-position box for the listbox, in viewport coordinates. See the note on
  // measurePlacement below for why the list cannot simply be absolute.
  const [placement, setPlacement] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
  } | null>(null)

  const shell = useOptionalModalShell()
  const portalTarget = shell?.popupRef.current ?? null

  const filtered = useMemo(
    () => filterItems(items, query, value, maxVisible),
    [items, query, value, maxVisible],
  )
  const overflowed = filtered.overflowed

  // Keep the highlighted row in range as the filter narrows.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.visible.length - 1)))
  }, [filtered.visible.length])

  // A fixed-position list has to be re-measured whenever its anchor moves: the
  // form scrolling under it, the keyboard opening, the window resizing. Capture
  // phase so the form's own scroll event is seen without registering on it
  // directly.
  useLayoutEffect(() => {
    if (!open) return
    const onMove = () => measurePlacement()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    window.visualViewport?.addEventListener('resize', onMove)
    window.visualViewport?.addEventListener('scroll', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      window.visualViewport?.removeEventListener('resize', onMove)
      window.visualViewport?.removeEventListener('scroll', onMove)
    }
    // measurePlacement only reads refs, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Scroll the highlighted row into view without moving focus.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function openList() {
    if (disabled) return
    measurePlacement()
    setOpen(true)
  }

  /**
   * Size and place the listbox in viewport coordinates.
   *
   * The list is rendered into the dialog and positioned `fixed` rather than
   * absolutely inside this wrapper, because the wrapper lives in the modal's
   * scrolling form: `overflow-y: auto` clips in both axes, so an absolutely
   * positioned dropdown was cut off at the bottom edge of the form — on a phone,
   * where the form is only a few hundred pixels tall, that hid most of the city
   * list. ModalShell exposes dialogRef precisely so a popup can escape without
   * going to document.body, which its Tab trap could not see.
   *
   * Space is measured against the visual viewport, not `window.innerHeight`:
   * iOS does not shrink the layout viewport when the software keyboard opens, so
   * innerHeight over-reports the room below by the height of the keyboard and
   * the list would never flip — it opened downwards, behind the keyboard, on
   * every mobile city and street lookup.
   */
  function measurePlacement() {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    const vv = window.visualViewport
    const viewportTop = vv?.offsetTop ?? 0
    const viewportBottom = viewportTop + (vv?.height ?? window.innerHeight)

    const GAP = 4
    const MARGIN = 8
    const below = viewportBottom - rect.bottom - GAP - MARGIN
    const above = rect.top - viewportTop - GAP - MARGIN
    const dropUp = below < 260 && above > below

    setPlacement({
      left: rect.left,
      width: rect.width,
      ...(dropUp
        ? { bottom: viewportBottom - rect.top + GAP }
        : { top: rect.bottom + GAP }),
      maxHeight: Math.max(120, Math.min(256, dropUp ? above : below)),
    })
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
      // Dismiss without selecting. Committing the highlighted row here would
      // both pick a city the customer never confirmed, and swap the fields below
      // mid-tab — the browser then has no next element to move to and focus
      // falls to <body>, breaking the keyboard path through the form.
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
        enterKeyHint="search"
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
          // The iOS keyboard animation is ~250-300ms; a 0ms timeout measured
          // the viewport it had before the keyboard existed.
          window.setTimeout(() => {
            input.current?.scrollIntoView({ block: 'nearest' })
            measurePlacement()
          }, 300)
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

      {open &&
        placement &&
        renderInto(
          portalTarget,
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{
              position: 'fixed',
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              maxHeight: placement.maxHeight,
            }}
            className="z-50 overflow-y-auto overscroll-contain rounded-md border border-border-soft bg-cream py-1 shadow-soft-lg"
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
                  className={`flex min-h-11 cursor-pointer items-start gap-2 px-3 py-2.5 text-left ${
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
          </ul>,
        )}
    </div>
  )
}

/**
 * Render the listbox into the modal's popup layer when there is one, in place
 * otherwise.
 *
 * That layer sits inside the backdrop but outside the sheet, because the sheet's
 * entrance transform would otherwise become the containing block for this
 * fixed-position list — putting it at the wrong coordinates — and then clip it
 * against the sheet's overflow-hidden. Without a modal (a combobox used
 * anywhere else) it falls back to rendering where it stands.
 */
function renderInto(target: HTMLElement | null, node: React.ReactElement) {
  return target ? createPortal(node, target) : node
}

/**
 * Filter and rank.
 *
 * Prefix matches rank above substring matches, which is what makes typing
 * "Вар" put Варна first instead of burying it under every settlement containing
 * those letters. Matching covers the label and the explicit `search` text (a
 * Latin name, a post code) but never `meta` — see the note on that field.
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
  const listAll =
    q.length === 0 || (selected && normalize(selected.label) === q)

  if (listAll) {
    return {
      visible: items.slice(0, maxVisible),
      overflowed: items.length > maxVisible,
    }
  }

  const prefix: ComboboxItem[] = []
  const substring: ComboboxItem[] = []

  for (const item of items) {
    const haystacks = [item.label, item.search ?? ''].map(normalize)
    if (haystacks.some((h) => h.startsWith(q))) prefix.push(item)
    else if (haystacks.some((h) => h.includes(q))) substring.push(item)
  }

  const all = [...prefix, ...substring]
  return {
    visible: all.slice(0, maxVisible),
    overflowed: all.length > maxVisible,
  }
}

function normalize(s: string): string {
  return s.toLocaleLowerCase('bg').trim()
}
