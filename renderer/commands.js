// Unified control plane. Every user gesture routes through one command here;
// commands own the mutate -> repaint -> refresh sequence so no call site repeats it.

import * as doc from './state.js'
import { paint, drawOverlay, fit, rasterizeSource } from './view.js'
import { GROUP_TOTAL, isVectorGroup } from './effect.js'

let refreshStatusbar = () => {}
let hoverProbe = () => null

/** Called once from the bootstrap in main.js. */
export function setRenderHooks({ refresh, hoverProbe: probe }) {
  refreshStatusbar = refresh
  hoverProbe = probe
}

function render(dirty, redrawOverlay) {
  paint(dirty)
  if (redrawOverlay) drawOverlay(hoverProbe())
  refreshStatusbar()
}

/**
 * Digit keys 1-5, `m`/`M` (the M group) and the status-bar buttons. With a
 * selection, the selected rects move to that group; without one, the group
 * just becomes active. Either way `state.active` ends up on `groupIndex`.
 */
export function chooseGroup(groupIndex) {
  if (isVectorGroup(groupIndex)) {
    doc.setActive(groupIndex)
    render(null, false)
    return
  }
  if (doc.state.selected.size > 0) {
    render(doc.assignSelectedGroup(groupIndex), false)
    return
  }
  doc.setActive(groupIndex)
  render(null, false)
}

/** Tab / shift-Tab: moves the active group without touching the selection. */
export function cycleActiveGroup(delta) {
  doc.setActive((doc.state.active + GROUP_TOTAL + delta) % GROUP_TOTAL)
  render(null, false)
}

export function flipDirection() {
  render(doc.toggleActiveSign(), false)
}

/** Mask menu cell: the M group adopts that style. */
export function chooseMask(style) {
  render(doc.setMaskStyle(style), false)
}

/** Draw picker cell: shape + colour for the next drawn shape. */
export function chooseDrawStyle(shape, colorIndex) {
  doc.setDrawStyle(shape, colorIndex)
  render(null, false)
}

/** Text picker cell: colour for the next text box. */
export function chooseTextColor(colorIndex) {
  doc.setTextColor(colorIndex)
  render(null, false)
}

/** Picker cell: the active group adopts that profile in that direction. */
export function chooseBinding(profileIndex, sign) {
  render(doc.setGroupBinding(doc.state.active, profileIndex, sign), false)
}

/** Canvas click. `additive` = ctrl/cmd held. */
export function selectRect(rect, additive) {
  if (additive) {
    if (!rect) return
    doc.toggleSelect(rect)
  } else {
    doc.selectOnly(rect)
  }
  drawOverlay(rect)
  refreshStatusbar()
}

/** Returns false when there was nothing to dismiss, so callers can fall through. */
export function dismissSelection() {
  if (doc.state.selected.size === 0) return false
  doc.clearSelection()
  drawOverlay(hoverProbe())
  refreshStatusbar()
  return true
}

export function commitRect(rect) {
  render(doc.addRect(rect), false)
}

/** Commits a freshly drawn A rect once its editor produced a non-empty string. */
export function commitTextRect(rect, text) {
  rect.text = text
  render(doc.addRect(rect), false)
}

/** Commits an edit to an existing A rect. */
export function editRectText(rect, text) {
  render(doc.setRectText(rect, text), false)
}

/** Deletes one rect by reference (an emptied text box). */
export function deleteRect(rect) {
  render(doc.deleteRectRef(rect), true)
}

/** Returns false when no rect sat under the cursor, so the caller can toast. */
export function deleteAtPointer(x, y) {
  const dirty = doc.deleteAt(x, y)
  if (!dirty) return false
  render(dirty, true)
  return true
}

export function undo() {
  render(doc.undo(), true)
}

export function redo() {
  render(doc.redo(), true)
}

export function setProfileChannel(profileIndex, side, channel, value) {
  render(doc.setProfileChannel(profileIndex, side, channel, value), false)
}

export function setProfileLinked(profileIndex, linked) {
  render(doc.setProfileLinked(profileIndex, linked), false)
}

export function resetProfile(profileIndex) {
  render(doc.resetProfile(profileIndex), false)
}

/** Theme picker row: the document adopts that theme's palette. */
export function chooseTheme(id) {
  render(doc.applyTheme(id), false)
}

/** Re-decodes the retained clipboard PNG at `scale` and rebuilds every
 * resolution-dependent buffer. Returns `'noop'` when there is no source or
 * the scale is already active, `false` when the decode fails, `true` on
 * success — the two failure-shaped returns are kept apart so a caller can
 * skip toasting when the user just re-applied the current scale. */
export async function setImageScale(scale) {
  const src = doc.state.source
  if (!src) return 'noop'
  const w = Math.max(1, Math.round(src.w * scale))
  const h = Math.max(1, Math.round(src.h * scale))
  if (w === doc.state.imageW && h === doc.state.imageH) return 'noop'
  let bitmap
  try {
    bitmap = await createImageBitmap(new Blob([src.png], { type: 'image/png' }))
  } catch {
    return false                 // nothing mutated yet: the document is untouched
  }
  const imageData = rasterizeSource(bitmap, w, h)
  bitmap.close()
  doc.resizeTo(imageData, scale)
  fit()
  render({ x: 0, y: 0, w, h }, true)
  return true
}
