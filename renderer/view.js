// Canvas sizing, dirty-rect rendering, overlay, hit-test geometry.

import { state } from './state.js'
import { stampModeMap, applyEffect } from './effect.js'

const stageEl = document.getElementById('stage')
const wrapEl = document.getElementById('wrap')
const baseCanvas = document.getElementById('base')
const baseCtx = baseCanvas.getContext('2d')
const overlayCanvas = document.getElementById('overlay')
const overlayCtx = overlayCanvas.getContext('2d')

let scale = 1

/** Sets both canvases' bitmap size (natural image pixels). Call once per loaded image. */
export function setBitmapSize(w, h) {
  baseCanvas.width = w
  baseCanvas.height = h
  overlayCanvas.width = w
  overlayCanvas.height = h
}

/**
 * Fits the image into the stage: scale = min(1, stageW/imageW, stageH/imageH).
 * Sets CSS size of both canvases and #wrap; bitmap size is untouched.
 * Never upscales past 1.
 */
export function fit() {
  const iw = state.imageW
  const ih = state.imageH
  if (!iw || !ih) return
  const stageRect = stageEl.getBoundingClientRect()
  scale = Math.min(1, stageRect.width / iw, stageRect.height / ih)
  const cssW = Math.round(iw * scale)
  const cssH = Math.round(ih * scale)
  wrapEl.style.width = cssW + 'px'
  wrapEl.style.height = cssH + 'px'
  baseCanvas.style.width = cssW + 'px'
  baseCanvas.style.height = cssH + 'px'
  overlayCanvas.style.width = cssW + 'px'
  overlayCanvas.style.height = cssH + 'px'
}

/** Repaints only `dirty` (image-space {x,y,w,h}). paint(null) is a no-op. */
export function paint(dirty) {
  if (!dirty) return
  stampModeMap(state.modeMap, state.imageW, state.rects, dirty)
  applyEffect(state.base.data, state.out.data, state.modeMap, state.imageW, state.shiftTable, dirty)
  baseCtx.putImageData(state.out, 0, 0, dirty.x, dirty.y, dirty.w, dirty.h)
}

/** Maps a client-space pointer position to a clamped image-space pixel. */
export function toImage(clientX, clientY) {
  const rect = baseCanvas.getBoundingClientRect()
  const relX = (clientX - rect.left) / rect.width
  const relY = (clientY - rect.top) / rect.height
  let x = Math.floor(relX * state.imageW)
  let y = Math.floor(relY * state.imageH)
  if (x < 0) x = 0
  else if (x > state.imageW - 1) x = state.imageW - 1
  if (y < 0) y = 0
  else if (y > state.imageH - 1) y = state.imageH - 1
  return { x, y }
}

const SELECTION_COLOR = '#3aa0ff'

/** Draws a solid outline for every currently-selected rect. */
function drawSelectionOutlines() {
  if (state.selected.size === 0) return
  const lineWidth = Math.max(1, Math.round(2 / scale))
  overlayCtx.setLineDash([])
  overlayCtx.lineWidth = lineWidth
  overlayCtx.strokeStyle = SELECTION_COLOR
  for (const r of state.selected) {
    overlayCtx.strokeRect(r.x, r.y, r.w, r.h)
  }
}

/** Draws selection outlines, then (if given) the dashed hover/drag outline on top. */
export function drawOverlay(rect) {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  drawSelectionOutlines()
  if (!rect) return
  const lineWidth = Math.max(1, Math.round(2 / scale))
  overlayCtx.setLineDash([6, 4])
  overlayCtx.lineWidth = lineWidth

  overlayCtx.lineDashOffset = 0
  overlayCtx.strokeStyle = 'rgba(0,0,0,0.75)'
  overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  overlayCtx.lineDashOffset = lineWidth
  overlayCtx.strokeStyle = 'rgba(255,255,255,0.9)'
  overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  overlayCtx.lineDashOffset = 0
}

/** Exports the base canvas (no overlay chrome) as a PNG byte array. */
export async function exportPng() {
  const blob = await new Promise((resolve) => baseCanvas.toBlob(resolve, 'image/png'))
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}
