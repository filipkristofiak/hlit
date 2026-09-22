// Resize popup: a magnetic slider over the document scale. Applying re-decodes
// from the retained clipboard PNG, so every scale is reached at full fidelity.

import { state } from './state.js'

const ANCHOR_PCT = [100, 75, 200 / 3, 50, 100 / 3, 25]
const SNAP_PP = 2          // snap when within 2 percentage points of an anchor
const MIN_PCT = 25
const MAX_PCT = 100

let overlayEl = null
let sliderEl = null
let readoutEl = null
let isOpen = false
let pct = 100
let applier = () => {}

/** Set once from the bootstrap in main.js; receives the chosen scale fraction. */
export function setResizeApplier(fn) {
  applier = fn
}

function build() {
  overlayEl = document.createElement('div')
  overlayEl.className = 'resize-overlay'
  overlayEl.style.display = 'none'
  overlayEl.addEventListener('mousedown', closeResize)

  const panel = document.createElement('div')
  panel.className = 'picker'
  panel.addEventListener('mousedown', (e) => e.stopPropagation())

  const title = document.createElement('div')
  title.className = 'picker-title'
  title.textContent = 'Resize'
  panel.appendChild(title)

  const row = document.createElement('div')
  row.className = 'rz-row'

  sliderEl = document.createElement('input')
  sliderEl.type = 'range'
  sliderEl.className = 'rz-slider'
  sliderEl.min = String(MIN_PCT)
  sliderEl.max = String(MAX_PCT)
  sliderEl.step = '1'
  sliderEl.setAttribute('list', 'rz-ticks')
  sliderEl.addEventListener('input', () => setPct(Number(sliderEl.value)))
  row.appendChild(sliderEl)

  const ticks = document.createElement('datalist')
  ticks.id = 'rz-ticks'
  for (const v of [25, 33, 50, 67, 75, 100]) {
    const opt = document.createElement('option')
    opt.value = String(v)
    ticks.appendChild(opt)
  }
  row.appendChild(ticks)

  readoutEl = document.createElement('span')
  readoutEl.className = 'rz-readout'
  row.appendChild(readoutEl)

  panel.appendChild(row)

  const foot = document.createElement('div')
  foot.className = 'picker-foot'
  foot.textContent = '1\u20136 anchors \u00b7 \u2190/\u2192 adjust \u00b7 Enter apply \u00b7 q close'
  panel.appendChild(foot)

  overlayEl.appendChild(panel)
  document.body.appendChild(overlayEl)
}

function fmtPct(f) {
  return `${Math.round(f * 1000) / 10}%`
}

/** Returns the fraction (0-1) `p` snaps to when close to an anchor, else `p / 100`. */
function snapFraction(p) {
  for (const a of ANCHOR_PCT) {
    if (Math.abs(p - a) <= SNAP_PP) return a / 100
  }
  return p / 100
}

function setPct(p) {
  pct = Math.min(MAX_PCT, Math.max(MIN_PCT, p))
  sliderEl.value = String(pct)
  const src = state.source
  const frac = snapFraction(pct)
  const outW = Math.max(1, Math.round(src.w * frac))
  const outH = Math.max(1, Math.round(src.h * frac))
  readoutEl.textContent = `${src.w}\u00d7${src.h} \u2192 ${outW}\u00d7${outH} \u00b7 ${fmtPct(frac)}`
}

/** Returns false when there is no source image to resize. */
export function openResize() {
  if (!state.source) return false
  if (!overlayEl) build()
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  pct = Math.round(state.scale * 100)
  overlayEl.style.display = 'flex'
  isOpen = true
  setPct(pct)
  return true
}

export function closeResize() {
  if (overlayEl) overlayEl.style.display = 'none'
  isOpen = false
}

export function isResizeOpen() {
  return isOpen
}

function apply() {
  const frac = snapFraction(pct)
  closeResize()
  applier(frac)
}

/** Every keystroke while the popup is open lands here; unknown keys are swallowed. */
export function handleResizeKey(key) {
  if (key === 'Escape' || key === 'q' || key === 'Q') {
    closeResize()
    return
  }
  if (key >= '1' && key <= '6') {
    setPct(ANCHOR_PCT[Number(key) - 1])
    return
  }
  if (key === 'ArrowLeft' || key === 'h') {
    setPct(pct - 1)
    return
  }
  if (key === 'ArrowRight' || key === 'l') {
    setPct(pct + 1)
    return
  }
  if (key === 'Enter' || key === ' ') {
    apply()
  }
}
