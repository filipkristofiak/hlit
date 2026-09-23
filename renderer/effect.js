// Pure pixel kernel — no DOM. Also imported directly by scripts/check-effect.mjs.

export const GROUP_COUNT = 5          // colour groups; modeMap codes 1..GROUP_COUNT
export const MASK_GROUP = 5           // the 6th group: every rect in it is masked
export const DRAW_GROUP = 6           // vector: outline rectangle or arrow, drawn after the pixel pass
export const ANNOT_GROUP = 7          // vector: text box ("A" — annotate), drawn after the pixel pass
export const GROUP_TOTAL = 8          // sizes the status bar and the Tab cycle
export const PROFILE_COUNT = 5
export const DEFAULT_SHIFT = { r: 0, g: 0, b: -160 }

export const MASK_STYLE_COUNT = 4
export const MASK_NOISE = 1
export const MASK_PIXELATE = 2
export const MASK_LIGHT = 3
export const MASK_DARK = 4
export const MASK_PIXEL_BLOCK = 12   // mosaic cell edge, image pixels
// modeMap cell (Uint16): the low GROUP_CODE_BITS hold the highlight code
// (0 = none, 1..GROUP_COUNT = rect.group + 1), the remaining 13 bits hold the
// mask slot (0 = not masked, otherwise the mask rect's index + 1). A pixel can
// carry both: the mask pixel is synthesised first, then the highlight's shift
// is applied on top of it. DRAW_GROUP/ANNOT_GROUP rects never reach this map
// (see stampModeMap): codes only ever run 0..MASK_GROUP + 1 = 0..6, which is
// why 3 bits is enough even though GROUP_TOTAL is 8.
export const GROUP_CODE_BITS = 3
export const GROUP_CODE_MASK = (1 << GROUP_CODE_BITS) - 1        // 7; holds codes 0..MASK_GROUP + 1
export const MASK_SLOT_LIMIT = (1 << (16 - GROUP_CODE_BITS)) - 1 // 8191 slots -> rect indices 0..8190

/** Colour groups own a `state.groups` binding; nothing else does. */
export function isColorGroup(g) { return g >= 0 && g < GROUP_COUNT }
/** D and A are drawn with canvas vectors after the pixel pass, never stamped
 *  into modeMap — see the isVectorGroup guard in stampModeMap below. */
export function isVectorGroup(g) { return g === DRAW_GROUP || g === ANNOT_GROUP }

// Per-rect colour-statistics sampling. Module-private: tuned for the mask
// kernel only, never exposed past maskStatsFor/buildMaskEntries.
const PALETTE_SIZE = 8
const GRAIN_SHIFT = 1        // 2x2-pixel noise cells
const MAX_SAMPLES = 20000
const BIN_COUNT = 1 << 12    // 4 bits per channel

// Fixed fills for MASK_LIGHT/MASK_DARK: a constant carries zero information
// about the region. Which one to use (light for a dark background, dark for
// a light one) is a per-group choice the user makes, not something inferred
// from the pixels.
const MASK_LIGHT_RGB = [232, 232, 232]
const MASK_DARK_RGB = [24, 24, 24]
const PIXEL_SAMPLE_STEP = 3   // sampling stride inside one mosaic cell

// Scratch histogram buffers, reused across maskStatsFor calls (single-threaded,
// synchronous — no call ever overlaps another).
const binCount = new Uint32Array(BIN_COUNT)
const binR = new Uint32Array(BIN_COUNT)
const binG = new Uint32Array(BIN_COUNT)
const binB = new Uint32Array(BIN_COUNT)

// modeMap cell (Uint16): the low GROUP_CODE_BITS hold the highlight code
// (0 = none, 1..GROUP_COUNT = rect.group + 1), the remaining 13 bits hold the
// mask slot (0 = not masked, otherwise the mask rect's index + 1). A pixel can
// carry both: the mask pixel is synthesised first, then the highlight's shift
// is applied on top of it.
// dirty: { x, y, w, h }, already clipped to the image by the caller

/**
 * Recomputes modeMap within `dirty`: zeroes it, then stamps each rect that
 * intersects `dirty` in two ordered passes — every highlight rect first, then
 * every mask rect — so pass 1 can merge the mask slot into a cell without
 * clearing whatever highlight code pass 0 wrote there; a pixel covered by
 * both keeps its highlight code alongside the new mask slot. Within a single
 * pass (highlight-over-highlight, or mask-over-mask), later rects still win
 * on overlap: a later mask replaces the slot, a later highlight replaces the
 * code. A rect is a mask when its group is `MASK_GROUP`.
 */
