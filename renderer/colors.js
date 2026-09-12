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
