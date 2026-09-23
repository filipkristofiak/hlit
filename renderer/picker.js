// Binding picker: a popup grid opened with P, per-group menu — Neovim-menu
// style — move the cursor with hjkl/arrows, confirm with Enter, or take a
// column straight off with digits. The picker is the active group's menu:
// colour groups (1-5) get the Light/Dark rows, the M group gets the Mask row.

import { state } from './state.js'
import * as cmd from './commands.js'
import { sideColor, maskColor, annotColor, ANNOT_COLOR_COUNT, ANNOT_COLOR_LABELS } from './colors.js'
import { openProfileEditor } from './profile-editor.js'
import { PROFILE_COUNT, MASK_STYLE_COUNT, MASK_NOISE, MASK_PIXELATE, MASK_GROUP, DRAW_GROUP, ANNOT_GROUP } from './effect.js'

const COLOR_ROWS = [
  { kind: 'shift', sign: 1, side: 'pos', label: 'Light' },
  { kind: 'shift', sign: -1, side: 'neg', label: 'Dark' }
]
const MASK_ROWS = [{ kind: 'mask', label: 'Mask' }]
const MASK_LABELS = ['noise', 'pixelate', 'light', 'dark']
const DRAW_ROWS = [{ kind: 'draw', label: 'Rectangle', shape: 'rect' }, { kind: 'draw', label: 'Arrow', shape: 'arrow' }]
const TEXT_ROWS = [{ kind: 'text', label: 'Text' }]

let rows = COLOR_ROWS
let mode = null          // 'color' | 'mask' | 'draw' | 'text'; null until the first build

function colCount(row) {
  const kind = rows[row].kind
  if (kind === 'mask') return MASK_STYLE_COUNT
  if (kind === 'draw' || kind === 'text') return ANNOT_COLOR_COUNT
  return PROFILE_COUNT
}

const LEFT_KEYS = new Set(['h', 'H', 'ArrowLeft'])
const RIGHT_KEYS = new Set(['l', 'L', 'ArrowRight'])
const UP_KEYS = new Set(['k', 'K', 'ArrowUp'])
const DOWN_KEYS = new Set(['j', 'J', 'ArrowDown'])

let overlayEl = null
let panelEl = null
let cells = []            // cells[row][col]
let cursor = { row: 0, col: 0 }
let isOpen = false

function ensureOverlay() {
  if (overlayEl) return
  overlayEl = document.createElement('div')
  overlayEl.className = 'picker-overlay'
  overlayEl.style.display = 'none'
  overlayEl.addEventListener('mousedown', closeProfilePicker)

  panelEl = document.createElement('div')
  panelEl.className = 'picker'
  panelEl.addEventListener('mousedown', (e) => e.stopPropagation())

  overlayEl.appendChild(panelEl)
  document.body.appendChild(overlayEl)
}

function buildGrid(nextMode) {
  mode = nextMode
  rows = nextMode === 'mask' ? MASK_ROWS : nextMode === 'draw' ? DRAW_ROWS : nextMode === 'text' ? TEXT_ROWS : COLOR_ROWS
  panelEl.innerHTML = ''

  const title = document.createElement('div')
  title.className = 'picker-title'
  title.textContent = nextMode === 'mask' ? 'Mask' : nextMode === 'draw' ? 'Draw' : nextMode === 'text' ? 'Text' : 'Binding'
  panelEl.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'picker-grid'

  cells = []
  for (let row = 0; row < rows.length; row++) {
    const r = rows[row]
    const n = colCount(row)

    const rowLabel = document.createElement('span')
    rowLabel.className = 'picker-rowlabel'
    rowLabel.textContent = r.label
    grid.appendChild(rowLabel)

    cells[row] = []
    for (let col = 0; col < PROFILE_COUNT; col++) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'picker-cell'

      if (col >= n) {
        cell.classList.add('empty')
        cell.disabled = true
        grid.appendChild(cell)
        cells[row].push(cell)
        continue
      }

      if (r.kind === 'mask') {
        cell.style.backgroundColor = maskColor(col + 1)
        if (col + 1 === MASK_NOISE) cell.classList.add('mask-noise')
        else if (col + 1 === MASK_PIXELATE) cell.classList.add('mask-pixelate')
        cell.title = `Mask \u2014 ${MASK_LABELS[col]}`
      } else if (r.kind === 'draw' || r.kind === 'text') {
        cell.style.backgroundColor = annotColor(col)
        cell.title = `${r.label} \u2014 ${ANNOT_COLOR_LABELS[col]}`
      } else {
        cell.title = `Profile ${col + 1} ${r.label.toLowerCase()} \u2014 shift+click to edit`
      }

      cell.addEventListener('mousemove', () => {
        if (cursor.row === row && cursor.col === col) return
        cursor = { row, col }
        syncCursor()
      })
      cell.addEventListener('click', (e) => {
        if (r.kind === 'shift' && e.shiftKey) edit(col, cell)
        else apply(row, col)
      })
      grid.appendChild(cell)
      cells[row].push(cell)
    }
  }

  const spacer = document.createElement('span')
  spacer.className = 'picker-rowlabel'
  grid.appendChild(spacer)
  const maxCols = Math.max(...rows.map((_r, i) => colCount(i)))
  for (let col = 0; col < maxCols; col++) {
    const digit = document.createElement('span')
    digit.className = 'picker-digit'
    digit.textContent = String(col + 1)
    grid.appendChild(digit)
  }
  for (let col = maxCols; col < PROFILE_COUNT; col++) {
    grid.appendChild(document.createElement('span')).className = 'picker-digit'
  }

  panelEl.appendChild(grid)

  const foot = document.createElement('div')
  foot.className = 'picker-foot'
  foot.textContent = nextMode === 'mask'
    ? '1\u20134 pick \u00b7 hl/arrows move \u00b7 gG ends \u00b7 Enter apply \u00b7 q close \u00b7 1 noise 2 pixelate 3 light 4 dark'
    : nextMode === 'draw'
    ? '1\u20135 pick a colour \u00b7 jk/arrows move \u00b7 Enter apply \u00b7 q close \u00b7 row picks the shape'
    : nextMode === 'text'
    ? '1\u20135 pick a colour \u00b7 Enter apply \u00b7 q close'
    : '1\u20135 pick \u00b7 hjkl/arrows move \u00b7 gG ends \u00b7 Enter apply \u00b7 E edit \u00b7 q close'
  panelEl.appendChild(foot)
}