export function stampModeMap(modeMap, w, rects, dirty) {
  const dx0 = dirty.x
  const dy0 = dirty.y
  const dx1 = dirty.x + dirty.w
  const dy1 = dirty.y + dirty.h

  for (let y = dy0; y < dy1; y++) {
    const rowStart = y * w
    modeMap.fill(0, rowStart + dx0, rowStart + dx1)
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      // D/A rects carry no pixels: they are drawn as canvas vectors after the
      // effect pass. Stamping one would write code r.group + 1 = 7 or 8; 8
      // overflows GROUP_CODE_BITS straight into the mask-slot field.
      if (isVectorGroup(r.group)) continue
      // Past MASK_SLOT_LIMIT an M rect falls through to the highlight path with
      // code MASK_GROUP + 1, which reads past the end of shiftTable and renders
      // black — fail-closed, never the source pixels.
      const isMask = r.group === MASK_GROUP && i < MASK_SLOT_LIMIT
      if (isMask !== (pass === 1)) continue

      const rx0 = r.x
      const ry0 = r.y
      const rx1 = r.x + r.w
      const ry1 = r.y + r.h

      const ix0 = rx0 > dx0 ? rx0 : dx0
      const iy0 = ry0 > dy0 ? ry0 : dy0
      const ix1 = rx1 < dx1 ? rx1 : dx1
      const iy1 = ry1 < dy1 ? ry1 : dy1
      if (ix0 >= ix1 || iy0 >= iy1) continue

      if (isMask) {
        const slot = (i + 1) << GROUP_CODE_BITS
        for (let y = iy0; y < iy1; y++) {
          const rowStart = y * w
          for (let x = ix0; x < ix1; x++) {
            const idx = rowStart + x
            modeMap[idx] = slot | (modeMap[idx] & GROUP_CODE_MASK)
          }
        }
      } else {
        const code = r.group + 1
        for (let y = iy0; y < iy1; y++) {
          const rowStart = y * w
          modeMap.fill(code, rowStart + ix0, rowStart + ix1)
        }
      }
    }
  }
}

/**
 * Fills `out` (Int16Array((GROUP_COUNT+1)*3)) with the per-group-code signed
 * RGB shift: code 0 (untouched) stays zero; code `gi+1` resolves to
 * `profiles[groups[gi].profile].pos` when `groups[gi].sign === 1`, `.neg`
 * when `sign === -1`. The two vectors are independent, so opposite-signed
 * groups on one profile are exact negations only while that profile is
 * mirrored (see state.js's `linked`).
 */
export function buildShiftTable(profiles, groups, out) {
  out[0] = 0
  out[1] = 0
  out[2] = 0
  for (let gi = 0; gi < GROUP_COUNT; gi++) {
    const g = groups[gi]
    const p = profiles[g.profile]
    const v = g.sign === 1 ? p.pos : p.neg
    const s = (gi + 1) * 3
    out[s] = v.r
    out[s + 1] = v.g
    out[s + 2] = v.b
  }
  return out
}

// Deterministic, allocation-free 32-bit mixer. Not cryptographic — its job is
// avalanche quality (so palette draws and per-pixel jitter look like grain,
// not banding), not unpredictability.
function hash32(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b)
  h = Math.imul(h ^ (b + 0x165667b1), 0xc2b2ae35)
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  h ^= h >>> 13
  return h >>> 0
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Colour statistics for one rect, sampled from `base` (a mask never reads or
 * writes any other buffer) and cached on the rect itself. Recomputed only
 * when `gen` (bumped on every image load/resize) or the rect's own geometry
 * differs from the cache, which is what makes a live drag recompute on every
 * pointermove while a settled rect stays cheap. Drives MASK_NOISE only.
 *
 * Returns `{ gen, x, y, w, h, seed, count, palette: Uint8Array(24),
 * cum: Uint32Array(8) }`. `palette`/`cum` hold `count` (<=8) populated
 * entries, most-frequent first; `cum` is a cumulative distribution scaled
 * to 65536 for a 16-bit weighted draw.
 */
