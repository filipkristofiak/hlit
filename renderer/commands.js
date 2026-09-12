// Unified control plane. Every user gesture routes through one command here;
// commands own the mutate -> repaint -> refresh sequence so no call site repeats it.

import * as doc from './state.js'
import { paint, drawOverlay } from './view.js'
import { GROUP_COUNT } from './effect.js'

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
 * Digit keys 1-5 and the status-bar group buttons. With a selection, the
 * selected rects move to that group; without one, the group just becomes
 * active. Either way `state.active` ends up on `groupIndex`.
 */
export function chooseGroup(groupIndex) {
  if (doc.state.selected.size > 0) {
    render(doc.assignSelectedGroup(groupIndex), false)
    return
  }
  doc.setActive(groupIndex)
  render(null, false)
}

/** Tab / shift-Tab: moves the active group without touching the selection. */
export function cycleActiveGroup(delta) {
  doc.setActive((doc.state.active + GROUP_COUNT + delta) % GROUP_COUNT)
  render(null, false)
}

export function flipDirection() {
  render(doc.toggleActiveSign(), false)
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
