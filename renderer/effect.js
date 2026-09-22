// Pure pixel kernel — no DOM. Also imported directly by scripts/check-effect.mjs.

export const GROUP_COUNT = 5
export const PROFILE_COUNT = 5
export const DEFAULT_SHIFT = { r: 0, g: 0, b: -160 }

// modeMap: Uint8Array(w*h); 0 = untouched, 1..GROUP_COUNT = rect.group + 1
// dirty: { x, y, w, h }, already clipped to the image by the caller

/**
 * Recomputes modeMap within `dirty`: zeroes it, then stamps each rect that
 * intersects `dirty` (in creation order) with its group code (group + 1).
 * Later rects win on overlap, so a shift is applied exactly once per pixel.
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

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const rx0 = r.x
    const ry0 = r.y
    const rx1 = r.x + r.w
    const ry1 = r.y + r.h

    const ix0 = rx0 > dx0 ? rx0 : dx0
    const iy0 = ry0 > dy0 ? ry0 : dy0
    const ix1 = rx1 < dx1 ? rx1 : dx1
    const iy1 = ry1 < dy1 ? ry1 : dy1
    if (ix0 >= ix1 || iy0 >= iy1) continue

    const code = r.group + 1
    for (let y = iy0; y < iy1; y++) {
      const rowStart = y * w
      modeMap.fill(code, rowStart + ix0, rowStart + ix1)
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
    const o = (gi + 1) * 3
    out[o] = v.r
    out[o + 1] = v.g
    out[o + 2] = v.b
  }
  return out
}

/**
 * Walks only `dirty`; for each pixel copies A from `base` and writes
 * R/G/B = clamp(base + shiftTable[code], 0, 255), where `code` comes from
 * modeMap and indexes three consecutive slots of shiftTable. Code 0 maps to
 * three zero slots, so there is no per-pixel branch.
 * Copy-from-base (never in-place accumulate) keeps deletion and profile/
 * group changes correct without a full rebuild.
 *
 * `base`/`modeMap` are full-image, stride `w`. `out` is compact and
 * origin-relative: exactly `dirty.w * dirty.h * 4` bytes, indexed as if
 * `dirty.x`/`dirty.y` were (0, 0).
 */
export function applyEffect(base, out, modeMap, w, shiftTable, dirty) {
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
      const s = modeMap[idx] * 3

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