export function maskStatsFor(rect, base, w, h, gen) {
  const cached = rect.maskStats
  if (cached && cached.gen === gen && cached.x === rect.x && cached.y === rect.y &&
      cached.w === rect.w && cached.h === rect.h) {
    return cached
  }

  const x0 = Math.max(0, rect.x)
  const y0 = Math.max(0, rect.y)
  const x1 = Math.min(w, rect.x + rect.w)
  const y1 = Math.min(h, rect.y + rect.h)

  const stats = {
    gen,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    seed: hash32(rect.x, rect.y, rect.w * 8191 + rect.h),
    count: 1,
    palette: new Uint8Array(PALETTE_SIZE * 3),
    cum: new Uint32Array(PALETTE_SIZE)
  }

  // Not reachable via the UI (toImage clamps every rect onto the image), but
  // guarded so a degenerate rect still renders as an opaque colour, not NaN.
  if (x0 >= x1 || y0 >= y1) {
    stats.cum[0] = 65536
    rect.maskStats = stats
    return stats
  }

  binCount.fill(0)
  binR.fill(0)
  binG.fill(0)
  binB.fill(0)

  const area = (x1 - x0) * (y1 - y0)
  const step = Math.max(1, Math.round(Math.sqrt(area / MAX_SAMPLES)))

  for (let y = y0; y < y1; y += step) {
    const rowStart = y * w
    for (let x = x0; x < x1; x += step) {
      const i = (rowStart + x) * 4
      const r = base[i]
      const g = base[i + 1]
      const b = base[i + 2]
      const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      binCount[bin]++
      binR[bin] += r
      binG[bin] += g
      binB[bin] += b
    }
  }

  // 8-slot insertion sort over the 4096 bins: keeps the top PALETTE_SIZE by
  // count without allocating or sorting the whole histogram.
  const topBin = new Int32Array(PALETTE_SIZE).fill(-1)
  const topCnt = new Uint32Array(PALETTE_SIZE)
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    const c = binCount[bin]
    if (c === 0 || c <= topCnt[PALETTE_SIZE - 1]) continue
    let pos = PALETTE_SIZE - 1
    while (pos > 0 && topCnt[pos - 1] < c) {
      topCnt[pos] = topCnt[pos - 1]
      topBin[pos] = topBin[pos - 1]
      pos--
    }
    topCnt[pos] = c
    topBin[pos] = bin
  }

  let selected = 0
  let total = 0
  for (let k = 0; k < PALETTE_SIZE; k++) {
    if (topBin[k] < 0) break
    selected++
    total += topCnt[k]
  }

  let cum = 0
  for (let k = 0; k < selected; k++) {
    const bin = topBin[k]
    const c = topCnt[k]
    stats.palette[k * 3] = Math.round(binR[bin] / c)
    stats.palette[k * 3 + 1] = Math.round(binG[bin] / c)
    stats.palette[k * 3 + 2] = Math.round(binB[bin] / c)
    cum += Math.round(65536 * c / total)
    stats.cum[k] = cum
  }
  stats.cum[selected - 1] = 65536   // force: a 16-bit draw must always resolve
  stats.count = selected

  rect.maskStats = stats
  return stats
}

/**
 * Mosaic cells for one rect's MASK_PIXELATE, sampled from `base` and cached
 * on the rect itself exactly like `maskStatsFor` (same `gen`/geometry
 * invalidation, since a live drag changes geometry every pointermove).
 * Grid origin is the rect origin: cell lookup is
 * `(px - rect.x) / MASK_PIXEL_BLOCK | 0`, no alignment table.
 *
 * Returns `{ gen, x, y, w, h, cols, rows, cells: Uint8Array(cols*rows*3) }`.
 * Each cell is the rounded mean of `base` over its intersection with the
 * image, sampled every `PIXEL_SAMPLE_STEP` pixels in both axes (caps a
 * full-screen 4K pixelate at ~area/9 reads per pointermove so a live drag
 * stays smooth; the loop always visits the cell's own origin, so an
 * on-image cell never yields zero samples). A cell with no on-image
 * intersection at all (unreachable through the UI, which clamps every rect
 * onto the image) is filled with MASK_DARK_RGB, so a degenerate rect still
 * renders as an opaque box rather than transparent or NaN.
 *
 * Unlike the other three styles, pixelate is NOT content-independent: a
 * mosaic cell is an average of the pixels under it, and generate-and-test
 * attacks (Depix, Bishop Fox's Unredacter) can recover text from a mosaic.
 * It exists because it was explicitly requested, not because it is safe —
 * the help overlay must keep saying so.
 */
