// Vector overlays for the D and A groups: drawn onto #base after the pixel
// effect pass, so every export contains them. No DOM access — the canvas
// context is always passed in.

import { DRAW_GROUP, ANNOT_GROUP, isVectorGroup } from './effect.js'
import { annotColor } from './colors.js'

export const STROKE_W = 2             // image px at scale 1
export const TEXT_FONT_PX = 16        // image px at scale 1
export const ARROW_HEAD_LEN = 14
export const ARROW_HEAD_HALF = 7
export const LINE_HEIGHT = 1.25
export const FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Cantarell, Helvetica, Arial, sans-serif'

/** Repaint padding (image px) around a vector rect's bbox: the only geometry
 *  that leaves a rect's bbox is the arrowhead's perpendicular wings and the
 *  round line cap at the tail; this bounds both. */
export function annotationPad(scale) {
  return Math.ceil(Math.max(ARROW_HEAD_HALF * scale, STROKE_W * scale * 1.5) + STROKE_W * scale) + 1
}

/** Tail-then-tip endpoints for a D arrow. flipX/flipY record which corner the
 *  drag started from — the one piece of arrow state a normalised bbox can't express. */
export function arrowPoints(rect) {
  return {
    x0: rect.flipX ? rect.x + rect.w : rect.x,
    y0: rect.flipY ? rect.y + rect.h : rect.y,
    x1: rect.flipX ? rect.x : rect.x + rect.w,
    y1: rect.flipY ? rect.y : rect.y + rect.h
  }
}

/** Greedy word-wrap using ctx.measureText; splits on \n first. A single word
 *  longer than maxWidth is emitted on its own line (no mid-word breaking). */
export function wrapLines(ctx, text, maxWidth) {
  const lines = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

/** Clamped, rounded font size in image px for `scale`. Shared by the canvas
 *  font string below and the inline text editor, so the editor's wrap width
 *  and the committed render never disagree at small resize fractions. */
export function fontPxFor(scale) {
  return Math.max(8, Math.round(TEXT_FONT_PX * scale))
}

export function fontFor(scale) {
  return `${fontPxFor(scale)}px ${FONT_STACK}`
}

function bboxIntersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function drawArrow(ctx, r, scale) {
  const { x0, y0, x1, y1 } = arrowPoints(r)
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const lw = STROKE_W * scale
  const headLen = Math.max(ARROW_HEAD_LEN * scale, lw * 3)
  const headHalf = Math.max(ARROW_HEAD_HALF * scale, lw * 1.5)
  const bx = x1 - ux * headLen
  const by = y1 - uy * headLen

  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.strokeStyle = annotColor(r.color)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(bx, by)
  ctx.stroke()

  ctx.fillStyle = annotColor(r.color)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(bx - uy * headHalf, by + ux * headHalf)
  ctx.lineTo(bx + uy * headHalf, by - ux * headHalf)
  ctx.closePath()
  ctx.fill()
}

function drawRectOutline(ctx, r, scale) {
  const lw = STROKE_W * scale
  ctx.lineWidth = lw
  ctx.strokeStyle = annotColor(r.color)
  ctx.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw)
}

function drawText(ctx, r, scale) {
  if (!r.text) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, r.h)
  ctx.clip()
  ctx.font = fontFor(scale)
  ctx.textBaseline = 'top'
  ctx.fillStyle = annotColor(r.color)
  const fontPx = fontPxFor(scale)
  const lines = wrapLines(ctx, r.text, r.w)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], r.x, r.y + i * fontPx * LINE_HEIGHT)
  }
  ctx.restore()
}

/** Draws every D/A rect onto `ctx`, clipped to `dirty` (image-space {x,y,w,h}). */
export function drawAnnotations(ctx, rects, dirty, scale) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(dirty.x, dirty.y, dirty.w, dirty.h)
  ctx.clip()

  const pad = annotationPad(scale)
  for (const r of rects) {
    if (!isVectorGroup(r.group)) continue
    const padded = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
    if (!bboxIntersects(padded, dirty)) continue

    if (r.group === DRAW_GROUP) {
      if (r.shape === 'arrow') drawArrow(ctx, r, scale)
      else drawRectOutline(ctx, r, scale)
    } else if (r.group === ANNOT_GROUP) {
      drawText(ctx, r, scale)
    }
  }

  ctx.restore()
}
