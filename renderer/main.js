// Bootstrap + input wiring: pointer drag-to-highlight, keyboard shortcuts,
// and menu commands delivered over the preload bridge.

import { state, loadImage, applySettings, setThemeList, setThemeNotifier, setSource } from './state.js'
import { MASK_GROUP } from './effect.js'
import * as cmd from './commands.js'
import { fit, paint, toImage, drawOverlay, exportPng, rasterizeSource } from './view.js'
import { init as initStatusbar, refresh as statusbarRefresh } from './statusbar.js'
import { isProfileEditorOpen, closeProfileEditor } from './profile-editor.js'
import { openProfilePicker, isProfilePickerOpen, handleProfilePickerKey, refreshProfilePicker } from './picker.js'
import { openThemePicker, isThemePickerOpen, handleThemePickerKey, refreshThemePicker } from './theme-picker.js'
import { openHelp, closeHelp, isHelpOpen, scrollHelp } from './help.js'
import { openResize, isResizeOpen, handleResizeKey, setResizeApplier } from './resize.js'
import { keyLabels } from './keylabels.js'

const wrapEl = document.getElementById('wrap')
const hintEl = document.getElementById('hint')
const toastEl = document.getElementById('toast')

let toastTimer = null
function toast(msg) {
  toastEl.textContent = msg
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600)
}

function hasImage() {
  return state.imageW > 0 && state.imageH > 0
}

function rectBBoxOf(r) {
  return { x: r.x, y: r.y, w: r.w, h: r.h }
}

function unionRect(a, b) {
  if (!a) return b
  if (!b) return a
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x + a.w, b.x + b.w)
  const y1 = Math.max(a.y + a.h, b.y + b.h)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function findTopmostRectAt(x, y) {
  for (let i = state.rects.length - 1; i >= 0; i--) {
    const r = state.rects[i]
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r
  }
  return null
}

function buildPreviewRect(anchor, cur, group) {
  const x = Math.min(anchor.x, cur.x)
  const y = Math.min(anchor.y, cur.y)
  const w = Math.abs(cur.x - anchor.x) + 1
  const h = Math.abs(cur.y - anchor.y) + 1
  return { x, y, w, h, group }
}

// --- Pointer: drag-to-highlight ---------------------------------------

let dragging = false
let dragAnchor = null
let dragRect = null
let capturedPointerId = null
let lastPointer = { x: 0, y: 0 }

function cancelDrag() {
  dragging = false
  if (capturedPointerId !== null) {
    wrapEl.releasePointerCapture(capturedPointerId)
    capturedPointerId = null
  }
  if (dragRect) {
    const idx = state.rects.indexOf(dragRect)
    if (idx !== -1) state.rects.splice(idx, 1)
    paint(rectBBoxOf(dragRect))
  }
  dragRect = null
  dragAnchor = null
}

wrapEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !hasImage()) return
  drawOverlay(null)
  dragAnchor = toImage(e.clientX, e.clientY)
  dragging = true
  dragRect = null
  capturedPointerId = e.pointerId
  wrapEl.setPointerCapture(e.pointerId)
})

wrapEl.addEventListener('pointermove', (e) => {
  const p = toImage(e.clientX, e.clientY)
  lastPointer = p
  if (!hasImage()) return

  if (dragging) {
    const prevBBox = dragRect ? rectBBoxOf(dragRect) : null
    if (!dragRect) {
      dragRect = buildPreviewRect(dragAnchor, p, state.active)
      state.rects.push(dragRect)
    } else {
      const next = buildPreviewRect(dragAnchor, p, state.active)
      dragRect.x = next.x
      dragRect.y = next.y
      dragRect.w = next.w
      dragRect.h = next.h
    }
    paint(unionRect(prevBBox, rectBBoxOf(dragRect)))
    return
  }

  const hit = findTopmostRectAt(p.x, p.y)
  drawOverlay(hit)
  wrapEl.style.cursor = hit ? 'pointer' : 'crosshair'
})