function maskMosaicFor(rect, base, w, h, gen) {
  const cached = rect.maskMosaic
  if (cached && cached.gen === gen && cached.x === rect.x && cached.y === rect.y &&
      cached.w === rect.w && cached.h === rect.h) {
    return cached
  }

  const cols = Math.ceil(rect.w / MASK_PIXEL_BLOCK)
  const rows = Math.ceil(rect.h / MASK_PIXEL_BLOCK)
  const cells = new Uint8Array(cols * rows * 3)

  for (let cy = 0; cy < rows; cy++) {
    const cy0 = Math.max(0, rect.y + cy * MASK_PIXEL_BLOCK)
    const cy1 = Math.min(h, rect.y + (cy + 1) * MASK_PIXEL_BLOCK)
    for (let cx = 0; cx < cols; cx++) {
      const cx0 = Math.max(0, rect.x + cx * MASK_PIXEL_BLOCK)
      const cx1 = Math.min(w, rect.x + (cx + 1) * MASK_PIXEL_BLOCK)
      const ci = (cy * cols + cx) * 3

      if (cx0 >= cx1 || cy0 >= cy1) {
        cells[ci] = MASK_DARK_RGB[0]
        cells[ci + 1] = MASK_DARK_RGB[1]
        cells[ci + 2] = MASK_DARK_RGB[2]
        continue
      }

      let sr = 0
      let sg = 0
      let sb = 0
      let n = 0
      for (let y = cy0; y < cy1; y += PIXEL_SAMPLE_STEP) {
        const rowStart = y * w
        for (let x = cx0; x < cx1; x += PIXEL_SAMPLE_STEP) {
          const i = (rowStart + x) * 4
          sr += base[i]
          sg += base[i + 1]
          sb += base[i + 2]
          n++
        }
      }
      cells[ci] = Math.round(sr / n)
      cells[ci + 1] = Math.round(sg / n)
      cells[ci + 2] = Math.round(sb / n)
    }
  }

  const mosaic = { gen, x: rect.x, y: rect.y, w: rect.w, h: rect.h, cols, rows, cells }
  rect.maskMosaic = mosaic
  return mosaic
}

/**
 * Sparse `Array(rects.length)`: entries exist for rects in `MASK_GROUP`, and
 * every entry carries the same group-wide `style` — `{ style, stats }` for
 * MASK_NOISE, `{ style, mosaic }` for MASK_PIXELATE, `{ style }` alone for
 * MASK_LIGHT/MASK_DARK (no sampling at all); every other index stays
 * `undefined`. Index alignment with the codes `stampModeMap` stamps is what
 * makes the `applyEffect` lookup O(1) with no separate registry.
 */
export function buildMaskEntries(rects, base, w, h, dirty, gen, style) {
  const entries = new Array(rects.length)
  const dx1 = dirty.x + dirty.w
  const dy1 = dirty.y + dirty.h
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (r.group !== MASK_GROUP) continue
    if (r.x >= dx1 || r.y >= dy1 || r.x + r.w <= dirty.x || r.y + r.h <= dirty.y) continue
    entries[i] = style === MASK_NOISE
      ? { style, stats: maskStatsFor(r, base, w, h, gen) }
      : style === MASK_PIXELATE
        ? { style, mosaic: maskMosaicFor(r, base, w, h, gen) }
        : { style }
  }
  return entries
}

/**
 * Writes one masked pixel to `out` at byte offset `o`. `MASK_LIGHT` and
 * `MASK_DARK` are fixed, content-independent fills; `MASK_NOISE` draws a
 * palette entry per 2x2 grain cell (clumped speckle) with independent
 * per-pixel jitter (breaks the flatness of the 8-colour palette); those
 * three are unrecoverable. `MASK_PIXELATE` reads its rect's mosaic cell —
 * a block average of the source — which IS recoverable by a determined
 * attacker (see `maskMosaicFor`); do not "harden" it into something
 * content-independent without updating the help overlay's caveat. All four
 * styles write opaque alpha: a mask is flat pixels with nothing underneath.
 */
