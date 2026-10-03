// Binding picker: a popup grid opened with P, per-group menu — Neovim-menu
// style — move the cursor with hjkl/arrows, confirm with Enter, or take a
// column straight off with digits. Colour groups choose Light/Dark profiles;
// D chooses a shape then a shared colour slot, A chooses a colour slot.

import { state } from './state.js'
import * as cmd from './commands.js'
import { sideColor, maskColor, drawColorAt } from './colors.js'
import { DRAW_COLOR_COUNT } from './themes.js'
import { DRAW_SHAPES } from './annotations.js'
import { openProfileEditor } from './profile-editor.js'
import { openDrawColorEditor } from './draw-color-editor.js'
import { PROFILE_COUNT, MASK_STYLE_COUNT, MASK_NOISE, MASK_PIXELATE, MASK_GROUP, DRAW_GROUP, ANNOT_GROUP } from './effect.js'

const COLOR_ROWS = [
  { kind: 'shift', sign: 1, side: 'pos', label: 'Light' },
  { kind: 'shift', sign: -1, side: 'neg', label: 'Dark' }
]
const MASK_ROWS = [{ kind: 'mask', label: 'Mask' }]
const MASK_LABELS = ['noise', 'pixelate', 'light', 'dark']
const DRAW_ROWS = [{ kind: 'shape', label: 'Shape' }, { kind: 'drawcolor', label: 'Colour', target: 'draw' }]
const TEXT_ROWS = [{ kind: 'drawcolor', label: 'Colour', target: 'text' }]
const SHAPE_LABELS = { rect: 'rectangle', line: 'line', arrow: 'arrow' }

let rows = COLOR_ROWS
let mode = null          // 'color' | 'mask' | 'draw' | 'text'; null until the first build

function colCount(row) {
  const kind = rows[row].kind
  if (kind === 'mask') return MASK_STYLE_COUNT
  if (kind === 'shape') return DRAW_SHAPES.length
  if (kind === 'drawcolor') return DRAW_COLOR_COUNT
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

function shapeIcon(shape) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  const icon = document.createElementNS(ns, shape === 'rect' ? 'rect' : shape === 'line' ? 'line' : 'path')
  const attrs = shape === 'rect'
    ? { x: '2.5', y: '3.5', width: '11', height: '9', rx: '0.5' }
    : shape === 'line'
      ? { x1: '3', y1: '13', x2: '13', y2: '3' }
      : { d: 'M3 13 L13 3 M7 3 H13 V9' }
  for (const [key, value] of Object.entries(attrs)) icon.setAttribute(key, value)
  svg.appendChild(icon)
  return svg
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
      } else if (r.kind === 'shape') {
        cell.classList.add('picker-shape')
        const shape = DRAW_SHAPES[col]
        cell.appendChild(shapeIcon(shape))
        cell.title = `Shape \u2014 ${SHAPE_LABELS[shape]}`
      } else if (r.kind === 'drawcolor') {
        // The current theme's swatches and titles are set by syncColors().
      } else {
        cell.title = `Profile ${col + 1} ${r.label.toLowerCase()} \u2014 shift+click to edit`
      }

      cell.addEventListener('mousemove', () => {
        if (cursor.row === row && cursor.col === col) return
        cursor = { row, col }
        syncCursor()
      })
      cell.addEventListener('click', (e) => {
        if ((r.kind === 'shift' || r.kind === 'drawcolor') && e.shiftKey) edit(row, col, cell)
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
    ? '1\u20133 shape, then 1\u20135 colour \u00b7 hjkl/arrows move \u00b7 Enter apply \u00b7 E edit colour \u00b7 q close'
    : nextMode === 'text'
    ? '1\u20135 pick \u00b7 hl/arrows move \u00b7 Enter apply \u00b7 E edit colour \u00b7 q close'
    : '1\u20135 pick \u00b7 hjkl/arrows move \u00b7 gG ends \u00b7 Enter apply \u00b7 E edit \u00b7 q close'
  panelEl.appendChild(foot)
}

function syncColors() {
  for (let row = 0; row < rows.length; row++) {
    const r = rows[row]
    if (r.kind === 'shift') {
      for (let col = 0; col < PROFILE_COUNT; col++) {
        cells[row][col].style.background = sideColor(state.profiles[col][r.side], r.sign)
      }
    } else if (r.kind === 'drawcolor') {
      for (let col = 0; col < DRAW_COLOR_COUNT; col++) {
        const hex = drawColorAt(state.drawColors, col)
        cells[row][col].style.background = hex
        cells[row][col].title = `Colour ${col + 1} \u2014 ${hex} \u00b7 shift+click or E to edit`
      }
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
        : r.kind === 'shape' ? state.drawShape === DRAW_SHAPES[col]
        : r.kind === 'drawcolor' ? (r.target === 'text' ? state.textColor : state.drawColor) === col
        : g.profile === col && g.sign === r.sign
      cell.classList.toggle('current', current)
    }
  }
}

function apply(row, col) {
  const r = rows[row]
  if (r.kind === 'shape') {
    cmd.chooseDrawShape(DRAW_SHAPES[col])
    cursor = { row: 1, col: state.drawColor }
    syncCursor()
    return
  }
  if (r.kind === 'mask') cmd.chooseMask(col + 1)
  else if (r.kind === 'drawcolor') {
    if (r.target === 'text') cmd.chooseTextColor(col)
    else cmd.chooseDrawColor(col)
  } else cmd.chooseBinding(col, r.sign)
  closeProfilePicker()
}

function edit(row, col, anchorEl) {
  if (rows[row].kind === 'shift') openProfileEditor(col, anchorEl)
  else if (rows[row].kind === 'drawcolor') openDrawColorEditor(col, anchorEl)
}

/** Re-reads theme swatches; no-op while closed. Called from the render hook. */
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
    ? { row: 0, col: DRAW_SHAPES.indexOf(state.drawShape) }
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
    edit(cursor.row, cursor.col, cells[cursor.row][cursor.col])
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
