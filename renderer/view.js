// Canvas sizing, dirty-rect rendering, overlay, hit-test geometry.

import { state } from './state.js'
import { stampModeMap, applyEffect, buildMaskEntries } from './effect.js'
import { drawAnnotations } from './annotations.js'

const stageEl = document.getElementById('stage')
const wrapEl = document.getElementById('wrap')
const baseCanvas = document.getElementById('base')
const baseCtx = baseCanvas.getContext('2d')
const overlayCanvas = document.getElementById('overlay')
const overlayCtx = overlayCanvas.getContext('2d')

let scale = 1
let scratch = null
let lastOverlayRect = null
let dprWatch = null

/** Sets the #base bitmap size (natural image pixels). Call once per loaded image. */
function setBitmapSize(w, h) {
  baseCanvas.width = w
  baseCanvas.height = h
}

/** Sizes the canvases for a w×h document, draws `bitmap` into #base (scaling
 *  when w/h differ from the bitmap), and returns the resulting pixels. */
export function rasterizeSource(bitmap, w, h) {
  setBitmapSize(w, h)
  baseCtx.imageSmoothingEnabled = true
  baseCtx.imageSmoothingQuality = 'high'
  baseCtx.drawImage(bitmap, 0, 0, w, h)
  return baseCtx.getImageData(0, 0, w, h)
}

function onDprChange() { fit() }

function armDprWatch(dpr) {
  if (dprWatch) dprWatch.removeEventListener('change', onDprChange)
  dprWatch = window.matchMedia(`(resolution: ${dpr}dppx)`)
  dprWatch.addEventListener('change', onDprChange)
}

/**
 * Fits the image into the stage: scale = min(1, stageW/imageW, stageH/imageH).
 * Sets CSS size of both canvases and #wrap; #base bitmap size is untouched.
 * Never upscales past 1. Also (re)sizes the overlay bitmap to CSS size × the
 * current devicePixelRatio and redraws it, so outlines stay crisp after a
 * resize or a DPR change without any drawOverlay call site changing.
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

  const dpr = window.devicePixelRatio || 1
  const ow = Math.max(1, Math.round(cssW * dpr))
  const oh = Math.max(1, Math.round(cssH * dpr))
  if (overlayCanvas.width !== ow || overlayCanvas.height !== oh) {
    overlayCanvas.width = ow
    overlayCanvas.height = oh
  }
  armDprWatch(dpr)
  drawOverlay(lastOverlayRect)
}

/** CSS px per image px, as last computed by fit(). The inline text editor
 *  uses this to position itself and size its font. */
export function viewScale() {
  return scale
}

function scratchFor(w, h) {
  if (!scratch || scratch.width !== w || scratch.height !== h) scratch = new ImageData(w, h)
  return scratch
}

/** Repaints only `dirty` (image-space {x,y,w,h}). paint(null) is a no-op. */
export function paint(dirty) {
  if (!dirty) return
  stampModeMap(state.modeMap, state.imageW, state.rects, dirty)
  const masks = buildMaskEntries(state.rects, state.base.data, state.imageW, state.imageH, dirty, state.baseGen, state.maskStyle)
  const buf = scratchFor(dirty.w, dirty.h)
  applyEffect(state.base.data, buf.data, state.modeMap, state.imageW, state.shiftTable, dirty, masks)
  baseCtx.putImageData(buf, dirty.x, dirty.y)
  drawAnnotations(baseCtx, state.rects, dirty, state.scale)
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
  const lineWidth = 2 / scale
  overlayCtx.setLineDash([])
  overlayCtx.lineWidth = lineWidth
  overlayCtx.strokeStyle = SELECTION_COLOR
  for (const r of state.selected) {
    overlayCtx.strokeRect(r.x, r.y, r.w, r.h)
  }
}

/** Draws selection outlines, then (if given) the dashed hover/drag outline on top. */
export function drawOverlay(rect) {
  lastOverlayRect = rect
  const k = state.imageW ? overlayCanvas.width / state.imageW : 1
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0)
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  overlayCtx.setTransform(k, 0, 0, k, 0, 0)
  drawSelectionOutlines()
  if (!rect) return
  const lineWidth = 2 / scale
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