function writeMaskPixel(out, o, entry, x, y) {
  const style = entry.style
  if (style === MASK_DARK) {
    out[o] = MASK_DARK_RGB[0]
    out[o + 1] = MASK_DARK_RGB[1]
    out[o + 2] = MASK_DARK_RGB[2]
    out[o + 3] = 255
    return
  }

  if (style === MASK_LIGHT) {
    out[o] = MASK_LIGHT_RGB[0]
    out[o + 1] = MASK_LIGHT_RGB[1]
    out[o + 2] = MASK_LIGHT_RGB[2]
    out[o + 3] = 255
    return
  }

  if (style === MASK_PIXELATE) {
    const m = entry.mosaic
    let cx = (x - m.x) / MASK_PIXEL_BLOCK | 0
    let cy = (y - m.y) / MASK_PIXEL_BLOCK | 0
    // Belt-and-braces: a stamped pixel is always inside its own rect.
    if (cx < 0) cx = 0
    else if (cx >= m.cols) cx = m.cols - 1
    if (cy < 0) cy = 0
    else if (cy >= m.rows) cy = m.rows - 1
    const ci = (cy * m.cols + cx) * 3
    out[o] = m.cells[ci]
    out[o + 1] = m.cells[ci + 1]
    out[o + 2] = m.cells[ci + 2]
    out[o + 3] = 255
    return
  }

  // MASK_NOISE
  const st = entry.stats
  const t = hash32(st.seed, x >> GRAIN_SHIFT, y >> GRAIN_SHIFT) & 0xffff
  let k = 0
  while (k < st.count - 1 && t >= st.cum[k]) k++
  const hj = hash32(st.seed ^ 0x5bf03635, x, y)
  out[o] = clamp255(st.palette[k * 3] + ((hj & 31) - 16))
  out[o + 1] = clamp255(st.palette[k * 3 + 1] + (((hj >>> 5) & 31) - 16))
  out[o + 2] = clamp255(st.palette[k * 3 + 2] + (((hj >>> 10) & 31) - 16))
  out[o + 3] = 255
}

/**
 * Walks only `dirty`; for each pixel either synthesises a mask pixel (see
 * `writeMaskPixel`, sourced only from `masks[slot - 1]`, never from `base`)
 * or copies A from `base` and writes R/G/B = clamp(base + shiftTable[code],
 * 0, 255), where `code` comes from modeMap and indexes three consecutive
 * slots of shiftTable. Code 0 maps to three zero slots, so there is no
 * per-pixel branch on that path. When a cell carries both a mask slot and a
 * highlight code, the mask pixel is synthesised first and the highlight's
 * shift is then applied to that synthesised pixel — the source pixel is
 * still never read.
 * Copy-from-base (never in-place accumulate) keeps deletion and profile/
 * group changes correct without a full rebuild.
 *
 * `base`/`modeMap` are full-image, stride `w`. `out` is compact and
 * origin-relative: exactly `dirty.w * dirty.h * 4` bytes, indexed as if
 * `dirty.x`/`dirty.y` were (0, 0). `masks` is the sparse array `buildMaskEntries`
 * returns (or `[]` when nothing in `dirty` is masked).
 */
export function applyEffect(base, out, modeMap, w, shiftTable, dirty, masks) {
  const dx0 = dirty.x
  const dy0 = dirty.y
  const dx1 = dx0 + dirty.w
  const dy1 = dy0 + dirty.h

  for (let y = dy0; y < dy1; y++) {
    const rowStart = y * w
    const outRow = (y - dy0) * dirty.w
    for (let x = dx0; x < dx1; x++) {
      const idx = rowStart + x
      const i = idx * 4
      const o = (outRow + (x - dx0)) * 4
      const cell = modeMap[idx]
      const slot = cell >>> GROUP_CODE_BITS
      const s = (cell & GROUP_CODE_MASK) * 3

      if (slot !== 0) {
        writeMaskPixel(out, o, masks[slot - 1], x, y)
        if (s !== 0) {
          out[o] = clamp255(out[o] + shiftTable[s])
          out[o + 1] = clamp255(out[o + 1] + shiftTable[s + 1])
          out[o + 2] = clamp255(out[o + 2] + shiftTable[s + 2])
        }
        continue
      }

      let r = base[i] + shiftTable[s]
      if (r < 0) r = 0
      else if (r > 255) r = 255
      out[o] = r

      let g = base[i + 1] + shiftTable[s + 1]
      if (g < 0) g = 0
      else if (g > 255) g = 255
      out[o + 1] = g

      let b = base[i + 2] + shiftTable[s + 2]
      if (b < 0) b = 0
      else if (b > 255) b = 255
      out[o + 2] = b

      out[o + 3] = base[i + 3]
    }
  }
}
