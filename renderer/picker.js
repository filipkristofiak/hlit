// Profile picker: a 2x5 popup grid (row 0 = light, row 1 = dark) opened
// with P. Neovim-menu style — move the cursor with hjkl/arrows, confirm with
// Enter, or take a column straight off with 1-5. Picking sets the active
// group's profile and direction in one command.

import { state } from './state.js'
import * as cmd from './commands.js'
import { sideColor } from './colors.js'
import { openProfileEditor } from './profile-editor.js'
import { PROFILE_COUNT } from './effect.js'

const ROWS = [
  { sign: 1, side: 'pos', label: 'Light' },
  { sign: -1, side: 'neg', label: 'Dark' }
]

const LEFT_KEYS = new Set(['h', 'H', 'ArrowLeft'])
const RIGHT_KEYS = new Set(['l', 'L', 'ArrowRight'])
const ROW_KEYS = new Set(['j', 'J', 'k', 'K', 'ArrowUp', 'ArrowDown'])

let overlayEl = null
let cells = []            // cells[row][col]
let cursor = { row: 0, col: 0 }
let isOpen = false

function build() {
  overlayEl = document.createElement('div')
  overlayEl.className = 'picker-overlay'
  overlayEl.style.display = 'none'
  overlayEl.addEventListener('mousedown', closeProfilePicker)

  const panel = document.createElement('div')
  panel.className = 'picker'
  panel.addEventListener('mousedown', (e) => e.stopPropagation())

  const title = document.createElement('div')
  title.className = 'picker-title'
  title.textContent = 'Profile'
  panel.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'picker-grid'

  cells = []
  for (let row = 0; row < ROWS.length; row++) {
    const rowLabel = document.createElement('span')
    rowLabel.className = 'picker-rowlabel'
    rowLabel.textContent = ROWS[row].label
    grid.appendChild(rowLabel)

    cells[row] = []
    for (let col = 0; col < PROFILE_COUNT; col++) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'picker-cell'
      cell.title = `Profile ${col + 1} ${ROWS[row].label.toLowerCase()} \u2014 shift+click to edit`
      cell.addEventListener('mousemove', () => {
        if (cursor.row === row && cursor.col === col) return
        cursor = { row, col }
        syncCursor()
      })
      cell.addEventListener('click', (e) => {
        if (e.shiftKey) edit(col, cell)
        else apply(row, col)
      })
      grid.appendChild(cell)
      cells[row].push(cell)
    }
  }

  const spacer = document.createElement('span')
  spacer.className = 'picker-rowlabel'
  grid.appendChild(spacer)
  for (let col = 0; col < PROFILE_COUNT; col++) {
    const digit = document.createElement('span')
    digit.className = 'picker-digit'
    digit.textContent = String(col + 1)
    grid.appendChild(digit)
  }

  panel.appendChild(grid)

  const foot = document.createElement('div')
  foot.className = 'picker-foot'
  foot.textContent = '1\u20135 pick \u00b7 hjkl/arrows move \u00b7 gG ends \u00b7 Enter apply \u00b7 E edit \u00b7 q close'
  panel.appendChild(foot)

  overlayEl.appendChild(panel)
  document.body.appendChild(overlayEl)
}

function syncColors() {
  for (let row = 0; row < ROWS.length; row++) {
    for (let col = 0; col < PROFILE_COUNT; col++) {
      cells[row][col].style.background = sideColor(state.profiles[col][ROWS[row].side], ROWS[row].sign)
    }
  }
}

function syncCursor() {
  const g = state.groups[state.active]
  for (let row = 0; row < ROWS.length; row++) {
    for (let col = 0; col < PROFILE_COUNT; col++) {
      const cell = cells[row][col]
      cell.classList.toggle('cursor', cursor.row === row && cursor.col === col)
      cell.classList.toggle('current', g.profile === col && g.sign === ROWS[row].sign)
    }
  }
}

function apply(row, col) {
  cmd.chooseBinding(col, ROWS[row].sign)
  closeProfilePicker()
}

function edit(col, anchorEl) {
  openProfileEditor(col, anchorEl)
}

/** Re-reads profile colours; no-op while closed. Called from the render hook. */
export function refreshProfilePicker() {
  if (!isOpen) return
  syncColors()
  syncCursor()
}

export function openProfilePicker() {
  if (!overlayEl) build()
  // A status-bar button left focused by an earlier click would take Enter/Space
  // as its own activation while the picker is open.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  const g = state.groups[state.active]
  cursor = { row: g.sign === 1 ? 0 : 1, col: g.profile }
  syncColors()
  syncCursor()
  overlayEl.style.display = 'flex'
  isOpen = true
}

export function closeProfilePicker() {
  if (overlayEl) overlayEl.style.display = 'none'
  isOpen = false
}

export function isProfilePickerOpen() {
  return isOpen
}

/** Every keystroke while the picker is open lands here; unknown keys are swallowed. */
export function handleProfilePickerKey(key) {
  if (key === 'Escape' || key === 'q' || key === 'Q' || key === 'p' || key === 'P') {
    closeProfilePicker()
    return
  }
  if (key >= '1' && key <= String(PROFILE_COUNT)) {
    apply(cursor.row, Number(key) - 1)
    return
  }
  if (key === 'Enter' || key === ' ') {
    apply(cursor.row, cursor.col)
    return
  }
  if (key === 'e' || key === 'E') {
    edit(cursor.col, cells[cursor.row][cursor.col])
    return
  }
  if (key === 'g') {
    cursor.col = 0
    syncCursor()
    return
  }
  if (key === 'G') {
    cursor.col = PROFILE_COUNT - 1
    syncCursor()
    return
  }
  if (LEFT_KEYS.has(key)) {
    cursor.col = (cursor.col + PROFILE_COUNT - 1) % PROFILE_COUNT
    syncCursor()
    return
  }
  if (RIGHT_KEYS.has(key)) {
    cursor.col = (cursor.col + 1) % PROFILE_COUNT
    syncCursor()
    return
  }
  if (ROW_KEYS.has(key)) {
    cursor.row = cursor.row === 0 ? 1 : 0
    syncCursor()
  }
}
