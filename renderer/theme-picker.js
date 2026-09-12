// Theme picker: a one-column popup list of every theme found on disk, opened
// with T. Same menu contract as the profile picker — j/k/arrows move, Enter or
// Space loads, 1-9 load directly, Esc cancels. Loading a theme swaps the whole
// palette; it is not an undo step, matching profile edits.

import { state } from './state.js'
import * as cmd from './commands.js'
import { sideColor } from './colors.js'
import { PROFILE_COUNT } from './effect.js'

let overlayEl = null
let listEl = null
let rows = []
let cursor = 0
let isOpen = false

function build() {
  overlayEl = document.createElement('div')
  overlayEl.className = 'theme-overlay'
  overlayEl.style.display = 'none'
  overlayEl.addEventListener('mousedown', closeThemePicker)

  const panel = document.createElement('div')
  panel.className = 'picker'
  panel.addEventListener('mousedown', (e) => e.stopPropagation())

  const title = document.createElement('div')
  title.className = 'picker-title'
  title.textContent = 'Theme'
  panel.appendChild(title)

  listEl = document.createElement('div')
  listEl.className = 'theme-list'
  panel.appendChild(listEl)

  const foot = document.createElement('div')
  foot.className = 'picker-foot'
  foot.textContent = '1\u20139 load \u00b7 jk/arrows move \u00b7 gG ends \u00b7 Enter load \u00b7 q close'
  panel.appendChild(foot)

  overlayEl.appendChild(panel)
  document.body.appendChild(overlayEl)
}

/** Rebuilt on every open: the list can change when a fork appears. */
function syncRows() {
  listEl.textContent = ''
  rows = []
  for (let i = 0; i < state.themes.length; i++) {
    const theme = state.themes[i]
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'theme-row'

    const name = document.createElement('span')
    name.className = 'theme-name'
    name.textContent = theme.name
    row.appendChild(name)

    const lock = document.createElement('span')
    lock.className = 'theme-lock'
    lock.textContent = theme.locked ? 'locked' : ''
    row.appendChild(lock)

    const dots = document.createElement('span')
    dots.className = 'theme-dots'
    for (let j = 0; j < PROFILE_COUNT; j++) {
      const dot = document.createElement('span')
      dot.className = 'theme-dot'
      dot.style.background = sideColor(theme.profiles[j].pos, 1)
      dots.appendChild(dot)
    }
    row.appendChild(dots)

    row.addEventListener('mousemove', () => {
      if (cursor === i) return
      cursor = i
      syncCursor()
    })
    row.addEventListener('click', () => apply(i))

    listEl.appendChild(row)
    rows.push(row)
  }
}

function syncCursor() {
  for (let i = 0; i < rows.length; i++) {
    rows[i].classList.toggle('cursor', i === cursor)
    rows[i].classList.toggle('current', state.themes[i].id === state.theme.id)
  }
}

function apply(index) {
  const t = state.themes[index]
  if (!t) return
  cmd.chooseTheme(t.id)
  closeThemePicker()
}

/** Re-reads the theme list; no-op while closed. Called from the render hook so
 * a fork or an edit repaints the list. */
export function refreshThemePicker() {
  if (!isOpen) return
  syncRows()
  syncCursor()
}

export function openThemePicker() {
  if (!overlayEl) build()
  if (state.themes.length === 0) return   // nothing to choose; bootstrap already toasted the missing-themes case
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  const activeIndex = state.themes.findIndex((t) => t.id === state.theme.id)
  cursor = activeIndex === -1 ? 0 : activeIndex
  syncRows()
  syncCursor()
  overlayEl.style.display = 'flex'
  isOpen = true
}

export function closeThemePicker() {
  if (overlayEl) overlayEl.style.display = 'none'
  isOpen = false
}

export function isThemePickerOpen() {
  return isOpen
}

/** Every keystroke while the picker is open lands here; unknown keys are swallowed. */
export function handleThemePickerKey(key) {
  if (key === 'Escape' || key === 'q' || key === 'Q' || key === 't' || key === 'T') {
    closeThemePicker()
    return
  }
  if (key >= '1' && key <= '9') {
    const index = Number(key) - 1
    if (index < state.themes.length) apply(index)
    return
  }
  if (key === 'Enter' || key === ' ') {
    apply(cursor)
    return
  }
  if (key === 'g') {
    cursor = 0
    syncCursor()
    return
  }
  if (key === 'G') {
    cursor = state.themes.length - 1
    syncCursor()
    return
  }
  if (key === 'j' || key === 'J' || key === 'ArrowDown') {
    cursor = (cursor + 1) % state.themes.length
    syncCursor()
    return
  }
  if (key === 'k' || key === 'K' || key === 'ArrowUp') {
    cursor = (cursor + state.themes.length - 1) % state.themes.length
    syncCursor()
  }
}