function syncColors() {
  if (mode !== 'color') return
  for (let row = 0; row < rows.length; row++) {
    if (rows[row].kind !== 'shift') continue
    for (let col = 0; col < PROFILE_COUNT; col++) {
      cells[row][col].style.background = sideColor(state.profiles[col][rows[row].side], rows[row].sign)
    }
  }
}

function syncCursor() {
  const g = mode === 'color' ? state.groups[state.active] : null
  for (let row = 0; row < rows.length; row++) {
    const r = rows[row]
    const n = colCount(row)
    for (let col = 0; col < n; col++) {
      const cell = cells[row][col]
      cell.classList.toggle('cursor', cursor.row === row && cursor.col === col)
      const current = r.kind === 'mask' ? state.maskStyle === col + 1
        : r.kind === 'draw' ? state.drawShape === r.shape && state.drawColor === col
        : r.kind === 'text' ? state.textColor === col
        : g.profile === col && g.sign === r.sign
      cell.classList.toggle('current', current)
    }
  }
}

function apply(row, col) {
  const kind = rows[row].kind
  if (kind === 'mask') cmd.chooseMask(col + 1)
  else if (kind === 'draw') cmd.chooseDrawStyle(rows[row].shape, col)
  else if (kind === 'text') cmd.chooseTextColor(col)
  else cmd.chooseBinding(col, rows[row].sign)
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
  ensureOverlay()
  // A status-bar button left focused by an earlier click would take Enter/Space
  // as its own activation while the picker is open.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  const nextMode = state.active === MASK_GROUP ? 'mask'
    : state.active === DRAW_GROUP ? 'draw'
    : state.active === ANNOT_GROUP ? 'text'
    : 'color'
  if (nextMode !== mode) buildGrid(nextMode)
  cursor = nextMode === 'mask'
    ? { row: 0, col: state.maskStyle - 1 }
    : nextMode === 'draw'
    ? { row: state.drawShape === 'arrow' ? 1 : 0, col: state.drawColor }
    : nextMode === 'text'
    ? { row: 0, col: state.textColor }
    : { row: state.groups[state.active].sign === 1 ? 0 : 1, col: state.groups[state.active].profile }
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
  const n = colCount(cursor.row)
  if (key >= '1' && key <= String(n)) {
    apply(cursor.row, Number(key) - 1)
    return
  }
  if (key === 'Enter' || key === ' ') {
    apply(cursor.row, cursor.col)
    return
  }
  if (key === 'e' || key === 'E') {
    if (rows[cursor.row].kind === 'shift') edit(cursor.col, cells[cursor.row][cursor.col])
    return
  }
  if (key === 'g') {
    cursor.col = 0
    syncCursor()
    return
  }
  if (key === 'G') {
    cursor.col = n - 1
    syncCursor()
    return
  }
  if (LEFT_KEYS.has(key)) {
    cursor.col = (cursor.col + n - 1) % n
    syncCursor()
    return
  }
  if (RIGHT_KEYS.has(key)) {
    cursor.col = (cursor.col + 1) % n
    syncCursor()
    return
  }
  if (UP_KEYS.has(key)) {
    cursor.row = (cursor.row + rows.length - 1) % rows.length
    cursor.col = Math.min(cursor.col, colCount(cursor.row) - 1)
    syncCursor()
    return
  }
  if (DOWN_KEYS.has(key)) {
    cursor.row = (cursor.row + 1) % rows.length
    cursor.col = Math.min(cursor.col, colCount(cursor.row) - 1)
    syncCursor()
  }
}
