// Shift-vector previews shared by the status bar, the picker and the profile popup.
//
// Each side is previewed on the surface it exists for: the light vector on white
// (a highlight as it lands on a light screenshot), the dark vector on #404040 —
// a mid-dark surface rather than pure black, so a dark vector shows its hue
// instead of collapsing into the background. The preview is therefore slightly
// brighter than the same shift landing on a near-black screenshot.

const LIGHT_BASE = 255
const DARK_BASE = 64

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** `shift` on its own side's surface: sign +1 (light) on white, sign -1 (dark) on black. */
export function sideColor(shift, sign) {
  const base = sign === 1 ? LIGHT_BASE : DARK_BASE
  return `rgb(${clamp255(base + shift.r)}, ${clamp255(base + shift.g)}, ${clamp255(base + shift.b)})`
}

/** The colour of one group binding: the profile's light or dark vector on its own surface. */
export function bindingColor(profile, sign) {
  return sideColor(sign === 1 ? profile.pos : profile.neg, sign)
}

// Mask row swatches: index 0 is unused (style 0 = unmasked, never shown here).
const MASK_COLORS = ['transparent', '#8a8a8a', '#7a7a7a', '#e6e6e6', '#1a1a1a']

/** Flat swatch colour for a mask style (1 noise, 2 pixelate, 3 light, 4 dark);
 *  also used as the status bar's mode-button underline when a group is masked. */
export function maskColor(style) {
  return MASK_COLORS[style] || 'transparent'
}

// D/A palette. Fixed five, one per picker column; index 0 (red) is the default.
const ANNOT_COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff']
export const ANNOT_COLOR_COUNT = ANNOT_COLORS.length
export const ANNOT_COLOR_LABELS = ['red', 'yellow', 'green', 'blue', 'white']

/** CSS colour for a D/A colour index; out-of-range falls back to red. */
export function annotColor(i) {
  return ANNOT_COLORS[i] || ANNOT_COLORS[0]
}