wrapEl.addEventListener('pointerup', (e) => {
  if (!dragging) return
  dragging = false
  if (capturedPointerId !== null) {
    wrapEl.releasePointerCapture(capturedPointerId)
    capturedPointerId = null
  }
  let realDrag = false
  if (dragRect) {
    const idx = state.rects.indexOf(dragRect)
    if (idx !== -1) state.rects.splice(idx, 1)
    const bbox = rectBBoxOf(dragRect)
    if (dragRect.w < 3 || dragRect.h < 3) {
      paint(bbox)
    } else {
      cmd.commitRect(dragRect)
      realDrag = true
    }
  }
  if (!realDrag) cmd.selectRect(findTopmostRectAt(lastPointer.x, lastPointer.y), e.ctrlKey || e.metaKey)
  dragRect = null
  dragAnchor = null
})

wrapEl.addEventListener('pointercancel', () => {
  if (dragging) cancelDrag()
})

// --- Keyboard: non-modifier shortcuts, plus renderer-owned Ctrl chords ---
//
// Ctrl+V/C/S/Z (and Ctrl+Shift+Z, Ctrl+R) are handled here on every
// platform. Off macOS the Image menu only *displays* them
// (registerAccelerator: false in main/menu.js): Chromium reserves a set of
// Windows/Linux browser chords that a registered accelerator silently never
// receives, which is why those menu items fired on click but not on the
// keystroke. A DOM keydown always arrives, so the renderer is the one path.
// On macOS the menu keeps the real Cmd accelerators and this block only ever
// sees Ctrl, which macOS does not use for these commands.

const CTRL_COMMANDS = { v: 'paste', c: 'copy', s: 'save', r: 'redo' }

/** Command name for a Ctrl chord, or null. Keyed off `e.key`, so it follows
 *  the active layout's letters, exactly like a menu accelerator would. */
function ctrlCommand(e) {
  const key = typeof e.key === 'string' ? e.key.toLowerCase() : ''
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (key === 'r' && e.shiftKey) return 'resize'
  return e.shiftKey ? null : (CTRL_COMMANDS[key] || null)
}

window.addEventListener('keydown', (e) => {
  // A focused field keeps every native editing key, Ctrl+C/Ctrl+V included.
  if (e.target instanceof HTMLInputElement && !isResizeOpen()) {
    if (e.key === 'Escape') closeProfileEditor()
    return
  }

  if (e.ctrlKey && !e.metaKey && !e.altKey) {
    const name = ctrlCommand(e)
    if (name) {
      runCommand(name)
      e.preventDefault()
      return
    }
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return

  if (isProfileEditorOpen()) {
    if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') closeProfileEditor()
    return
  }

  if (isHelpOpen()) {
    if (e.key === 'Escape' || e.key === '?' || e.key === 'q' || e.key === 'Q') closeHelp()
    else scrollHelp(e.key)
    e.preventDefault()   // Space/arrows would otherwise scroll or re-activate a focused status-bar button
    return
  }

  if (isThemePickerOpen()) {
    handleThemePickerKey(e.key)
    e.preventDefault()   // Enter/Space would otherwise also activate a focused status-bar button
    return
  }

  if (isProfilePickerOpen()) {
    handleProfilePickerKey(e.key)
    e.preventDefault()   // Enter/Space would otherwise also activate a focused status-bar button
    return
  }

  if (isResizeOpen()) {
    handleResizeKey(e.key)
    e.preventDefault()
    return
  }

  if (e.key === 'p' || e.key === 'P') {
    openProfilePicker()
    return
  }

  if (e.key === 'r' || e.key === 'R') {
    handleResizeCommand()
    return
  }

  if (e.key === 't' || e.key === 'T') {
    openThemePicker()
    return
  }

  if (e.key === '?') {
    openHelp()
    return
  }

  if (e.key === 'Tab') {
    cmd.cycleActiveGroup(e.shiftKey ? -1 : 1)
    e.preventDefault()   // Tab would otherwise move focus onto the status-bar buttons
    return
  }

  if (e.key === 'Escape') {
    if (dragging) {
      cancelDrag()
      return
    }
    cmd.dismissSelection()
    return
  }

  if (e.key >= '1' && e.key <= '5') {
    cmd.chooseGroup(Number(e.key) - 1)
    return
  }

  if (e.key === 'i' || e.key === 'I') {
    cmd.flipDirection()
    return
  }

  if (e.key === 'm' || e.key === 'M') {
    cmd.chooseGroup(MASK_GROUP)
    return
  }

  if (e.key === 'u' || e.key === 'U') {
    handleUndo()
    return
  }

  if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x' || e.key === 'X') {
    if (!cmd.deleteAtPointer(lastPointer.x, lastPointer.y)) toast('No rectangle under the cursor')
  }
})

// --- Menu commands (IPC) -------------------------------------------------

async function handlePaste() {
  const res = await window.hl.readClipboardImage()
  if (!res.ok) {
    toast('Clipboard has no image')
    return
  }
  const bitmap = await createImageBitmap(new Blob([res.png], { type: 'image/png' }))
  const imageData = rasterizeSource(bitmap, bitmap.width, bitmap.height)
  setSource(res.png, bitmap.width, bitmap.height)
  bitmap.close()

  const dirty = loadImage(imageData)
  fit()
  paint(dirty)
  hintEl.style.display = 'none'
  statusbarRefresh()
  toast(`Pasted ${state.imageW}\u00d7${state.imageH}`)
}

async function handleCopy() {
  if (!hasImage()) {
    toast('No image to copy')
    return
  }
  await window.hl.writeClipboardImage(await exportPng())
  toast('Copied to clipboard')
}

async function handleSave() {
  if (!hasImage()) {
    toast('No image to save')
    return
  }
  const res = await window.hl.savePng(await exportPng())
  if (res.ok) toast(res.path)
}

function handleUndo() {
  if (state.undo.length === 0) {
    toast('Nothing to undo')
    return
  }
  cmd.undo()
}

function handleRedo() {
  if (state.redo.length === 0) {
    toast('Nothing to redo')
    return
  }
  cmd.redo()
}

function handleResizeCommand() {
  if (!hasImage()) {
    toast('Nothing to resize')
    return
  }
  openResize()
}

async function loadFromDisk() {
  if (!window.hl) return
  const [themesRes, settingsRes] = await Promise.all([
    typeof window.hl.listThemes === 'function' ? window.hl.listThemes() : { ok: false },
    typeof window.hl.loadSettings === 'function' ? window.hl.loadSettings() : { ok: false }
  ])
  setThemeList(themesRes && themesRes.ok ? themesRes.themes : [])
  await applySettings(settingsRes && settingsRes.ok ? settingsRes.data : null)
  statusbarRefresh()
}

// One implementation per command, reached from the menu (IPC) or from the
// Ctrl branch in the keydown handler above.
const COMMANDS = {
  paste: handlePaste,
  copy: handleCopy,
  save: handleSave,
  undo: handleUndo,
  redo: handleRedo,
  resize: handleResizeCommand
}

function runCommand(name) {
  const fn = COMMANDS[name]
  if (fn) fn()
}

window.hl.onCommand(runCommand)

// --- Bootstrap -------------------------------------------------------------

window.addEventListener('resize', fit)
cmd.setRenderHooks({
  refresh: () => {
    statusbarRefresh()
    refreshProfilePicker()
    refreshThemePicker()
  },
  hoverProbe: () => findTopmostRectAt(lastPointer.x, lastPointer.y)
})
setResizeApplier(async (frac) => {
  const result = await cmd.setImageScale(frac)
  if (result === 'noop') return
  toast(result ? `Resized to ${state.imageW}\u00d7${state.imageH}` : 'Resize failed')
})
hintEl.textContent = keyLabels(window.hl && window.hl.platform).hint
initStatusbar()
setThemeNotifier(toast)
loadFromDisk()
